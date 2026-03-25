# Public Release WIP

This is the working checklist for taking the repository and extension public.

## Completed In This WIP

1. Added `CODEOWNERS` coverage for core paths.
2. Added a `SECURITY.md` policy.
3. Added Dependabot configuration.
4. Added a CodeQL workflow.
5. Added a repo usage guide in [how-to-use.md](how-to-use.md).
6. Added an automated release-artifact workflow for VSIX and launcher packaging.
7. Added optional Marketplace publishing from GitHub Actions through `VSCE_PAT`.

## Remaining Release Tasks

1. Confirm the repository visibility change on GitHub.
2. Enable GitHub Security Advisories in the repository settings.
3. Decide whether branch protection should require CODEOWNERS review.
4. Verify the `publisher` in `package.json` matches the public Marketplace account.
5. Add a `VSCE_PAT` secret in GitHub repository settings.
6. Confirm the `publisher` in `package.json` is the Marketplace publisher you control.
7. Create the first public release notes and screenshots.

## Suggested Publish Sequence

1. Run `npm run compile`.
2. Run `npm run package:pcg-launcher`.
3. Run `npm run lint:md`.
4. Trigger `.github/workflows/release-artifacts.yml` manually or push a `v*` tag.
5. For a manual Marketplace push, run the workflow with `publishMarketplace=true`.
6. For automatic Marketplace publishing on tags, keep `VSCE_PAT` configured.

## Notes

I can prepare the repo for a public release from inside the workspace, but changing GitHub repository visibility and publishing the Marketplace package still requires the repository or Marketplace account permissions on your side.

## Automation Scope

The release workflow now automates:

1. `npm ci`
2. extension compilation
3. Markdown linting
4. Windows launcher packaging
5. VSIX packaging
6. SHA-256 checksum generation
7. artifact upload on manual runs
8. GitHub release asset attachment on `v*` tags
9. optional VS Code Marketplace publishing on tags or manual dispatch

## Required Secret

Add `VSCE_PAT` in GitHub repository secrets.

The token needs permission to publish the `maggy-studio` extension in the VS Code Marketplace.

## Publish Behavior

1. Manual workflow run: packages artifacts, and publishes to Marketplace only if `publishMarketplace=true`.
2. `v*` tag push: packages artifacts, attaches release assets, and publishes to Marketplace if `VSCE_PAT` exists.

If `VSCE_PAT` is missing and Marketplace publishing is requested, the publish job fails explicitly instead of silently skipping.
