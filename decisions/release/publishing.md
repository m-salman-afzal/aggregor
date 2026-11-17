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
