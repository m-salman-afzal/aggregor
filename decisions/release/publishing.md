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

## `bumpp` for version bumps

- **Decision:** `pnpm bump` sets one version in the root and `apps/extension` `package.json` and pushes
  `chore/bump-v<version>`.
