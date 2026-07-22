---
name: typedoc-comments
description: Write or fix TSDoc/TypeDoc comment blocks in ChemPal — the required tag set and order, @example formatting, @category/@group taxonomy values, {@link} resolution, and module headers. Use when documenting a new function, component, type, or supplier, when adding TSDoc to existing code, when `pnpm lint` reports a tsdoc/syntax error, or when `pnpm run docs` emits warnings.
paths: src/**/*.ts, src/**/*.tsx
---

# TSDoc in ChemPal

The whole codebase is documented — 1453 `@source` tags, 1306 `@example` blocks — and it
feeds a published TypeDoc site with project-wide category/group index pages. A comment
that's merely correct English is not enough; it has to carry the right tags in the right
order or it silently drops out of the taxonomy.

`tsdoc/syntax` is an **ESLint error** (`eslint.config.js:50`), so malformed TSDoc fails
`pnpm lint`.

## The rule

Document **every function**, including non-exported private helpers. Never use a `//` note
where a doc block belongs. Exported symbols get the full block; local helpers can be
shorter but still `/** … */`.

Test files, fixtures, and mocks get **no** TSDoc.

## Anatomy

Tag order, as used throughout `src/`:

```
summary → detail paragraphs → @remarks → @component → @category → @group
        → @typeParam → @param → @returns → @throws → @see → @example → @source
```

**No blank lines between tags.** A blank line inside the tag block splits the comment and
loses everything after it.

The canonical shape, from `src/helpers/quantity.ts`:

```ts
/**
 * Normalizes a quantity object to its base unit of measure.
 * @category Helpers
 * @group Quantity
 * @param input - The quantity object to normalize
 * @returns The normalized quantity object
 * @example
 * ```typescript
 * normalizeQuantity({ quantity: 1000, uom: "g" })  // Returns { quantity: 1, uom: "kg" }
 * normalizeQuantity({ quantity: 1000, uom: "mg" }) // Returns { quantity: 1, uom: "g" }
 * ```
 * @source
 */
export function normalizeQuantity(input: QuantityObject): QuantityObject {
```

Details that matter:

- **Lead with one summary sentence.** `useFirstParagraphOfCommentAsSummary` is on, so the
  first paragraph is what appears in every listing and search result. Put the detail in
  later paragraphs or `@remarks`.
- **`@param name - description`** — the hyphen is required by TSDoc syntax.
- **`@source` is always the last tag.** It's a project custom tag declared in
  `tsdoc.json`; it renders the source link on the generated page.

## `@example` blocks

Every exported symbol gets one. Fence it with an explicit language — bare ``` fences and
unlisted languages don't highlight. Allowed languages come from `highlightLanguages` in
`configs/typedoc.json`: `typescript`, `tsx`, `javascript`, `json`, `html`, `css`, `bash`,
`shell`, `regex`, `mermaid`.

**Quotes inside examples.** The codebase uses single quotes, but Prettier does not format
code inside comments — so existing `@example` blocks are still double-quoted throughout and
nothing will migrate them. Write new examples single-quoted to match the code; don't bulk
rewrite the old ones.

Show **input and output**, not just a call:

```ts
 * @example
 * ```typescript
 * parseQuantity("100g")      // { quantity: 100, uom: "g" }
 * parseQuantity("1.234,56 ml") // { quantity: 1234.56, uom: "ml" }
 * parseQuantity("nonsense")  // undefined
 * ```
```

For components, use a `tsx` fence showing the element in context. For anything async, show
the `await`.

## `@category` and `@group`

These drive the taxonomy index pages built by `plugins/typedoc-plugin-taxonomy-index` —
project-wide pages that collect every symbol sharing a term, which TypeDoc cannot do on its
own. `defaultCategory` is `"Other"`, so an untagged export lands in a visible "unsorted"
bucket rather than silently joining something unrelated.

**Reuse an existing value.** A one-off term creates a taxonomy page with one member. These
are the terms that currently produce a page (15 categories, 12 groups):

| `@category` | `@group` |
| --- | --- |
| Utils, Helpers, Typeguards, Science Helpers, Suppliers, Components, Country Helpers, Hooks, CAS Helpers, Cookies Helpers, Collection Utilities, Constants, Exceptions, Export Helpers, Tanstack Sorting Functions | Search, Types, Parsers, Converters, Formatters, Quantity, Constants, Regex Patterns, Icons, Export Types, Stats, Suppliers |

Re-derive before coining a new one — the generated pages are the source of truth, since a
tag can exist in source without reaching the docs:

```bash
ls docs/ | grep taxonomy-                                   # terms that actually render
grep -rho "@category [A-Za-z ]*" src/ | sed 's/ *$//' | sort | uniq -c | sort -rn
```

### The tag must be on the exported symbol

`@category` / `@group` in a **module header block** does not create a taxonomy term — it
only positions the module within its parent page. Five values in `src/` are orphaned this
way today and render nowhere: `@group Helpers` (`src/helpers/price.ts` and friends),
`@group Core Utilities`, `@group Advanced Mode`, `@group Hotkeys`, and `@category Events`
(the last because `src/events/` isn't in TypeDoc's `entryPoints`).

Tag the function, class, type, or component itself. And if you're adding a term in a
directory outside `entryPoints` in `configs/typedoc.json` — anything beyond `suppliers`,
`helpers`, `utils`, `hooks`, `constants`, `types`, `mixins`, `components`, and
`**/index.ts` — it won't be documented at all until that path is added.

Rule of thumb: `@category` is *what kind of thing this is* (Helpers, Typeguards,
Components); `@group` is *what domain it belongs to* (Quantity, Search, Parsers). Shared or
exported building blocks get both. Module-private helpers need neither.

## `{@link}` — the most common warning source

`{@link X}` only resolves to symbols TypeDoc knows about. Linking an ambient/global type,
a non-exported constant, or an enum that isn't in an entry point emits a warning and
renders as dead text. Commit `faa4882` ("tsdoc error fixes") was entirely this — the fix
is to demote the reference to backticks or point at something exported:

```ts
// warns — PURITY_COMPARATOR_OFFSET is module-private
 * a small {@link PURITY_COMPARATOR_OFFSET} so `>75%` sorts just above `75%`

// fine
 * a small `PURITY_COMPARATOR_OFFSET` so `>75%` sorts just above `75%`
```

Links to exported siblings are encouraged — `{@link WhatsNewPromptProps}`,
`{@link isAvailability}` — and `useTsLinkResolution` is on, so they resolve by TS symbol.

## Components

React components add `@component`, take `@category Components`, and document props via a
separate documented interface rather than one `@param` per field. From
`src/components/WhatsNewPrompt.tsx`:

```tsx
/**
 * Props for {@link WhatsNewPrompt}.
 * - `notice` - The just-installed release, or `undefined` to render nothing.
 * - `onAcknowledge` - Invoked once the user has seen or dismissed the notes.
 */
interface WhatsNewPromptProps { … }

/**
 * Announces what changed after the extension updated itself.
 *
 * Mirrors `UpdatePrompt` — same snackbar, same modal — but for a release that is
 * already installed, so there's nothing to apply.
 * @component
 * @category Components
 * @param props - The prompt props (see {@link WhatsNewPromptProps}).
 * @returns The rendered post-update prompt, or nothing when there's nothing to announce.
 * @example
 * ```tsx
 * <WhatsNewPrompt notice={notice} onAcknowledge={acknowledge} />
 * ```
 * @source
 */
```

## Module headers

A file that owns a coherent area opens with a module block — it sets the page description
and turns on the category/group sections for that page:

```ts
/**
 * Quantity parsing and unit conversion utilities for handling different units of measurement.
 * @module
 * @categoryDescription Helpers
 * @group Quantity
 * @showGroups
 * @showCategories
 */
```

Name it (`@module Suppliers`, `@module types/labchem`) when the inferred name would be
unhelpful.

## Allowed tags

TypeDoc's standard set plus five project custom tags declared in `tsdoc.json`: `@source`,
`@component`, `@todo`, `@typeguard`, `@subcategory`. **A tag not listed in `tsdoc.json`
fails `pnpm lint`** — add it to `tagDefinitions` *and* `supportForTags` there before using
it.

`@private` and `@protected` are in `excludeTags` — they're stripped from output, so don't
rely on them to convey anything.

## Fixing `tsdoc/syntax` errors

Real messages from this repo's config:

| Error | Cause | Fix |
| --- | --- | --- |
| `tsdoc-undefined-tag: The TSDoc tag "@x" is not defined in this configuration` | Tag missing from `tsdoc.json` | Use an existing tag, or declare it in both `tagDefinitions` and `supportForTags` |
| `tsdoc-param-tag-missing-hyphen` | `@param a description` | `@param a - description` |
| `tsdoc-escape-right-brace` / `tsdoc-malformed-inline-tag` | Literal `{` `}` in prose | Wrap in backticks: `` `{ a: 1 }` `` |
| Content vanishing from the generated page | Blank line inside the tag block | Remove it — tags run contiguously |

To reproduce any of these in isolation, write a throwaway file under `src/` and run
`npx eslint <file>` directly — it's much faster than the full `pnpm lint`.

## Verify

```bash
pnpm lint          # tsdoc/syntax is an error, so this catches malformed blocks
pnpm run docs      # NOT `pnpm docs` — that hits pnpm's own subcommand and fails
```

`pnpm run docs` should complete with no `[warning]` lines. Anything it prints about
unresolved links or missing documentation is a real regression — fix it rather than
letting it accumulate.
