# Custom Events

ChemPal decouples cross-cutting concerns with **`window`-dispatched
`CustomEvent`s** rather than lifting all state into React context. A producer
(a hook, a component, the IndexedDB layer) dispatches a named event on `window`;
any number of consumers subscribe via `window.addEventListener` while they are
mounted and clean up on unmount. This keeps producers unaware of who is
listening.

Event names are namespaced:

- `chempal:*` — application/UI events (hotkey bridges, search lifecycle)
- `idb:*` — IndexedDB change notifications

There are three families of custom events. **Never hard-code an event-name
string** — always import the exported constant so a rename is a single edit.

---

## 1. Hotkey-bridge events

**Defined in:** [`src/hotkeys/events.ts`](../src/hotkeys/events.ts)

Global hotkey handlers live in `App.tsx`, but the state they act on lives in
deeper components. These events bridge that gap: the hotkey layer dispatches,
the component that owns the relevant state listens. None carry a payload.

| Constant | Event name | Dispatched by | Listened by | Effect |
|---|---|---|---|---|
| `FOCUS_GLOBAL_FILTER_EVENT` | `chempal:focus-global-filter` | `App.tsx` (hotkey handler) | `ResultsTable.tsx` | Focus the "Filter results…" input |
| `TOGGLE_COLUMN_FILTERS_EVENT` | `chempal:toggle-column-filters` | `App.tsx` (hotkey handler) | `ResultsTable.tsx` | Toggle the per-column filter row |
| `ABORT_SEARCH_EVENT` | `chempal:abort-search` | `App.tsx` (hotkey handler) | `useSearch.ts` | Abort the running search (same as the stop button) |

```ts
import { ABORT_SEARCH_EVENT } from "@/hotkeys";

// dispatch (App.tsx)
window.dispatchEvent(new CustomEvent(ABORT_SEARCH_EVENT));

// listen (useSearch.ts)
useEffect(() => {
  const handler = () => handleStopSearch();
  window.addEventListener(ABORT_SEARCH_EVENT, handler);
  return () => window.removeEventListener(ABORT_SEARCH_EVENT, handler);
}, [handleStopSearch]);
```

---

## 2. Search-lifecycle events

**Defined in:** [`src/events/searchEvents.ts`](../src/events/searchEvents.ts)

A typed event bus describing the lifecycle of a search. Producers emit these at
each phase; the **badge controller** ([`src/utils/badgeController.ts`](../src/utils/badgeController.ts))
is the sole consumer today, but they are general-purpose — history, analytics,
or telemetry could subscribe later without touching the producers.

Unlike the raw hotkey events, these go through **typed helpers** so payloads are
checked at the call site (no third-party dependency required):

- `emitSearchEvent(type, detail?)` — dispatch with a payload matching the event.
- `onSearchEvent(type, handler)` — subscribe; returns an **unsubscribe** function
  that drops straight into a `useEffect` cleanup.

The event names live in the `SearchEvent` string enum (members in `CONSTANT_CASE`,
matching the project's other enums like `APP_ACTION`). Use the enum member, never
the raw string.

| Enum member | Event name | Payload (`detail`) | Emitted by |
|---|---|---|---|
| `SearchEvent.STARTED` | `chempal:search-started` | `{ query: string }` | `useSearch.ts` when a search begins |
| `SearchEvent.RESULTS_COUNT` | `chempal:search-results-count` | `{ count: number }` | `ResultsTable.tsx` (filtered row count) and `App.tsx` (restored count on popup open) |
| `SearchEvent.COMPLETED` | `chempal:search-completed` | `{ count: number }` | `useSearch.ts` when a search finishes |
| `SearchEvent.ABORTED` | `chempal:search-aborted` | _none_ | `useSearch.ts` on user abort |
| `SearchEvent.FAILED` | `chempal:search-failed` | `{ error?: string }` | `useSearch.ts` on error |

```ts
import { SearchEvent, emitSearchEvent, onSearchEvent } from "@/events/searchEvents";

// emit (useSearch.ts)
emitSearchEvent(SearchEvent.STARTED, { query });

// subscribe (badgeController.ts) — returns an unsubscribe fn
useEffect(() => onSearchEvent(SearchEvent.COMPLETED, ({ count }) => {
  /* reconcile badge */
}), []);
```

> **Badge note:** all toolbar-badge updates are owned by the badge controller,
> which is the only module that reacts to these events and calls `BadgeAnimator`.
> No other file touches `chrome.action.setBadgeText` or `BadgeAnimator` directly.
> See [Search Flow](Search-Flow) for the full search→badge sequence.

---

## 3. IndexedDB notification events

**Defined in:** [`src/utils/idbCache.ts`](../src/utils/idbCache.ts)

Dispatched by the IndexedDB cache layer when its stores change, so UI that
mirrors persisted data can refresh without polling. These replaced an older
`cstorage.onChanged` pattern. They carry no payload — listeners re-read from the
DB. The cache layer emits them through small internal helpers
(`emitSearchResultsCleared()` / `emitSupplierStatsUpdated()`).

| Constant | Event name | Dispatched when | Listened by |
|---|---|---|---|
| `IDB_SEARCH_RESULTS_CLEARED` | `idb:search-results-cleared` | `clearSearchResults()` (unless called with `{ notify: false }`), `setSearchResults([])`, and `clearAllCaches()` | `App.tsx` (redirect off the results panel), `useSearch.ts` (drop local results), `badgeController.ts` (clear the badge) |
| `IDB_SUPPLIER_STATS_UPDATED` | `idb:supplier-stats-updated` | `putSupplierStatsEntry()` writes new stats | `StatsPanel.tsx` (live-refresh during a search) |

```ts
import { IDB_SEARCH_RESULTS_CLEARED } from "@/utils/idbCache";

window.addEventListener(IDB_SEARCH_RESULTS_CLEARED, handler);
return () => window.removeEventListener(IDB_SEARCH_RESULTS_CLEARED, handler);
```

> **Silent clears:** `clearSearchResults({ notify: false })` clears the store
> *without* dispatching `IDB_SEARCH_RESULTS_CLEARED`. `useSearch` uses this at the
> start of a new search so the reset doesn't bounce the user off the results
> panel mid-search.

---

## Conventions

- **Import the constant**, never the raw string literal.
- **Always clean up** listeners in the `useEffect` return (or use `onSearchEvent`,
  which returns the unsubscribe for you) to avoid leaks across popup re-mounts.
- **Choose the right family:** hotkey-bridge for keyboard→component actions,
  search-lifecycle (typed) for search phases, `idb:*` for persistence changes.
- New search-phase signals should be added to `searchEvents.ts` (with a payload
  entry in `SearchEventDetailMap`) so they stay typed.
