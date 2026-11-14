# Dependencies

How dependency versions are pinned and updated.

## Renovate instead of Dependabot

- **Problem:** Dependabot's npm runs failed: its container runs Node 24, and `devEngines` (Node 26, `onFail: error`)
  makes pnpm refuse to install.
- **Decision:** Renovate (`.github/renovate.json5`), which installs the Node that `devEngines` names. Weekly, minor and
  patch bumps in one PR, OSV vulnerability alerts, GitHub Actions in their own `ci` PR, and `vscode` with
  `@types/vscode` together. husky and portable-pty are left out of the abandoned-package warning: both are kept on
  purpose despite no recent release.

## Updates wait 1 day after a release

- **Decision:** Renovate proposes a release once it is 1 day old, for every manager; pnpm's `minimumReleaseAgeExclude`
  list is gone. A compromised release has time to be pulled, and 1 day matches pnpm's own `minimumReleaseAge` default.
- **Alternatives considered:** 7 days, then 3 days.

## Actions pinned to exact tags, with a lock file

- **Decision:** workflows name exact tags (`actions/checkout@v7.0.1`), Renovate ignores the digest preset, and
  `gh actions-lock` writes each tag's commit SHA to `.github/workflows/actions.lock`. The workflows stay readable while
  the lock file keeps the commit behind each tag.
- **Alternatives considered:** commit digests in the workflows, which Renovate pinned through
  `helpers:pinGitHubActionDigests`.

## Every dependency version lives once, in the pnpm catalog

- **Problem:** each `package.json` pinned its own versions, so `effect`, `@types/node` and the like were pinned in two
  places that could drift apart.
- **Decision:** as in chatly-web: every version sits once in `pnpm-workspace.yaml`'s `catalog:`, and each `package.json`
  names it as `"catalog:"` (workspace packages stay `workspace:*`). `catalogMode: strict` makes `pnpm add` write the
  catalog entry and refuse a different version; `cleanupUnusedCatalogs` drops entries nothing uses. ESLint
  (`eslint-plugin-pnpm` 1.9.1) fails a plain version (`pnpm/json-enforce-catalog`, which `lint:fix` moves into the
  catalog), one that conflicts with the catalog, a `catalog:` with no entry, and an unused or duplicate entry.
  `@types/vscode` is the one exception and stays a version in `apps/extension` and `packages/vscode`: vsce reads it to
  check `engines.vscode` and fails on `catalog:`. Declaring it only in `@pkg/vscode`, with the extension taking its
  types through that package, was tried and dropped, since vsce then skips the check. Renovate updates the catalog
  itself. One source of truth for every version, which lint keeps that way.
- **Alternatives considered:** named catalogs, which would let one workspace keep its own version of a package.

## Drizzle updates only to its releases

- **Problem:** drizzle publishes a build of each branch commit as `<version>-<hash>`, which semver ranks above the
  release itself. Renovate moved drizzle-orm and drizzle-kit from `1.0.0-rc.5` to `1.0.0-rc.5-ab785fc`, a build from
  whose types fail typecheck with `anyUnknownInErrorContext` and which pulled in esbuild.
- **Decision:** both stay on `1.0.0-rc.5`, and a Renovate rule skips any drizzle version ending in `-<7-char hash>`
  (`allowedVersions: "!/-[0-9a-f]{7}$/"`). esbuild's `allowBuilds` entry goes with it, since nothing installs esbuild
  any more.
