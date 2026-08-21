ChemPal is built to stay out of your business. There's **no account and no
sign-up**, and the developer runs no server. The only usage data collected is
basic, aggregate analytics through PostHog — tied to a random identifier,
never your name or an account (see [What leaves your device](#what-leaves-your-device)).

## What stays on your device

Everything ChemPal remembers is stored **locally in your browser** and never sent
to the developer:

- Your [settings](Settings) (currency, location, enabled suppliers, theme, etc.)
- Your [search history](Search-History)
- Your [price history](Price-Tracking)
- Cached [search results](Caching)
- Your [excluded products](Results-Table#ignored-excluded-products)

You can clear any of it yourself at any time — see [Caching](Caching),
[Price Tracking](Price-Tracking), and [Search History](Search-History).

## What leaves your device

To search, ChemPal has to talk to the outside world — the same way your browser
does when you visit a website:

- **Supplier websites** — your search term is sent to each enabled supplier so they
  can return matching products. This is exactly what would happen if you searched
  each site yourself.
- **PubChem** — used to look up chemical details and suggest alternative search
  terms when a search finds nothing.
- **Exchange-rate service** — used to convert supplier prices into your chosen
  currency.
- **PostHog** — basic usage and error stats (which searches are run, how
  many results they return, when the extension is installed or updated, and when
  it hits an error), tied only to a random identifier — no account, no name.
- **Bug reports** — only if you use **Report a bug** / **Report Error**, which open
  a prefilled GitHub issue or Google form for you to review and submit yourself.
  Nothing is sent automatically.

ChemPal doesn't route your searches through the developer — those requests go
directly from your browser to those services.

## Full policy

For the complete details of what stays local and what is sent where, read the
[Privacy Policy](https://github.com/jhyland87/chem-pal/blob/main/pages/PRIVACY.md).

---

**Related:** [Terms of Service](Terms-of-Service) · [Settings](Settings) · [FAQ & Troubleshooting](FAQ-and-Troubleshooting)
