# typedoc-plugin-taxonomy-index

A project-global index of every `@category` and `@group` in your TypeDoc output.

## Why

TypeDoc computes categories and groups **per container**. `CategoryPlugin` and
`GroupPlugin` walk every `ContainerReflection` and build a fresh map for each one, so
`@category Helpers` in `src/helpers/price.ts` and `@category Helpers` in
`src/utils/text.ts` produce two unrelated `ReflectionCategory` objects on two
different pages. There is no project-wide registry, and no page that answers
"show me everything tagged `Helpers`".

Neither native option closes the gap:

- **`@mergeModuleWith`** does run before grouping (`RESOLVE_BEGIN`, priority 10000), so
  merging everything into `<project>` *would* make categories global — at the cost of
  collapsing the entire module tree into a single page.
- **`router: "category"` / `"group"`** only change URL layout, not grouping semantics,
  and emit no index page.

This plugin merges terms across the whole project and emits an index plus one detail
page per term.

## Install

```sh
npm install --save-dev typedoc-plugin-taxonomy-index
```

```jsonc
// typedoc.json
{
  "plugin": ["typedoc-plugin-taxonomy-index"]
}
```

## Output

- `taxonomy.html` — every category and group as a card grid, with member counts and a
  "merged from N files" badge.
- `taxonomy-<kind>-<slug>.html` — one page per term, members bucketed by owning module
  so cross-file membership is visible at a glance.
- `assets/taxonomy.css` — styles built entirely from TypeDoc's own CSS custom
  properties, so light/dark and custom themes are inherited automatically.

Pages are rendered through the active theme's `defaultLayout`, so they pick up the
toolbar, search, sidebar, footer and any `head.end` / `body.end` hooks other plugins
register. This works with the default theme and with custom themes that extend
`DefaultTheme`.

## Options

Every option falls back to the equivalent native TypeDoc option when it is not
explicitly set, so an existing `categoryOrder` / `groupOrder` / `sort` configuration is
respected without duplication.

| Option | Type | Default |
| --- | --- | --- |
| `taxonomyIndex` | boolean | `true` — master switch |
| `taxonomyOut` | string | `"taxonomy.html"` |
| `taxonomyTitle` | string | `"Categories & Groups"` |
| `taxonomyMerge` | `byTitle` \| `byTitleCaseInsensitive` \| `none` | `byTitle` |
| `taxonomyKinds` | string[] | `["categories", "groups"]` |
| `taxonomyCategoryOrder` | string[] | falls back to `categoryOrder` |
| `taxonomyGroupOrder` | string[] | falls back to `groupOrder` |
| `taxonomyCategorizeByGroup` | boolean | falls back to `categorizeByGroup` |
| `taxonomySort` | string[] | falls back to `sort` |
| `taxonomyDefaultCategory` | string | falls back to `defaultCategory` |
| `taxonomyIncludeDefault` | boolean | `false` — hide the catch-all category |
| `taxonomyExcludeKindGroups` | boolean | `true` |
| `taxonomyDetailPages` | boolean | `true` |
| `taxonomySidebarLink` | boolean | `true` |

`taxonomyCategoryOrder` / `taxonomyGroupOrder` honour the `"*"` wildcard slot exactly
as TypeDoc does: unlisted titles sort into the wildcard position (or last if there is
no wildcard) and tie-break alphabetically.

`taxonomySort` implements `alphabetical`, `source-order` and `kind`. Entries naming any
other strategy are skipped rather than erroring, so a `sort` of
`["required-first", "alphabetical"]` resolves to `alphabetical`.

### `taxonomyExcludeKindGroups`

When a reflection has no `@group` tag, TypeDoc assigns it a group named after its kind
— `Functions`, `Methods`, `Interfaces`, and so on. Those swamp a hand-written taxonomy
(a mid-sized project easily has thousands of `Methods`), so they are filtered out by
default. Set this to `false` to include them.

Caveat: filtering is by title, so an intentional `@group Functions` is also dropped
while this is enabled.

## Implementation notes

Two constraints shape the design, both worth knowing before modifying it:

1. **Everything happens on `RendererEvent.BEGIN`, not in `load()`.** TypeDoc's
   `_bootstrap()` calls `options.reset()` *after* plugins load, discarding any option
   value read or written during `load()`. Only `addDeclaration` belongs there.
2. **Pages are written from a post-render job, not injected as `PageDefinition`s.**
   `DefaultTheme.render()` hard-throws on an unrecognised `pageKind`, so a custom page
   kind would force a `DefaultTheme` subclass and collide with any theme that already
   subclasses it. Writing files directly keeps the plugin theme-agnostic.

All pages are emitted at the output root. `urlTo` resolves links relative to
`page.model`, and the model here is the project reflection, whose own URL sits at the
root — a page in a subdirectory would produce links missing a `../` segment.

## License

MIT
