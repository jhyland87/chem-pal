# Releasing

Releases are produced by the [`release.yml`](https://github.com/jhyland87/chem-pal/blob/main/.github/workflows/release.yml) workflow. Pushing a `v*` tag (or running the workflow manually) builds the production extension, signs it, and publishes a GitHub Release with the `.crx` and an unpacked-build zip attached.

## Prerequisites

- **`CRX_PRIVATE_KEY` repo secret.** The PEM private key used to sign the `.crx`. Settings → Secrets and variables → Actions → New repository secret. Paste the full PEM, including the `-----BEGIN PRIVATE KEY-----` / `-----END PRIVATE KEY-----` lines and the trailing newline.
  - The same key must be used for every release — Chrome derives the extension's identity from it. Losing or replacing it produces a different extension ID.

## Cutting a release

1. **Pick a version.** The tag drives everything. Format: `v<major>.<minor>.<patch>` for stable, or `v<major>.<minor>.<patch>-<prerelease>` for betas (e.g. `v0.0.13`, `v0.0.13-beta.4`).

2. **Bump `package.json` to match.** Set `version` to the same string (without the leading `v`). Commit it on `main`. This keeps `main` in sync with what's been released — the workflow will overwrite `package.json` and `public/manifest.json` on the runner regardless, but only for the build artifact.

   ```bash
   # edit package.json: "version": "0.0.13-beta.4"
   git commit -am "Bump to 0.0.13-beta.4"
   git push
   ```

3. **Tag and push.**

   ```bash
   git tag v0.0.13-beta.4
   git push origin v0.0.13-beta.4
   ```

4. **Watch the run.** The release workflow runs `build → (test + test-e2e in parallel) → release`. The release job only runs if both test suites pass. Watch it under the [Actions](https://github.com/jhyland87/chem-pal/actions) tab.

5. **Verify the release.** Once the workflow finishes, the new release appears under [Releases](https://github.com/jhyland87/chem-pal/releases) with two assets:
   - `chem-pal.crx` — signed, ready to install
   - `chem-pal-<version>-unpacked.zip` — the unpacked build, for "Load unpacked" in `chrome://extensions`

   The release notes are auto-generated from commits and merged PRs since the previous tag.

## Manual trigger (no tag)

Use the **Actions** tab → **Release** → **Run workflow** button. Enter the version (e.g. `v0.0.13-beta.5`). The workflow will create the tag at the current `HEAD` of the selected branch and publish the release.

Use this for re-running a release without re-tagging locally, or for one-off releases from a non-`main` branch.

## How the version flows into the build

The tag (or dispatch input) becomes:

- **`version_name`** in `public/manifest.json` and **`version`** in `package.json` — the full string with the leading `v` stripped (e.g. `0.0.13-beta.4`). This is what users see in `chrome://extensions`.
- **`version`** in `public/manifest.json` — the numeric prefix only (e.g. `0.0.13`). Chrome requires this field to be 1–4 dot-separated integers, so prerelease suffixes are dropped.

Edits to `package.json` / `public/manifest.json` happen in the runner's working copy only. Nothing is committed back.

## When something goes wrong

- **Tests fail.** The release job is gated on `test` and `test-e2e`. Fix the failure on `main`, delete the tag, re-tag the new commit:

  ```bash
  git tag -d v0.0.13-beta.4
  git push origin :refs/tags/v0.0.13-beta.4
  # ...fix and commit...
  git tag v0.0.13-beta.4
  git push origin v0.0.13-beta.4
  ```

- **Build or sign step fails.** Same recovery — delete the tag, fix, re-tag. No release is created on failure, so there's nothing to clean up on the Releases page.

- **A bad release was published.** Delete it from the [Releases page](https://github.com/jhyland87/chem-pal/releases), delete the tag (commands above), then cut a new tag.
