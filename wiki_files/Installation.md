ChemPal runs on **Chrome** and **Firefox**. Chrome users can install directly
from the Chrome Web Store; a Firefox Add-ons (AMO) listing is on the way. You can
also install the latest release directly, or build it yourself.

## Install from the Chrome Web Store (recommended for Chrome)

Install ChemPal from the
[Chrome Web Store](https://chromewebstore.google.com/detail/facakdliomkjhegdhjimfjlcggfnpfnd?utm_source=item-share-cb),
then click **Add to Chrome**. The ChemPal icon appears in your toolbar.

## Install from a release

Grab the latest build from the
[Releases page](https://github.com/jhyland87/chem-pal/releases/latest).

### Chrome

1. Download the **`chem-pal.crx`** asset from the latest release.
2. Open `chrome://extensions`.
3. Turn on **Developer mode** (top-right toggle).
4. Drag the `chem-pal.crx` file onto the page (or click **Load packed** and select it).
5. Confirm the install. The ChemPal icon appears in your toolbar.

### Firefox

1. Download the **`chem-pal-firefox.zip`** asset from the latest release.
2. Open `about:debugging#/runtime/this-firefox`.
3. Click **Load Temporary Add-on…**.
4. Select the downloaded `.zip` (or its `manifest.json`).

> ⚠️ **Firefox note:** Temporary add-ons are removed when Firefox restarts —
> re-load the `.zip` to use ChemPal again. A permanently installable signed
> `.xpi` (via addons.mozilla.org) isn't available yet.

## Build it yourself

If you'd rather build from source, you'll need **Node.js v22.15.0+**, **npm
v10.9.2+**, and **pnpm**.

```bash
git clone https://github.com/jhyland87/chem-pal.git
cd chem-pal
pnpm run setup
pnpm run build          # Chrome build → build/
# or:
pnpm run build:firefox  # Firefox build → build-firefox/
```

**Load the Chrome build:**
1. Open `chrome://extensions` → enable **Developer mode**.
2. Click **Load unpacked** and select the `build/` folder.

**Load the Firefox build:**
1. Open `about:debugging#/runtime/this-firefox` → **Load Temporary Add-on…**.
2. Select `build-firefox/manifest.json`.

> ⚠️ `pnpm run build` produces a **development** build (it includes test tooling
> and source maps). It's fine for personal use, but don't submit it to a store.

## Opening ChemPal

Once installed, there are several ways to open it:

- **Toolbar icon** — click the ChemPal icon to open it as a **popup** (the default).
- **Full browser tab** — turn on **Settings → Display → "Open in a tab"**, and
  clicking the toolbar icon opens ChemPal in a full browser tab instead of the popup.
  You can also click the **open-in-tab** icon (top-right of the search bar) at any
  time to pop the current view out into its own tab.
- **Side panel** — ChemPal can also run in the browser's side panel, so it stays
  open beside the page you're browsing.
- **Right-click** — highlight text on any page and choose
  **Search "…" in Chem Pal** — see [Right-Click Search](Right-Click-Search).

Whichever way you open it, ChemPal remembers your settings and search history.

---

**Next:** [Run your first search →](Searching)
