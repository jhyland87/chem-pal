To keep searches fast, ChemPal **remembers recent results**. The first time you
search for something, ChemPal contacts every supplier — which takes a moment.
Search for it again soon after and ChemPal can serve the saved results
**instantly**, without hitting every website a second time.

## What gets cached

- **Search results** — the list of products each supplier returned for a query.
- **Product details** — the deeper information (CAS, formula, documents, etc.)
  ChemPal fetches for individual products.

Your [price history](Price-Tracking), [search history](Search-History), and
[settings](Settings) are stored separately — they are **not** part of the cache and
are not affected when you clear it.

## Why it helps

- **Speed** — repeated and refined searches return in a fraction of the time.
- **Lighter on suppliers** — ChemPal avoids re-requesting the same pages over and
  over, which is friendlier to the vendors' websites.

The cache is kept to a sensible size automatically — older entries are dropped as
new ones come in, so it never grows without bound.

## Keeping results fresh

Cached results are a recent snapshot, not live data. If you want fresher numbers,
you have options in **[Settings](Settings) → Cache**:

- **Cache TTL (minutes)** — set how long results stay valid before ChemPal
  automatically refetches them. `0` (default) means no time-based expiry.
- **Do Not Cache Empty Results** — when on, a supplier that returned nothing isn't
  remembered as empty, so it gets another chance on your next search.
- You can also right-click a single product and choose **Remove Product from
  Cache** to refresh just that one item.

## Clearing the cache

To wipe all cached searches and product details:

1. Open **[Settings](Settings)** (the ⚙️ gear icon).
2. Expand the **Cache** section.
3. Click **Clear cache**. You'll see **"Cache cleared."** to confirm.

Your next search will fetch everything fresh from the suppliers.

> Clearing the cache does **not** erase your [price history](Price-Tracking) — use
> **Settings → Price History → Clear price history** for that.

## Turning caching off

If you'd rather always fetch live results, turn off **Settings → Behavior → Cache
Search Results**. Searches will be slower, but always current. Caching is **on by
default** and recommended for most people.

---

**Related:** [Settings](Settings) · [Speed Dial Menu](Speed-Dial-Menu) · [Price Tracking](Price-Tracking) · [Privacy](Privacy)
