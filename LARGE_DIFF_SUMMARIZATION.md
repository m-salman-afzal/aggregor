# Large Diff Summarization for Commit Messages

> Context: VSCode extension (`yamac`) that auto-generates commit messages.  
> Problem: Up to 10,000 staged/tracked files, ~1,000 lines each → potentially **10M+ lines of diff**, far beyond any LLM
> context window.

---

## 1. The Scale Problem

| Signal                          | Number                                 |
| ------------------------------- | -------------------------------------- |
| Files                           | ~10,000                                |
| Lines/file                      | ~1,000                                 |
| Raw diff size                   | ~20M–50M tokens (additions + removals) |
| Max LLM context (largest today) | ~2M tokens (Gemini 1.5 Pro)            |
| Fit in one call?                | **No**                                 |

Naively dumping the full diff into an LLM is impossible. You need a pipeline that **extracts signal before the LLM ever
sees anything**.

---

## 2. Pre-Processing Pipeline (Zero LLM Cost)

Do as much work as possible with Git's own tooling before touching any API.

### Step 1 — Structural diff (`git diff --stat --cached`)

```
 src/api/users.ts       | 42 ++++---
 src/api/payments.ts    | 18 +++
 tests/users.test.ts    | 95 +++++++++++++++
 ...
 1000 files changed, 28451 insertions(+), 3201 deletions(-)
```

This single command gives you **per-file change density** with no API call. From it you can:

- Identify which directories were touched
- Spot hotspot files (most lines changed)
- Classify bulk operations (e.g. "823 test files added")

### Step 2 — Intent signals (cheap regex, no LLM)

| Git command                         | What it tells you                                        |
| ----------------------------------- | -------------------------------------------------------- |
| `git diff --cached --name-status`   | Added / Modified / Deleted / Renamed per file            |
| `git diff --cached --shortstat`     | Single-line summary (N files, N insertions, N deletions) |
| `git diff --cached -- package.json` | Dependency changes (high signal)                         |
| `git diff --cached -- '*.config.*'` | Config changes                                           |
| `git diff --cached --diff-filter=R` | All renames                                              |

Parse these with TypeScript — zero tokens consumed.

### Step 3 — Semantic clustering

Group files into buckets before sending to any LLM:

```
/src/api/        →  "API layer changes"        (47 files)
/src/components/ →  "UI component changes"      (312 files)
/tests/          →  "Test coverage changes"     (821 files)
/migrations/     →  "Database migration"        (3 files)  ← high priority
/package.json    →  "Dependency update"         (1 file)   ← high priority
```

Key insight: **100 test files that each add 10 lines are one story, not 100 stories.**

---

## 3. The Hierarchical Map-Reduce Strategy

The only viable approach for truly massive diffs:

```
                    ┌─────────────────────┐
                    │   Final LLM call    │  ← synthesize cluster summaries
                    │  (one call, ~2K tok)│
                    └──────────┬──────────┘
                               │
           ┌───────────────────┼───────────────────┐
           ▼                   ▼                   ▼
   ┌───────────────┐  ┌───────────────┐  ┌───────────────┐
   │ Cluster A     │  │ Cluster B     │  │ Cluster C     │
   │ LLM summary   │  │ LLM summary   │  │ LLM summary   │
   │ (~1K tok out) │  │ (~1K tok out) │  │ (~1K tok out) │
   └───────┬───────┘  └───────┬───────┘  └───────┬───────┘
           │                  │                  │
    [50 file diffs]    [80 file diffs]    [20 file diffs]
    [truncated to      [truncated to      [truncated to
     ~10K tok each]     ~10K tok each]     ~10K tok each]
```

**Levels:**

1. **Map** — Send each cluster's diff (truncated/sampled) to the LLM independently. Parallelize with
   `Promise.allSettled`.
2. **Reduce** — Send all cluster summaries as a single prompt for the final commit message.

**Total token budget** (example with 20 clusters):

- Map: 20 calls × 10K input tokens = 200K input tokens
- Reduce: 1 call × 20K input tokens = 20K input tokens
- **~220K tokens total** — very manageable

---

## 4. File Sampling Strategy

Not all files carry equal signal. Apply this priority ranking:

```
Priority 1 (always include full diff):
  package.json, *.lock, Dockerfile, *.yml, *.yaml, *.env.*,
  *config*, *schema*, *migration*, *seed*

Priority 2 (include first 100 lines of diff):
  Entry points, index files, main modules

Priority 3 (include 1 representative sample per group):
  Test files (pick 1–2), generated files, locale files

Priority 4 (stats only, no diff content):
  Binary files, assets, auto-generated code
```

With this ranking you can cap your actual LLM input at **< 50K tokens** even for 10K-file changesets.

---

## 5. LLM Options — Cost & Fit Analysis

> Prices as of May 2026. All per million tokens.

| Model                 | Input $/MTok | Output $/MTok | Context  | Speed     | Best for                  |
| --------------------- | ------------ | ------------- | -------- | --------- | ------------------------- |
| **Gemini 2.0 Flash**  | $0.075       | $0.30         | 1M tok   | Fast      | Cheapest map phase        |
| **Claude Haiku 4.5**  | $0.80        | $4.00         | 200K tok | Very fast | Balanced cost/quality     |
| **GPT-4o-mini**       | $0.15        | $0.60         | 128K tok | Fast      | Good fallback             |
| **Claude Sonnet 4.6** | $3.00        | $15.00        | 200K tok | Medium    | High-quality final reduce |
| **Gemini 1.5 Pro**    | $1.25        | $5.00         | 2M tok   | Slow      | Single-call if you must   |

### Cost estimate for the hierarchical approach (20 clusters × 10K tokens each):

| Model (map + reduce)                | Map cost | Reduce cost | Total       |
| ----------------------------------- | -------- | ----------- | ----------- |
| Gemini Flash (map) + Haiku (reduce) | ~$0.002  | ~$0.004     | **~$0.006** |
| Haiku (map + reduce)                | ~$0.16   | ~$0.008     | **~$0.17**  |
| GPT-4o-mini (map + reduce)          | ~$0.03   | ~$0.006     | **~$0.04**  |
| Sonnet (map + reduce)               | ~$0.60   | ~$0.03      | **~$0.63**  |

**Recommendation: Gemini 2.0 Flash for map, Claude Haiku 4.5 for reduce.**  
The reduce step needs better reasoning; the map step just needs extraction.

### Why not one big call?

Even with Gemini 1.5 Pro's 2M context, sending 10K files is:

- Slow (30–90s latency)
- ~$12.50 per commit message generation
- Wasteful (most tokens are noise)

---

## 6. Integration Architecture for `yamac`

### Design goals

- Keep the extension bundle small (esbuild, no heavy SDK)
- Non-blocking — never freeze the SCM panel
- User controls their own API key (no server-side costs)
- Graceful degradation (if LLM fails, show stat-based summary)

### Recommended stack

```
VSCode Git API
  └── git.diff() / git.status()           ← already a dependency
         │
         ▼
  DiffAnalyzer (pure TS, no deps)         ← cluster + rank + truncate
         │
         ▼
  LLMClient (native fetch, no SDK)        ← direct REST calls
  - configurable: Anthropic / OpenAI / Gemini
  - reads API key from vscode.workspace.getConfiguration()
         │
         ▼
  CommitMessageBuilder                    ← map + reduce orchestration
         │
         ▼
  scm.inputBox.value = result             ← writes into SCM input
```

### Bundle size impact

| Approach                                | Bundle size delta |
| --------------------------------------- | ----------------- |
| Native `fetch` + hand-rolled REST calls | +0 KB             |
| `@anthropic-ai/sdk`                     | +~180 KB          |
| `openai` npm package                    | +~220 KB          |
| `@google/generative-ai`                 | +~90 KB           |

Use native `fetch`. All three providers (Anthropic, OpenAI, Gemini) have simple enough REST APIs that an SDK is
unnecessary overhead for this use case.

### Extension settings to expose

```jsonc
// settings.json contribution
"yamac.llm.provider": "anthropic" | "openai" | "gemini",
"yamac.llm.apiKey": "",
"yamac.llm.mapModel": "claude-haiku-4-5-20251001",
"yamac.llm.reduceModel": "claude-haiku-4-5-20251001",
"yamac.llm.maxClusters": 20,
"yamac.llm.maxTokensPerCluster": 10000
```

### Concurrency model

```typescript
// Map phase: parallel, respect rate limits
const clusterSummaries = await Promise.allSettled(
  clusters.map((c) => summarizeCluster(c)) // fire all in parallel
);

// Reduce phase: single call on successful summaries
const commitMessage = await reduceToCommitMessage(
  clusterSummaries.filter((r) => r.status === "fulfilled").map((r) => r.value)
);
```

Use `Promise.allSettled` (not `Promise.all`) so one failing cluster doesn't abort the whole generation.

---

## 7. Fallback: Stat-Only Mode (No API Key Required)

When no API key is configured, generate a deterministic commit message from git stats alone:

```
feat: add 312 components, update API layer (47 files), add tests (821 files)

Changed: src/api/ (+47), src/components/ (+312), tests/ (+821)
Dependencies updated: react 18→19, typescript 5→6
3 database migrations added
```

This covers 80% of cases for bulk changes without any LLM cost. Implement it as the baseline that the LLM mode
_improves_, not replaces.

---

## 8. Recommended Implementation Plan

1. **Implement stat-only fallback first** — works immediately, zero dependencies
2. **Add `DiffAnalyzer`** — clustering, ranking, truncation logic (pure TS)
3. **Add `LLMClient`** — thin fetch wrapper, provider-agnostic interface
4. **Wire up map-reduce** in `CommitMessageBuilder`
5. **Add settings** for provider/model/key
6. **Default model**: Claude Haiku 4.5 (best quality/cost ratio with Anthropic; consistent with the `@anthropic-ai`
   ecosystem you're likely building toward given the extension name "yamac — Yet Another Multi Agent Code")

---

## 9. Quick Reference

| Scenario                      | Strategy                                           |
| ----------------------------- | -------------------------------------------------- |
| < 50 files                    | Single LLM call, full diff                         |
| 50–500 files                  | Stat-based clustering + single call on top files   |
| 500–10K files                 | Full map-reduce pipeline                           |
| No API key                    | Stat-only fallback                                 |
| Monorepo with generated files | Filter priority 4 files entirely before clustering |
