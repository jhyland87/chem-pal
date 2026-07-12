ChemPal is built to stay out of your business. There's **no account, no sign-up,
and no data collection by the developer**.

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

ChemPal doesn't route this through the developer — the requests go directly from
your browser to those services.

## Full policy

For the complete details of what stays local and what is sent where, read the
[Privacy Policy](https://github.com/jhyland87/chem-pal/blob/main/pages/PRIVACY.md).

---

**Related:** [Settings](Settings) · [FAQ & Troubleshooting](FAQ-and-Troubleshooting)
