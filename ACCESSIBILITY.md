# Accessibility

ChemPal is a browser extension for comparing chemical supplier prices, and it should be
usable by everyone who needs it. This document describes what we aim for, what works
today, where the gaps are, and how to report a barrier. It describes current behavior; it
is **not** a claim of formal conformance, and ChemPal has not had a third-party
accessibility audit.

## Priorities

We treat [WCAG 2.2](https://www.w3.org/TR/WCAG22/) Level AA as an aspirational target, not
a verified result. In practice that means focusing on:

- **Keyboard support.** Every control reachable and operable without a mouse.
- **Screen reader compatibility.** Meaningful names, roles, and announcements.
- **Readable content.** Text that scales, adequate contrast, and light/dark themes.
- **Translations.** The interface is available in 7 languages (see below).
- **Motion.** Animation respects the system "reduce motion" setting.

### What exists today

**Keyboard**
- Standard controls (buttons, tabs, menus, form fields, dialogs) work with
  <kbd>Tab</kbd> / <kbd>Shift</kbd>+<kbd>Tab</kbd>, <kbd>Enter</kbd> and <kbd>Space</kbd>.
- Open ChemPal with <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>Y</kbd> (<kbd>⌘</kbd>+<kbd>Shift</kbd>+<kbd>Y</kbd> on
  Mac). It is a browser-level command, rebindable at `chrome://extensions/shortcuts`.
- Type `chem` then a space in the address bar to search from the omnibox.
- Press <kbd>Shift</kbd>+<kbd>?</kbd> in the app for the full list of in-app hotkeys
  (navigation, search, filtering, expanding rows, aborting a search, and more). Hotkeys
  are ignored while you type in a text field.

**Screen readers and ARIA**
- The UI is built on [MUI](https://mui.com/), which supplies semantic HTML and ARIA for
  standard components.
- Icon-only controls carry translated `aria-label`s, so they are announced in the
  selected language.
- Fields and panels are tied to labels with `aria-labelledby` / `aria-describedby`.
- Dialogs use `role="dialog"` with `aria-modal`; tab panels use `role="tabpanel"`;
  status and error messages use `role="status"` / `role="alert"` so they are announced
  without moving focus.
- Loading indicators are labelled, and decorative graphics are hidden with `aria-hidden`.

**Visual**
- Light and dark themes, switched from the floating speed-dial menu (**Toggle Theme**).
  The toolbar icon also follows the system light/dark setting.
- The animated molecule loading spinner honors `prefers-reduced-motion`.
- ChemPal opens as a popup or in a full browser tab; browser zoom works in both.

**Languages**

| Language | Code |
| --- | --- |
| English | `en` |
| German (Deutsch) | `de` |
| Spanish (Español) | `es` |
| Finnish (Suomi) | `fi` |
| Hindi (हिन्दी) | `hi` |
| Polish (Polski) | `pl` |
| Russian (Русский) | `ru` |

All seven have the same complete set of strings; change the language under
**Settings → Language**. All are left-to-right. Supplier product names and descriptions
come from the suppliers' sites and appear in the supplier's own language.

## Supported environments

ChemPal is built mainly for **Google Chrome and Chromium-based browsers** (Edge, Brave,
Opera, Vivaldi, and similar). That is where it is developed, tested, and published.

| Environment | Status |
| --- | --- |
| Chrome and Chromium browsers | **Primary.** Installed from the [Chrome Web Store](https://chromewebstore.google.com/detail/facakdliomkjhegdhjimfjlcggfnpfnd); covered by unit and end-to-end tests that drive the real extension. |
| Firefox | **Secondary.** Works as a temporary add-on, but automated testing is a load smoke test only, so expect less accessibility coverage. |
| Safari and others | Not supported. |

Assistive technology is not tested against a fixed matrix of screen readers and versions.
Your browser's own accessibility features (zoom, forced colors, caret browsing,
screen-reader integration) apply to ChemPal because it runs inside the browser. If you
find a combination that fails, please tell us which one.

## Contributor expectations

When changing UI or user-facing text:

- Give every interactive element an accessible name; add the label to **all 7 locales**.
- Check that the change works with the keyboard alone, including focus order and focus
  visibility.
- Don't convey information by color alone, and keep text readable in both themes.
- Mark purely decorative graphics `aria-hidden`; give meaningful ones a text alternative.
- Respect `prefers-reduced-motion` for any new animation.
- Prefer MUI's built-in accessible components over custom-built controls.

## Reporting accessibility issues

If something in ChemPal is hard or impossible to use,
[open an issue](https://github.com/jhyland87/chem-pal/issues/new/choose). You don't need to
share anything personal, such as a disability. Please include:

- your browser, its version, and your operating system;
- any assistive technology in use (screen reader, magnifier, voice control) and its version;
- what you were trying to do, what happened, and what you expected.

Accessibility reports are treated as bugs, not feature requests.

## Severity

| Level | Meaning | Example |
| --- | --- | --- |
| **Critical** | Blocks a core task entirely for some users | Search can't be submitted by keyboard |
| **Serious** | The task is possible only with major difficulty or a workaround | Results table controls have no accessible names |
| **Moderate** | Causes friction or confusion but doesn't stop the task | Confusing focus order in a dialog |
| **Minor** | Small inconvenience or polish | A missing label on a rarely used control |

## How we respond

We will acknowledge a report promptly, suggest a workaround where one exists, post status
updates on the issue, and thank you for reporting it.

## Resolution expectations

These are targets, not guarantees. ChemPal is maintained by one person.

| Severity | Target |
| --- | --- |
| Critical | 30 days |
| Serious | 60 days |
| Moderate / Minor | 90 days |

## Ownership and maintenance

The maintainer, [@jhyland87](https://github.com/jhyland87), triages accessibility issues,
tracks them to resolution, and keeps this document current as the app changes.

## Known limitations

- The results table is large and data-dense; it is usable by screen reader and keyboard
  but not streamlined.
- The popup has a fixed, small viewport. Use the full-tab view for more room.
- Color contrast follows the MUI theme and custom palette and has not been systematically
  verified against WCAG ratios in both themes.
- Supplier-provided content (names, descriptions, linked SDS/TDS/COA documents) is outside
  ChemPal's control and may not be accessible.
- The animated molecule graphic shown while loading is decorative and is hidden from
  assistive technology.
- Right-to-left languages are not supported.

## Feedback

Ideas for making ChemPal more accessible are welcome as
[issues](https://github.com/jhyland87/chem-pal/issues/new/choose) or pull requests.
