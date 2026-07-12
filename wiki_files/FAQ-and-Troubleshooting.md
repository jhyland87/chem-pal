# FAQ & Troubleshooting

Common questions and quick fixes. If none of these help, see
[reporting an issue](#reporting-a-problem).

## Searching

**My search returned no results.**
Try a different form of the query. Names vary between suppliers, so searching by
**CAS number** often finds products a name misses. When a search is empty, ChemPal
may also suggest a term — click the suggestion to try it. See
[Search Types](Search-Types).

**A product I know exists isn't showing up.**
A few possibilities:
- The supplier that carries it might be **disabled** — check **Settings → Supplier
  Status** and the **Search Suppliers** filter.
- You might have **"Only suppliers that ship to my location"** on, hiding vendors
  that don't ship to you.
- You may have **ignored** it before — check **Settings → Excluded Products**.
- The **Results Limit** (in the [Search Filters](Search-Filters) panel) may be low;
  raise it to pull more results per supplier.

**My advanced query won't run / the search button is greyed out.**
ChemPal shows a message under the bar explaining why — usually unbalanced
parentheses or invalid boolean syntax. See
[Advanced Search](Advanced-Search#when-a-query-isnt-valid).

**Searches feel slow.**
ChemPal queries many suppliers live and some sites are slower than others. To speed
things up: lower the **Results Limit**, search **fewer suppliers**, keep
[caching](Caching) on, or lower **Settings → Advanced → Max search time**. Results
also stream in as they arrive — you can start reading (or hit **Cancel Search**)
before every supplier finishes.

## Prices & data

**A price looks wrong or out of date.**
Prices come straight from suppliers and can change anytime. You may also be seeing a
[cached](Caching) result — click **Clear cache** (or set a **Cache TTL**) to refresh.
Always confirm the price on the supplier's own page before buying.

**A converted price seems off.**
Currency conversion uses live exchange rates and is an estimate; you pay the
supplier's price in their currency at checkout. See
[Prices & Currency](Prices-and-Currency).

## Firefox

**ChemPal disappeared after I restarted Firefox.**
Temporary add-ons are removed when Firefox restarts. Re-load the `.zip` via
`about:debugging` to use it again. See [Installation](Installation). A permanently
installable signed version isn't available yet.

## Managing your data

**How do I clear things?**
- Cached results → **Settings → Cache → Clear cache** ([Caching](Caching))
- Price history → **Settings → Price History → Clear price history** ([Price Tracking](Price-Tracking))
- Search history → **History tab → trash icon** ([Search History](Search-History))
- Ignored products → **Settings → Excluded Products → Clear All**
- Everything to defaults → **Settings → Actions → Restore Defaults**

**Where is my data stored? Does the developer see it?**
It's all stored locally in your browser and never sent to the developer. See
[Privacy](Privacy).

## Reporting a problem

Found a bug, a supplier that stopped working, or want to request a feature? Open an
issue on the [GitHub issue tracker](https://github.com/jhyland87/chem-pal/issues).

---

**Related:** [Installation](Installation) · [Settings](Settings) · [Privacy](Privacy)
