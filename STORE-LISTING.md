# Chrome Web Store — listing & review reference

Internal reference for submitting/resubmitting ChemPal to the Chrome Web Store.
Not published anywhere (kept out of `pages/`, so TypeDoc doesn't render it).

## Settings page

- **Publisher contact email:** `jhyland87@gmail.com` — must be entered **and verified**
  (Chrome emails a verification link) before the item can be published.
- **Privacy policy URL:** `https://jhyland87.github.io/chem-pal/documents/PRIVACY.html`
  (generated from [`pages/PRIVACY.md`](pages/PRIVACY.md) by `pnpm docs`; also compiled into the
  build as `__APP_PRIVACY__` from `package.json` → `config.links.privacy`). Regenerate and
  publish the docs site before submitting so the URL is live.

## Privacy practices tab

### Single purpose description

> ChemPal is a price-comparison tool for laboratory chemicals and reagents. Its single purpose
> is to let a user search for a chemical product, retrieve current listings and prices from
> multiple chemical-supplier websites, normalize them (converting currencies and standardizing
> package quantities), and display the results side by side so the user can find the best
> available price.

### Permission justifications

**storage**
> Stores the user's own settings (currency, language, font size, selected suppliers), search
> history, saved favorites, and a short-lived local cache of recent search results using
> chrome.storage. This lets ChemPal remember preferences between sessions and avoid re-running
> identical searches. All data stays on the user's device; nothing is sent to a server we control.

**tabs**
> Used to open ChemPal's full-page view in a browser tab and to focus an already-open ChemPal tab
> instead of opening a duplicate. chrome.tabs.query is used only to locate ChemPal's own tab by
> matching the extension's URL. ChemPal does not read the content or browsing history of the
> user's other tabs.

**contextMenus**
> Adds a single right-click menu item, "Search selection in ChemPal," shown when the user has text
> selected. Choosing it sends the selected text to ChemPal as a search query and opens the app.
> Used only for this user-initiated shortcut.

**bookmarks**
> Lets the user save a chemical product listing as a browser bookmark from ChemPal. It creates a
> "ChemPal" bookmark folder and adds the selected product's page to it
> (chrome.bookmarks.create/getTree/getChildren). ChemPal only reads and writes its own folder for
> user-initiated saves; it does not modify or transmit the user's existing bookmarks.

**cookies**
> Several supplier websites require a valid session cookie on their own domain before their
> search/price endpoint returns results. Before querying those suppliers, ChemPal seeds the
> required session cookie for that supplier's domain (chrome.cookies.set) and reads back cookies
> it set, scoped to the supplier domains declared in host permissions. Cookies are used solely to
> complete price lookups on the supplier sites the user is searching; ChemPal does not read
> cookies for unrelated sites and does not transmit cookie data anywhere.

**Host permission use**
> ChemPal fetches public product-search and pricing pages/APIs directly from the
> laboratory-chemical supplier and marketplace domains the user chooses to search (the specific
> domains listed in host_permissions), plus PubChem (NIH) for compound identifiers. Access is
> limited to these named supplier and reference domains — there is no all-URLs or broad-host
> access. It is required so the extension can retrieve and compare live prices. Requests are made
> from the extension's own pages and service worker, and every response is parsed as data only.

**Remote code** — Select **"No, I am not using remote code."** CSP is
`script-src 'self'; object-src 'self'` (no `unsafe-eval`, no remote origins), and all fetched
supplier content is parsed as data (`DOMParser`/`JSON.parse`), never executed. If the scanner
pushes back (it can flag an inert `new Function` string in a bundled dependency):

> ChemPal does not download or execute any remotely-hosted code. Its content security policy is
> "script-src 'self'; object-src 'self'" with no unsafe-eval and no remote origins. All network
> responses are consumed strictly as data (parsed with DOMParser or JSON.parse) and never
> evaluated or executed.

### Data usage certification

Check the certification boxes yourself. Declare that ChemPal does **not** collect or sell
personal data; the only data leaving the device is the search term, sent to the supplier sites
the user explicitly searches, to fetch prices.
