# ChemPal — Privacy Policy

**Effective date:** August 16, 2026

ChemPal ("the extension") is a browser extension that lets you search and compare
laboratory chemical product listings across supported supplier websites. This
policy explains what data the extension handles, where it goes, and why.

**Short version:** ChemPal has no backend server of its own, shows no ads, and
never sells your data. It does use PostHog, an independent product‑analytics
service, to collect basic usage and
error statistics — which searches are run, how many results they return, when the
extension is installed or updated, and when it hits an error — associated with an
identifier derived from a few basic characteristics of your device (never your
name or an account), plus a short‑lived identifier grouping activity within one
browser session. Beyond that, the data that leaves your
browser is the search terms and chemical identifiers you enter, sent directly to
the third‑party supplier and public chemistry services you choose to search — the
same way your browser would send them if you visited those sites yourself.

---

## 1. Who provides this extension

ChemPal is an independent, open‑source project maintained by Justin Hyland.
There is no company, hosted service, or third‑party data processor operated by
the developer.

- Source code: https://github.com/jhyland87/chem-pal
- Contact: jhyland87@gmail.com

---

## 2. Data the extension handles

### 2.1 Search terms and chemical identifiers (sent to third parties)

When you run a search, the extension sends your query — a product name, CAS
number, chemical formula, or similar identifier — directly to the supplier
websites and public chemistry services you have enabled, in order to retrieve
and display matching product listings and pricing.

Because these are ordinary web requests, the receiving third party also sees the
standard technical information any website receives (such as your IP address and
browser user‑agent). ChemPal does not add any identifier of its own to these
requests. The developer does not receive, log, or store your searches.

### 2.2 Cookies on supplier domains

Some suppliers require an active session to return search results. For those
suppliers, the extension reads and sets cookies **on that supplier's own domain**
solely to establish the session needed to perform your search. These cookies are
used only for the supplier's normal site functionality; the extension does not
use cookies to profile or track you, and does not share cookie data with the
developer or any unrelated party.

### 2.3 Data stored locally in your browser

The extension stores the following **locally on your device** (via the browser's
extension storage and IndexedDB). This data never leaves your browser and is not
transmitted to the developer:

- **Settings and preferences** — theme, enabled suppliers, display options, and
  similar configuration.
- **Favorites** — products you save for later.
- **Search and price history** — recent searches and price snapshots used to show
  price trends.

### 2.4 Bookmarks

If you save a product as a favorite, the extension may create and use a bookmarks
folder (e.g. "ChemPal Favorites") in your browser to store it. The extension
accesses your bookmarks only to provide this feature and does not read or transmit
your other bookmarks to any external party.

### 2.5 Browser tab information

The extension reads limited information about your current browser tab (such as
the page URL) to provide context for opening product pages, search selections, and
related links. This information is used only at the moment you take an action and
is not logged or transmitted to the developer.

### 2.6 Usage and error analytics (sent to PostHog)

ChemPal uses PostHog, an independent product‑analytics service, to understand how
the extension is used, so the developer can prioritize fixes and improvements. It
sends an event to PostHog when you:

- **run a search** — including the search term you entered, the number of results
  it returned, how long the search took, and how many suppliers it queried;
- **stop a search early** — when you cancel a search, or it runs out of time,
  including why it ended along with the same details as above;
- **encounter an error** — including the extension version, the error type, and a
  short, truncated error message (no stack traces); and
- **install or update the extension** — including the version installed, and the
  version you upgraded from when it is an update.

These events are associated with two identifiers, neither of which is your name,
email, or account:

- A **device identifier**, computed from a handful of basic, common technical
  characteristics of your browser and device (such as the number of processor
  cores and general platform). It is not stored — it is recalculated the same
  way each time — so it stays the same across normal use and even if you
  reinstall the extension. Because it stays the same over time, PostHog links
  events under it into a single ongoing record (what PostHog calls a "person"),
  which is how the developer can see, for example, that a given install hit the
  same error repeatedly. The characteristics used are common enough that
  different installs with similar hardware may share the same identifier — it
  is not precise enough to reliably single out one specific device.
- A **session identifier**, which changes every time you close and reopen your
  browser (or after about a day of continuous use), used only to group events
  from the same browsing session together.

The extension loads no advertising or third‑party tracking code, and does not
use these identifiers for advertising or to build any profile beyond the usage
and error statistics described above. As with any web request, PostHog also
receives standard technical information such as your IP address, from which it
derives an approximate country or region, and which it processes under its own
privacy policy.

### 2.7 Bug reports (only when you choose to send one)

If you use the **Report a bug** or **Report Error** actions, ChemPal opens a
prefilled GitHub issue or Google Form in a new browser tab. The prefill includes
diagnostic details — such as the extension version, your browser and operating
system, and recent error messages captured on your device — to help diagnose the
problem. **Nothing is submitted automatically:** the report opens for you to
review and edit, you send it under your own GitHub or Google account, and you can
remove anything first or simply close the tab.

---

## 3. Third‑party services the extension contacts

Depending on which suppliers you enable and which features you use, the extension
may send requests to:

- **Chemical supplier websites and their search/product APIs** — to retrieve
  product listings and pricing for your query. Each supplier receives only the
  search you direct at it.
- **Public chemistry databases** — the U.S. National Institutes of Health services
  PubChem (`pubchem.ncbi.nlm.nih.gov`) and the CACTUS chemical resolver
  (`cactus.nci.nih.gov`) — to resolve chemical names, CAS numbers, and formulas.
  Only the chemical identifier you are looking up is sent.
- **A currency exchange‑rate service** — to convert supplier prices into your
  chosen currency. Only the rate request is sent; none of your personal data is
  included.
- **GitHub** (`api.github.com`) — to check whether a newer version of the
  extension is available. No personal data is sent.
- **PostHog** (`us.i.posthog.com`) — to collect the usage and
  error statistics described in section 2.6, tied to the device and session
  identifiers described there.
- **GitHub or Google Forms** — only if you choose to submit a bug report
  (section 2.7), and only with the details you review and send yourself.

Each of these third parties handles the data it receives under its own privacy
policy. ChemPal has no control over, and takes no responsibility for, the data
practices of these independent services.

---

## 4. What the extension does NOT do

- It does **not** run its own server or transmit your data to a developer‑operated
  backend (there is none); the usage and error statistics in section 2.6 go to
  PostHog.
- It does **not** show advertising, use advertising or cross‑site tracking SDKs,
  or sell or share your data for advertising or any unrelated purpose.
- It does **not** collect personal information such as your name, email address,
  or payment details. The analytics device identifier (section 2.6) is derived
  from basic technical characteristics of your device, not from anything you
  enter or any account, and is shared by any install with similar hardware.
- It does **not** submit bug reports automatically — that happens only when you
  choose to, and only with the details you review and send.

---

## 5. Permissions and why they are used

| Permission | Why the extension requests it |
|---|---|
| `storage` | Save your settings, favorites, and search/price history locally. |
| `cookies` | Establish the session cookies certain suppliers require to return search results, on those suppliers' own domains. |
| `bookmarks` | Create and manage the favorites folder used to save products. |
| `tabs` | Read the current tab's context to open product pages and search links, and to power the right‑click "search selection" action. |
| `contextMenus` | Add a right‑click menu item to search selected text with ChemPal. |
| Host permissions (supplier domains, PubChem, etc.) | Send search and lookup requests to the supplier and chemistry services you enable. |

---

## 6. Data retention and deletion

All data the extension keeps is stored locally in your browser. You remain in
control of it at all times:

- Clear favorites, history, and settings from within the extension's settings.
- Remove all locally stored data by uninstalling the extension. The one
  exception is the analytics device identifier (section 2.6): since it is
  recalculated from device characteristics rather than stored, uninstalling
  does not change it — reinstalling produces the same identifier again.
- Cookies set on supplier domains can be cleared through your browser's normal
  cookie/site‑data controls.

Because the developer never receives your data, there is nothing for the developer
to retain or delete on your behalf. If you'd like the analytics history tied to
your device identifier deleted, contact the developer (section 9).

---

## 7. Children's privacy

ChemPal is a tool intended for laboratory, educational, and professional use. It
is not directed to children under 13 and does not knowingly collect any
information from them.

---

## 8. Changes to this policy

This policy may be updated as the extension evolves. Material changes will be
reflected by updating the effective date above and publishing the revised policy
in the extension's repository. Continued use of the extension after an update
constitutes acceptance of the revised policy.

---

## 9. Contact

Questions about this policy or the extension's data practices can be directed to:

**Justin Hyland** — jhyland87@gmail.com
https://github.com/jhyland87/chem-pal
