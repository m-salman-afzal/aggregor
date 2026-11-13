# Build

How the extension is bundled, checked and packaged.

## Vite bundles, vsce packages

- **Decision:** Vite builds the extension into one `dist/extension.js`; vsce packages it with `--no-dependencies`.
  Because it ships as one bundle, `presentation/` lives inside `src`.
- **Solution:** two Vite builds. The extension's bundles `src/extension.ts`, with effect and `@pkg/*` inside and
  `vscode` and Node's built-ins left out. The webview's runs second, since the first empties `dist`, and bundles
  `apps/webview/src/main.tsx` into `dist/webview/webview.js` and `webview.css`, under fixed names; it imports the
  extension's files for types only, so none of the extension's code enters it. At run time the Sessions view writes the
  page that loads those two files, and on F5 the same page loads them from Vite's dev server instead. Explainer:
  [Aggregor Bundling](https://claude.ai/artifact/T1G1bsVFRu3A1jX3q9igtp), a 30-second film of the two builds, the page
  the extension writes, F5's dev server and what the VSIX carries.

## pnpm workspace with pinned Node and pnpm

- **Decision:** a pnpm monorepo (`apps/extension`, `packages/*`); `devEngines` pins Node 26 and pnpm 12 with
  `onFail: error`, and CI's `pnpm/setup` installs the versions it names.

## Checks package the `.vsix`

- **Problem:** vsce refuses to package when `@types/vscode` is newer than `engines.vscode`, which failed the v0.0.3
  release.
- **Decision:** Checks runs `vsix` on every branch. Renovate moves `vscode` and `@types/vscode` together with
  `rangeStrategy: bump`, and skips `vscode` patch releases, which add no API and would only lock users out.

## A VSIX per platform, built in CI, and no universal one

- **Problem:** the extension ships a native binary, so one VSIX can't serve every platform. v0.0.7 also published a
  universal VSIX without the binary, and the Marketplace makes each upload live minutes after `vsce publish`, in no set
  order: the universal one went live before `linux-x64`, a Linux VS Code auto-updated to it in between, and VS Code
  never swaps an installed universal build for a platform build of the same version, so no session could start until a
  reinstall.
- **Decision:** Release builds `x86_64` and `aarch64` musl binaries with cargo-zigbuild (0.24.1, Zig 0.17.1, in a venv
  on `PATH` so it finds Zig) on one Linux runner, and both macOS targets with cargo on one Apple silicon runner. The
  release job packages `linux-x64`, `linux-arm64`, `alpine-x64`, `alpine-arm64`, `darwin-x64` and `darwin-arm64` with
  their binary, `win32-x64` and `win32-arm64` without one, and no universal VSIX. Artifacts drop the executable bit, so
  packaging sets it again; a packaged binary keeps it through install. Checks packages the VSIX with the runner's own
  build. Each platform matches only its own VSIX, so a client that updates mid-release gets its build or nothing new.
  Static musl binaries run on any Linux, Alpine included, so two runners cover the six targets with a binary. Windows
  still installs the extension, and starting or reopening a session there says to reopen the folder in WSL, which runs
  the Linux VSIX. `linux-armhf` gets no VSIX.
- **Alternatives considered:** building each target on its own native runner. Cross-compiling macOS from Linux with Zig,
  which needs Apple's SDK for anything beyond libc. A universal VSIX without the binary for every other platform,
  published with the rest (the race above) or last: the upload order doesn't set the order they go live, since
  `darwin-x64`, uploaded after it, went live first. Publishing it once the Marketplace lists every platform build, by
  polling: still a bet on timing, for a fallback that only reaches platforms where sessions can't run.
