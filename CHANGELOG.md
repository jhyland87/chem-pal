# Changelog

All notable changes to Chem Pal are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Each released section below is what users see in the extension's update prompt
and on the GitHub release page — the release workflow extracts the section
matching the tag being built (see `tools/extractChangelog.js`). Write entries for
users, not for the commit log: describe what changed for someone using Chem Pal,
one line per change, grouped under **Added** / **Changed** / **Fixed** /
**Removed**.

## [Unreleased]

### Added

- New supplier: Daily Bio USA.
- New supplier: Orbit Natural Product Derivatives.
- Suppliers that restrict shipping on their own website but ship more freely through their eBay
  or Amazon store now say so in the expanded product row, with a link to the store.
- Suppliers that list extra products on their eBay or Amazon store now note it in the expanded
  product row, with a link to the store.

### Fixed

- Chemical grades written as a labeled field (for example `Grade: Reagent`) in a product
  description were not detected, so those products showed as **Ungraded**.
- Liter-sized products (for example `1 LITER`) were not always recognized, so their pack size
  could be dropped.

## [1.3.0] - 2026-07-19

### Added

- Update prompt: Chem Pal now tells you when a newer version is available, with a
  **What's new** summary of the release. Web Store installs can apply the staged
  update straight from the prompt; manual installs get a link to the release.
- After updating, Chem Pal shows what changed in the version you moved onto.

### Fixed

- The About panel's update check reported "up to date" when a newer version was
  actually available, and vice versa.
- Search logic: The search logic has been improved after rigorous testing and should
  yield more suitable results.
- I18n updates/fixes for multiple languages.
- Rendering issues for smaller screens resolved.

## [1.2.0] - 2026-07-18

### Added

- Options page for configuring Chem Pal outside the popup.
- Advanced mode, which unlocks the supplier statistics panel.
- Demo mode assets for showcasing the extension.

### Changed

- Improved reagent-grade and purity parsing, so more products report a usable
  grade.
- Products with no detectable grade now show **Ungraded** instead of an empty
  purity column.
- Moved the active search query into the results table header to free up
  vertical space.
- Expanded and corrected the bundled translations.

### Fixed

- Search failing to return results in some cases.

### Removed

- The native side panel, in favor of the popup and full-tab views.

## [1.1.0] - 2026-07-14

Released before this changelog was introduced. See the
[1.1.0 release notes](https://github.com/jhyland87/chem-pal/releases/tag/v1.1.0).

## [1.0.0] - 2026-07-11

Released before this changelog was introduced. See the
[1.0.0 release notes](https://github.com/jhyland87/chem-pal/releases/tag/v1.0.0).
