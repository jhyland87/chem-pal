---
name: add-i18n-key
description: Add, rename, reword, or remove a message key in src/_locales. Use whenever new user-facing UI copy is introduced, existing copy changes, or a translation needs fixing — the change must land in all 7 locale files, not just English. Also covers the placeholder format and the reactive i18n() store.
paths: src/_locales/**
---

# Changing i18n keys

`src/_locales/<lang>/messages.json` — 7 locales, all in Chrome's i18n format:

```
de  en  es  fi  hi  pl  ru
```

They currently hold **364 keys each**, and that count must stay equal. English-only edits
ship broken UI to six locales.

## Rules

**Edit as text, never reserialize.** Do not read a `messages.json` into a JSON parser and
write the whole object back. Placeholder blocks are formatted inconsistently across the
files, and a round-trip reformats every one of the 364 keys — burying the real change in a
few hundred lines of noise. Insert or modify the specific key with a targeted text edit.

**Translate for real.** Leaving English strings in `de`/`es`/`fi`/`hi`/`pl`/`ru` is worse
than not adding the key, because nothing flags it later.

**Name keys `<area>_<thing>`**, following what's already there:
`drawer_supplier_label`, `settings_section_supplier_status`, `filter_placeholder_supplier`,
`column_supplier`.

## Entry shape

Plain message, with a `description` for translator context:

```json
"search_no_shipping_suppliers": {
  "message": "No suppliers ship to your location.",
  "description": "Shown when the ship-to filter excludes every supplier."
}
```

With substitutions — `$name$` in the message, plus a matching `placeholders` block mapping
each name to its positional argument:

```json
"loading_found_many_suppliers": {
  "message": "Found $count$ results from $suppliers$ suppliers",
  "placeholders": {
    "count": { "content": "$1" },
    "suppliers": { "content": "$2" }
  }
}
```

Placeholder names and positions must be identical in every locale, even where the
translated sentence reorders them.

## Consuming the key

`i18n()` is a **custom reactive store**, not the raw `chrome.i18n` API — it bundles
`_locales` and exposes `setLocale` / `useLocale`. A translation captured in a `useMemo`,
`useCallback`, or module-level constant needs the current locale as a dependency, or it
will keep rendering the old language after a locale switch.

## Verify

```bash
pnpm type-check && pnpm test:run
```

Then confirm the counts still match:

```bash
for d in src/_locales/*/; do echo -n "$d "; grep -c '"message"' "$d/messages.json"; done
```
