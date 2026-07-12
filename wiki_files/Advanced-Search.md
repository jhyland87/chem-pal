# Advanced (Boolean) Search

The home search bar isn't just for single terms — it understands **boolean logic**.
Combine words with `AND`, `OR`, and `NOT`, group them with parentheses, and match
exact phrases with quotes. This lets you cast a wide net or zero in precisely,
all in one query.

## Operators

| Operator | Meaning | Example |
|----------|---------|---------|
| `AND` | Both terms must match | `sodium AND hydroxide` |
| `OR` | Either term may match | `sodium OR potassium` |
| `NOT` | Exclude a term | `borohydride NOT triacetoxyborohydride` |
| `( )` | Group terms | `(sodium OR potassium) AND hydroxide` |
| `"…"` | Match an exact phrase | `"sodium borohydride"` |

Operators are **case-insensitive** (`and`, `And`, `AND` all work). To exclude
something, use `NOT` — there's no `-term` shorthand.

### Examples

```
(sodium OR potassium) AND (carbonate OR hydroxide)
"sodium borohydride" AND NOT triacetoxyborohydride
```

## Live syntax highlighting

The moment your query contains an operator or a parenthesis, the search bar turns
on **color highlighting** so you can see its structure at a glance:

- **Operators** (`AND` / `OR` / `NOT`) are tinted purple.
- **Parentheses** are colored by nesting depth — each matching pair shares a color,
  so it's easy to see which brackets go together.
- **Terms** are tinted by type (name, CAS, formula, SMILES), just like in a simple
  search — see [Search Types](Search-Types).

![Highlighted query: (sodium OR potassium) hydroxide](images/ast-query-sodium-or-potassium-hydroxide.png)

![Highlighted query mixing a name and a SMILES string](images/ast-query-acetic-acid-or-smiles.png)

![Highlighted query combining two CAS numbers](images/ast-query-cas-or-cas.png)

## When a query isn't valid

ChemPal checks your query as you type and, if something's off, shows a short
message below the bar and disables the search button until it's fixed:

| Message | What it means |
|---------|---------------|
| **"Unbalanced parentheses."** | You have more `(` than `)` or vice-versa. |
| **"Invalid advanced query syntax."** | The boolean expression can't be parsed — check operator placement. |
| **"Add at least one term to include — a query of only exclusions matches everything."** | A query made up entirely of `NOT` terms has nothing to include. Add a positive term. |
| **"Invalid query."** | A catch-all for a query ChemPal can't run. |

## How advanced search actually runs

You don't need to know the internals, but it helps to know the behavior:

- Some suppliers can run your boolean query directly on their own site.
- Others only accept plain keywords — for those, ChemPal runs a search for each
  positive term in your query and then combines the results.
- In **every** case, ChemPal applies your full `AND` / `OR` / `NOT` logic to the
  combined results, so what you see always respects the query you wrote.

> **Tip:** If you'd rather see *every* raw match without ChemPal's relevance
> ranking, turn on **Settings → Advanced → "Disable fuzzy filtering"**. In advanced
> search this shows all results that satisfy your boolean logic, unranked.

---

**Next:** [Search Filters →](Search-Filters)
