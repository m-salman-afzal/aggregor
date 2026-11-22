# Publishing

How a version is bumped, released and published.

## Releases start from merged PRs

- **Decision:** `pnpm bump` opens a bump PR into dev; merging it opens the dev → main release PR; merging that publishes
  to the Marketplace and creates the GitHub release. Releases wait for the end of a milestone.
- **Alternatives considered:** creating a release from a pushed git tag.

## Publish to the Marketplace with OIDC

- **Decision:** `vsce publish --skip-duplicate --oidc`, through a Trusted Publishing policy on the `marketplace`
  environment. No `main` branch rule on that environment: `release.yaml` runs on `pull_request`, whose ref is
  `refs/pull/<n>/merge`, so the rule would block publishing. No secrets and no Azure resources.
- **Alternatives considered:** an Azure managed identity with `azure/login`.

## Marketplace icon from `package.json`

- **Problem:** the Marketplace shows the extension's icon only from the VSIX; its web form can't change it, and vsce
  rejects an SVG icon.
- **Decision:** `apps/extension/package.json`'s `icon` names `assets/aggregorMarketplaceIcon.png`, 256×256: the light
  icon's glyph on a dark rounded square, so it reads on the Marketplace's white page and in dark themes alike.
- **Alternatives considered:** the light or dark icon on transparent, each faint on one of the two backgrounds.

## `bumpp` for version bumps

- **Decision:** `pnpm bump` sets one version in the root and `apps/extension` `package.json` and pushes
  `chore/bump-v<version>`.

## One README for GitHub and the Marketplace, with media served from GitHub

- **Problem:** vsce ships `apps/extension/README.md` as the listing's page, and GitHub shows the root `README.md`. As
  two texts they read differently: the listing said what Aggregor is, with screenshots, and the repository's page was
  the developer's, with every feature in full and the roadmap.
- **Decision:** one short text for both (what Aggregor is, what it does today, what is planned, requirements), with
  screenshots and GIFs of a real headless VS Code run, so the repository's page reads as the listing does. It is the
  root `README.md`, and `apps/extension/README.md` is a symlink to it, so there is nothing to keep in sync. The roadmap
  moved to `ROADMAP.md` and the development notes to `AGENTS.md`; the text on every feature in full was deleted, since
  the settings' descriptions and `decisions/` hold that detail. Its images are absolute `raw/main` GitHub URLs to
  `apps/extension/media/`, which `.vscodeignore` leaves out of the VSIX, so the listing shows what the released branch
  holds and the VSIX stays small.
- **Solution:** vsce packs the symlink as a regular file. lint-staged leaves a symlink out of the files it checks, and
  Prettier skips one when it walks a folder but fails when given its path. The links to `ROADMAP.md` and `AGENTS.md` are
  relative: GitHub resolves them on the branch in view, and vsce rewrites them to the default branch, `dev`. The media
  were recorded with the verify-in-vscode skill's window over CDP screencast and turned into GIFs; the Marketplace plays
  GIFs but no video, and vsce rejects SVG images.
- **Alternatives considered:** a short listing README beside the root's long developer page, the first choice, dropped
  so both pages read the same; the root file copied in by `vscode:prepublish`, one more build step; two identical files
  kept by a check, every edit made twice; `vsce --readme-path`, which only finds a file inside `apps/extension`;
  relative image links, which vsce resolves against `dev`, not the released branch; shipping the media in the VSIX,
  which grows every install by about 2 MB.
