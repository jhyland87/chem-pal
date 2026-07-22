---
name: cut-release
description: Cut and publish a ChemPal release — roll the CHANGELOG, bump the version, tag, and watch the release workflow. Use when shipping a new version, tagging vX.Y.Z, or preparing release notes for the Chrome Web Store. Pushing a tag publishes publicly, so the push steps require explicit confirmation.
---

# Cutting a release

[RELEASING.md](../../../RELEASING.md) is the authoritative document — read it for the
signing key, the manual workflow trigger, and how the version flows into the build. This
skill is the ordered driver.

**Pushing a tag publishes a public GitHub Release.** Do not push a tag or run the workflow
without the user explicitly confirming the version.

## 1. Pick the version

`v<major>.<minor>.<patch>`, or `v<major>.<minor>.<patch>-<prerelease>` for betas
(`v1.5.0`, `v1.5.0-beta.1`). Check the current version in `package.json` and the last tag:

```bash
git tag --sort=-v:refname | head -5
```

## 2. Roll the CHANGELOG

Move everything under `## [Unreleased]` into a new section:

```markdown
## [1.5.0] - 2026-07-21
```

Leave `## [Unreleased]` in place, empty. Keep entries grouped under
**Added** / **Changed** / **Fixed** / **Removed**.

Write for users, not for the commit log — `tools/extractChangelog.js` pulls the section
matching the tag, and that text becomes both the GitHub release body and the in-extension
"What's new" prompt. "New supplier: Daily Bio USA." not "add SupplierDailyBioUSA".

## 3. Bump `package.json`

Set `version` to the tag without the leading `v` (`"1.5.0"`). This keeps `main` in sync
with what shipped; the workflow rewrites it on the runner regardless.

## 4. Run the full suite

```bash
pnpm type-check && pnpm lint && pnpm test:all
```

`test:all` is unit + both E2E suites. The release job won't run if these fail in CI, so
catching it locally saves a round trip.

## 5. Commit, tag, push — confirm first

```bash
git commit -am "Release v1.5.0"
git tag v1.5.0
git push && git push origin v1.5.0
```

## 6. Watch and verify

The tag push triggers `.github/workflows/release.yml`
(`build → test + test-e2e in parallel → release`).

```bash
gh run watch
```

When it finishes, confirm the release has both assets:

- `chem-pal.crx` — signed, installable
- `chem-pal-<version>-unpacked.zip` — for "Load unpacked"

```bash
gh release view v1.5.0
```

If the workflow needs re-running without re-tagging, use the manual **Run workflow**
trigger described in RELEASING.md.
