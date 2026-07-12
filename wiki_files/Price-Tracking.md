ChemPal quietly remembers the prices it sees, so over time you can tell whether a
product is getting cheaper or more expensive — and time your purchase accordingly.

## How it works

- **It's automatic.** Every time a product shows up in your search results,
  ChemPal records its price (converted to USD for a consistent baseline).
- **It only records changes.** A new data point is saved when the price actually
  differs from the last one, so the history stays meaningful rather than a flat
  line of identical values.
- **It's on by default.** No setup needed.

## Where you see it

Open a product's [detail panel](Results-Table#product-details) (click the **▸
arrow** on its row). If ChemPal has seen the product more than once, you'll find a
**Price history** section showing:

- A **sparkline** — a tiny line chart of the price over time.
- A **trend indicator** — an arrow and percentage. **Rising prices show in red**,
  **falling prices in green**.
- A **point count** (e.g. "5 points") telling you how much history exists.

If tracking is on but ChemPal has only seen the product once, it shows **"No
history yet"** — check back after future searches.

Products with **variants** (multiple sizes) keep a separate history per variant,
so you can see which size is trending up or down.


![an expanded product row with the price-history, sparkline and a red/green trend indicator.](images/search-results-variant-trends.png)

Variant price trend history available on hover.

![Variant price trend history available on hover](images/variant-price-trend-history.png)

## Turning it off or clearing it

Everything lives under **Settings → Price History**:

- **"Track price history"** — the master switch. Turn it off to stop recording.
- **"Max price points per product"** — cap how many data points to keep per product
  (`0` = unlimited).
- **"Clear price history"** — wipe all recorded history. This is separate from
  [clearing the cache](Caching) — clearing the cache does **not** erase your price
  history, and vice-versa.

All of this data stays **on your device** — see [Privacy](Privacy).

---

**Next:** [Search History →](Search-History)
