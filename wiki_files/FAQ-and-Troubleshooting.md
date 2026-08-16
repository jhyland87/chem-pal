Common questions and quick fixes. If none of these help, see
[reporting an issue](#reporting-a-problem).

## Questions

_**Why is this a browser extension?**_

There are several benefits to running the search from your browser via a browser
extension as opposed to a downloadable app, server side app or hosted web page.
1. A hosted web page would be limited by CORS (Cross-Origin Resource Sharing)
   violations that would prevent the vast majority of the supplier requests
   from going through.
2. A server side application would mean all the traffic would be coming from
   one location, which would certainly look suspicious to services such as
   DataDome and Cloudflare, making web requests more complicated. Plus, this
   is a free and open source application, there was no desire to pay for hosting
   services if there's no goal to monetize the extension.
3. The initial POC for ChemPal was actually a Python application that you would
   download/setup locally, called [ChemPare](https://github.com/jhyland87/ChemPare).
   This was more feasible than a server side app or hosted client side app, but
   when we tested using a browser extension, we realized that the web requests
   getting sent from your browser actually resolves the majority of the issues
   we were encountering like setting up the right cookies, dealing with Cloudflare
   or DataDome, saving session data, etc.

_**How do I report an issue?**_

The easiest way is from inside ChemPal. Use **Report a bug** — in the **About**
dialog, the **quick-actions menu**, or **Settings → Actions** — or the **Report
Error** button that appears if the extension hits an unexpected error. It opens a
prefilled report with helpful diagnostics already filled in (the extension version,
your browser, and any recent error details) and offers two ways to send it: a
**GitHub issue**, or an **account-free Google form** for those without a GitHub
account. Nothing is submitted automatically — you review, edit, and send it
yourself, and can remove anything first.

You can still open a [new issue](https://github.com/jhyland87/chem-pal/issues/new)
directly (add the `bug` label) or email
[chempalsupport@gmail.com](mailto:chempalsupport@gmail.com). A tracked GitHub issue
is our preferred method, but not everyone has a GitHub account.

_**How do I submit a feature request or enhancement?**_

You can do this using the same procedure as reporting a bug, except if done via Github, you
should use the `enhancement` label instead.

_**How do I share other feedback?**_

When you **uninstall** ChemPal, a short, optional **feedback form** opens in your
browser — a quick way to tell us what worked, what didn't, and what would bring you
back. It's completely optional and anonymous, and it's often the most helpful thing
you can leave us if ChemPal wasn't a fit.



## Searching

_**My search returned no results.**_

Try a different form of the query. Names vary between suppliers, so searching by
**CAS number** often finds products a name misses. When a search is empty, ChemPal
may also suggest a term — click the suggestion to try it. See
[Search Types](Search-Types).

_**A product I know exists isn't showing up.**_

A few possibilities:
- The supplier that carries it might be **disabled** — check **Settings → Supplier
  Status** and the **Search Suppliers** filter.
- You might have **"Only suppliers that ship to my location"** on, hiding vendors
  that don't ship to you.
- You may have **ignored** it before — check **Settings → Excluded Products**.
- The **Results Limit** (in the [Search Filters](Search-Filters) panel) may be low;
  raise it to pull more results per supplier.

_**My advanced query won't run / the search button is greyed out.**_

ChemPal shows a message under the bar explaining why — usually unbalanced
parentheses or invalid boolean syntax. See
[Advanced Search](Advanced-Search#when-a-query-isnt-valid).

_**Searches feel slow.**_

ChemPal queries many suppliers live and some sites are slower than others. To speed
things up: lower the **Results Limit**, search **fewer suppliers**, keep
[caching](Caching) on, or lower **Settings → Advanced → Max search time**. Results
also stream in as they arrive — you can start reading (or hit **Cancel Search**)
before every supplier finishes.

## Prices & data

_**A price looks wrong or out of date.**_

Prices come straight from suppliers and can change anytime. You may also be seeing a
[cached](Caching) result — click **Clear cache** (or set a **Cache TTL**) to refresh.
Always confirm the price on the supplier's own page before buying.

_**A converted price seems off.**_

Currency conversion uses live exchange rates and is an estimate; you pay the
supplier's price in their currency at checkout. See
[Prices & Currency](Prices-and-Currency).

## Firefox

_**ChemPal disappeared after I restarted Firefox.**_

Temporary add-ons are removed when Firefox restarts. Re-load the `.zip` via
`about:debugging` to use it again. See [Installation](Installation). A permanently
installable signed version isn't available yet.

## Managing your data

_**How do I clear things?**_

- Cached results → **Settings → Cache → Clear cache** ([Caching](Caching))
- Price history → **Settings → Price History → Clear price history** ([Price Tracking](Price-Tracking))
- Search history → **History tab → trash icon** ([Search History](Search-History))
- Ignored products → **Settings → Excluded Products → Clear All**
- Everything to defaults → **Settings → Actions → Restore Defaults**

_**Where is my data stored? Does the developer see it?**_

It's all stored locally in your browser and never sent to the developer. See
[Privacy](Privacy).

_**Does ChemPal track my data?**_

ChemPal sends basic, anonymous usage statistics to PostHog — which
searches are run, how many results they return, and when the extension hits an
error — tied only to a random identifier, never your name or an account. There are
no ads and no cross-site tracking, and your searches, history, and settings stay on
your device. You can turn this off anytime under **Settings → Behavior → Share
anonymous usage data**. See [Privacy](Privacy).

## Reporting a problem

Found a bug, a supplier that stopped working, or want to request a feature? Open an
issue on the [GitHub issue tracker](https://github.com/jhyland87/chem-pal/issues).

---

**Related:** [Installation](Installation) · [Settings](Settings) · [Privacy](Privacy)
