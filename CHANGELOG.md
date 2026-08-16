# Changelog

All notable changes to ChemPal are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Each released section below is what users see in the extension's update prompt
and on the GitHub release page — the release workflow extracts the section
matching the tag being built (see `tools/extractChangelog.js`). Write entries for
users, not for the commit log: describe what changed for someone using ChemPal,
one line per change, grouped under **Added** / **Changed** / **Fixed** /
**Removed**.

## [Unreleased]

## [1.9.0] - 2026-08-16

### Changed

- Anonymous usage and error statistics now go to PostHog instead of Google Analytics. What
  gets collected is unchanged — which searches are run, how many results they return, and
  when the extension hits an error — and **Settings → Behavior → Share anonymous usage
  data** still turns it off. The old analytics identifier is discarded and replaced with a
  new random one.

## [1.8.0] - 2026-08-13

### Added

- **Address-bar search:** type `chem` then Space (or Tab) in the browser's address bar,
  followed by your search, to look up suppliers without opening ChemPal first.
- **Keyboard shortcut:** press `Ctrl+Shift+Y` (`⌘+Shift+Y` on Mac) to open ChemPal. You can
  change the keys from your browser's extension-shortcuts settings.
- Removing ChemPal now opens a short, optional feedback form so you can tell us what could
  be better — it helps shape what gets built next.
- A **Terms of Service** is now published alongside the Privacy Policy, covering how ChemPal
  works as a comparison tool and your responsibility for buying and handling chemicals safely
  and legally.

## [1.7.1] - 2026-08-04

### Added

- New supplier: **LabPro Services**.
- New supplier: **HyperFuels**.
- **Full Reset** in Settings → Actions: clears all stored data (settings, history, caches,
  price history, and saved exports) and reloads, after a confirmation prompt.

### Changed

- Cache and price-tracking sub-options are now disabled while their feature is turned off,
  so there are no settings that quietly do nothing.

### Fixed

- The Purity column now hides correctly when auto-hide is on and no result has a grade or
  purity value (previously it stayed visible even when empty).
- The price Trend and Change columns now auto-hide when a result set has no price-history
  data (e.g. a first-time search), and come back when it does — they no longer stay stuck
  visible-but-empty.

## [1.7.0] - 2026-08-01

### Added

- **Report a bug** from the About dialog, the quick-actions menu, and Settings. It opens a
  prefilled report — a GitHub issue, or an account-free Google form — with helpful diagnostics
  already filled in for you to review and edit. Nothing is sent until you submit it yourself.
- A **Report Error** option now appears if ChemPal hits an unexpected error, so you can send
  the details in a couple of clicks instead of hitting a dead end.
- Lightweight usage and error analytics (searches run, result counts, and crashes) to help
  prioritize fixes and improvements. No accounts and no personal data.

### Changed

- Updated the **privacy policy** to cover the new usage/error analytics and the bug‑reporting
  flow — what's sent, to whom, and what stays on your device.

## [1.6.1] - 2026-07-28

### Added

- New supplier: **Albo Chemicals**.
- A gentle **review prompt** for long-time, active users, with a one-click link to leave a
  review — and no repeat nagging once you've responded.
- New advanced setting to override each supplier's **search-time budget** (leave empty for
  the default, or set `0` to remove the limit).

### Changed

- Settings now show your cache lifetime in days and how many suppliers are excluded or
  disabled at a glance.

### Fixed

- Choosing **Later** on the "update available" prompt now keeps it hidden across popup
  reopens and refreshes, instead of reappearing right away. (The **✕** still dismisses a
  version for good.)

## [1.6.0] - 2026-07-26

### Added

- New **Price Trend** column in the results table (opt-in via the column menu): a small graph
  of a product's recorded price history, colored green when the price is trending down and red
  when up. Hover it for the exact change.
- New **Clear all filters** button in the advanced-search drawer.

### Changed

- Advanced-search filters now work together: choosing a shipping type or country greys out —
  and stops searching — suppliers that can't match, and selecting suppliers greys out shipping
  and country options they can't fulfill. Shipping scope is treated as a hierarchy, so a
  worldwide supplier also counts as international, domestic, and local.
- The advanced-search and column-filter buttons now highlight when filters are active and show
  how many on hover.

### Fixed

- The **Availability** search filter no longer hides every result.
- Your page and rows-per-page are now remembered when you reload.
- When a search or its filters return nothing, the table now explains why and offers a
  one-click way to retry without filters or clear the column filters.

## [1.5.0] - 2026-07-24

### Added

- New **Unit Price** column in the results table showing the price per base unit (e.g.
  `$0.08/g`, `$0.005/mL`, `$19.99/pcs`), so listings of different sizes can be compared at a
  glance. Always uses the same base unit per measure (grams, millilitres) so the column
  sorts correctly.
- New **Group product variants** display setting (on by default). Turn it off to give each
  product variant its own row in the results table, so sorting or filtering by price,
  quantity, or unit price ranks every variant across all suppliers at once — expanding a
  variant row links back to its main product.
- New supplier: ScienceLab.
- Improved the search by CAS number, molecular formula, or SMILES on suppliers that only
  search by product name: the identifier is looked up on PubChem and the resulting chemical
  name is searched instead, so e.g. "Na6O18P6" or "10124-56-8" now finds Sodium
  Hexametaphosphate.

### Changed

- Clicking a product image now opens an in-page gallery — a larger view with next/previous
  arrows and a thumbnail strip to jump between photos — instead of opening the image in a new
  browser tab.

## [1.4.0] - 2026-07-21

### Added

- Suppliers that restrict shipping on their own website but ship more freely through their eBay
  or Amazon store now say so in the expanded product row, with a link to the store.
- Suppliers that list extra products on their eBay or Amazon store now note it in the expanded
  product row, with a link to the store.
- New supplier: Daily Bio USA.
- New supplier: Orbit Natural Product Derivatives.
- New supplier: Consolidated Chemicals & Solvents
- Export search results to an Excel (.xlsx) file from the results right-click menu, with past exports saved to the History tab for re-download.

### Changed

- Search now matches product titles more leniently by default, so relevant products are less likely to be filtered out.
- Re-enabling Chemsavers as an Amazon restricted supplier

### Fixed

- Chemical grades written as a labeled field (for example `Grade: Reagent`) in a product
  description were not detected, so those products showed as **Ungraded**.
- Liter-sized products (for example `1 LITER`) were not always recognized, so their pack size
  could be dropped.

## [1.3.0] - 2026-07-19

### Added

- Update prompt: ChemPal now tells you when a newer version is available, with a
  **What's new** summary of the release. Web Store installs can apply the staged
  update straight from the prompt; manual installs get a link to the release.
- After updating, ChemPal shows what changed in the version you moved onto.

### Fixed

- The About panel's update check reported "up to date" when a newer version was
  actually available, and vice versa.
- Search logic: The search logic has been improved after rigorous testing and should
  yield more suitable results.
- I18n updates/fixes for multiple languages.
- Rendering issues for smaller screens resolved.

## [1.2.0] - 2026-07-18

### Added

- Options page for configuring ChemPal outside the popup.
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
