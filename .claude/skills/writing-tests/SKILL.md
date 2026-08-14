---
name: writing-tests
description: How to write and refactor ChemPal unit tests (Vitest) — prefer parametrized tables (it.each / describe.each / it.for) over native loops, and use concurrency (test.concurrent / describe.concurrent) where the suite is isolated. Use when adding tests, optimizing an existing test file, converting for-loops of cases into tables, or deciding whether a suite can run concurrently.
---

# Writing ChemPal tests

Tests run through **Vitest** via `pnpm test:run` (never bare `vitest` — that skips
`configs/vitest.config.ts` and the no-network fetch guard). The config sets
`globals: true`, `environment: 'jsdom'`, and **`fileParallelism: false`** — files run
one at a time, so the only intra-suite parallelism available is `*.concurrent` **inside**
a file (see [Concurrency](#concurrency)).

Test files are exempt from the repo's TSDoc-on-every-function rule and may use `as`
assertions freely. Match each file's existing import style — some import
`{ describe, it, expect }` from `vitest` even though `globals` is on; follow the file
you're in.

## 0. No external calls — ever

**Unit and E2E tests must make zero external/network calls.** Everything that would leave
the process must be mocked at its boundary: `fetch`, `chrome.*` (storage, messaging,
action, tabs), the service worker, IndexedDB, currency-rate lookups, analytics, audio,
update/GitHub checks, supplier scrapes. Tests must be hermetic and deterministic — a test
run must never hit a supplier, a currency API, GitHub, or GA4.

`configs/vitest.setup.ts` already enforces this for the network: it replaces `global.fetch`
with a `vi.fn()` that **throws** unless a test mocks it — and that guard is only installed
via `pnpm test:run`, never bare `vitest`. Everything else you mock yourself.

Mock the module that owns the boundary rather than the raw primitive:

- `vi.mock('@/utils/storage')` — `cstorage.local/session/onChanged`
- `vi.mock('@/utils/idbCache')` / `vi.mock('@/utils/SupplierCache')` — IndexedDB
- `vi.mock('@/helpers/currency')` — `getCurrencyRate` (would otherwise fetch)
- `vi.mock('@/helpers/analytics')` — GA4
- the typed chrome fixtures in `src/__fixtures__/helpers/chrome/` (storageMock, actionMock,
  tabsMock) for `chrome.*`

Any fetch a code path genuinely needs must be given an explicit `mockImplementation`. If a
test renders a tree that fires an unmocked fetch, the guard throws and the test fails —
that's the guard working, not a flake; mock the boundary.

## 1. Prefer tables over native loops

Whenever a test repeats the same assertion over a list of cases, use a **parametrized
table** instead of a native `for` / `forEach`. Tables give one reported test per case
(so a failure names the offending input), and read as data.

### `it.each` / `test.each` — array or tuple rows, printf labels

```ts
// ❌ one opaque test; first failure hides the rest, and the message won't say which input
it('classifies grades', () => {
  for (const input of ['ACS', 'ACS Grade', 'A.C.S.']) {
    expect(parseGrade(input)).toBe('ACS Grade');
  }
});

// ✅ one test per case, each labelled by its input
it.each(['ACS', 'ACS Grade', 'A.C.S.'])('classifies %j as ACS Grade', (input) => {
  expect(parseGrade(input)).toBe('ACS Grade');
});

// tuple rows spread into args:
it.each([
  ['Low', 'Low Grade'],
  ['Impure', 'Impure'],
])('%s → %s', (input, expected) => {
  expect(parseGrade(input)).toBe(expected);
});
```

Label placeholders: `%s` string, `%j` JSON (best for showing the raw input), `%i`/`%d`
number, `%o` object, `%#` the row index.

### `describe.each` — parametrize a whole block

Use it to fan a group of assertions across a dataset (e.g. per-supplier, per-grade):

```ts
describe.each(Object.entries(GRADE_CORPUS))('%s', (expected, cases) => {
  it.each(cases.successful)('classifies %j', (input) => {
    expect(parseGrade(input)).toBe(expected);
  });
});
```

### `it.for` / `describe.for` — object rows with `$`-interpolation

`.for` passes each row **as a single argument** (instead of spreading it) and exposes
the `TestContext` as the second arg. It's the right choice for **object** cases, and it
lets the title reference fields with `$prop`:

```ts
const nearMisses = Object.entries(GRADE_CORPUS).flatMap(([grade, { unsuccessful }]) =>
  unsuccessful.map((input) => ({ grade, input })),
);

it.for(nearMisses)('$input (near-miss for $grade) falls through to Ungraded', ({ input }) => {
  expect(parseGrade(input)).toBe('Ungraded');
});
```

Rule of thumb: **`.each` for arrays/tuples** (spread args, `%`-labels); **`.for` for
objects** (single arg, `$field` labels).

### Flatten nested loops with `flatMap`

A loop-in-a-loop of cases becomes one table built with `flatMap` (as in `nearMisses`
above) — one flat list of `{ ...context, case }` rows fed to a single `it.for`. Prefer
this over nested `describe.each`+`it.each` when the inner assertion is uniform.

### Guard empty tables with `runIf`, not an `if` wrapper

`it.each` / `it.for` / `describe.each` **throw on an empty array**. When a row's case
list can be empty, gate the table with `it.runIf(cond)` (or `it.skipIf(cond)`) — never
wrap the whole test in a plain `if`. `runIf` reads as one statement and keeps the gated
case reported (as skipped) instead of silently vanishing:

```ts
// ❌ wrapping the test in a conditional
if (cases.unsuccessful.length > 0) {
  it.each(cases.unsuccessful)('does not classify %j', (input) => { /* … */ });
}

// ✅ gate the table itself — chains before .each / .for
it.runIf(cases.unsuccessful.length > 0).each(cases.unsuccessful)(
  'does not classify %j',
  (input) => { /* … */ },
);
```

`runIf(cond)` runs the test(s) only when `cond` is true; `skipIf(cond)` is the inverse.
Both chain before `.each` / `.for`, before `describe`, and before a plain body
(`it.runIf(isCI)('…', () => {})`). Use them for any conditional test, not just empty
tables — a bare `if` around a test is almost always better expressed as `runIf`/`skipIf`.

### When NOT to convert

Keep a native loop when it isn't a table of independent cases:

- **Setup / seeding**: building fixtures, seeding a store, priming a cache.
- **Loops inside a single logical assertion** (e.g. summing, collecting, then one
  `expect` on the aggregate).
- **Order-dependent steps** where each iteration depends on the previous.

Converting these to `.each` would change meaning or fragment one assertion into many.

## 2. Concurrency

Because `fileParallelism: false`, a file's tests run sequentially by default. Marking a
suite concurrent is the only way to parallelize within it:

```ts
describe.concurrent('parseGrade', () => {
  it('…', () => { /* … */ });
});
// or per-test:
it.concurrent('…', () => { /* … */ });
// combined with a table:
it.each(cases)('%j', (input) => { /* … */ });        // inside a concurrent describe
```

### Do NOT destructure `{ expect }` from `.each`

`globals: true` is set, so `expect` is **ambient** — just call it. It works inside
concurrent tests for normal matchers (`toBe`, `toEqual`, `toBeTypeOf`, …); only
**snapshot** matchers (`toMatchSnapshot` / `toMatchInlineSnapshot`) need the per-test
`expect` from the context argument.

And beware the table-API difference (verified in this repo's Vitest):

- **`it.each` / `test.each` pass the callback only the row values — NO context.**
  Writing `it.each(rows)('…', (a, b, { expect }) => …)` destructures `undefined` and
  throws `Cannot destructure property 'expect'`. Just use the ambient `expect`.
- **`it.for` / `test.for` DO pass the test context as the second argument**, so
  `it.for(rows)('$x', (row, ctx) => …)` can reach `ctx.expect` when you actually need
  it (i.e. concurrent snapshots).

Rule: in concurrent parametrized tests use the **ambient `expect`** and pick `.each`
vs `.for` by the array-vs-object rule above — don't wire up a context arg unless you're
taking a snapshot (then use `.for`).

### Only when the suite is isolated

Apply concurrency **only** to suites with no shared mutable state. Safe: pure functions
and predicates (`helpers/`, `utils/typeGuards/`, `utils/search-query/`, `sorting`,
`science`, `quantity`, `cas`, `currency`, `country`). **Do not** make a suite concurrent
when it:

- calls `vi.useFakeTimers()` / advances timers,
- customizes the shared `global.fetch` mock, `chrome.*`, or the fake IndexedDB
  (`configs/vitest.setup.ts` installs these globally — concurrent tests would race on
  them),
- relies on `vi.mock` module state, spies reset in `beforeEach`, or on test ordering,
- renders React with shared DOM/singletons.

When unsure, leave it sequential. A flaky concurrent suite is worse than a slightly
slower one.

## 3. Use the right matcher for the assertion

### Runtime type checks: `toBeTypeOf`, not `expect(typeof …)`

For asserting a **runtime** value's `typeof`, use the dedicated matcher — it reads
clearer and reports a better diff:

```ts
// ❌
expect(typeof host).toBe('string');
expect(typeof result.arrayBuffer).toBe('function');
// ✅
expect(host).toBeTypeOf('string');
expect(result.arrayBuffer).toBeTypeOf('function');
```

`.not` and custom messages carry over — the message belongs on `expect`, not the
matcher:

```ts
expect(x).not.toBeTypeOf('string');
expect(fn, `scorer "${name}" is not a function`).toBeTypeOf('function');
```

Valid arguments are the `typeof` strings: `'string' | 'number' | 'bigint' |
'boolean' | 'symbol' | 'undefined' | 'object' | 'function'`.

### `expectTypeOf` is a different tool (compile-time)

`expectTypeOf(x).toEqualTypeOf<T>()` asserts **static types**, checked only when
Vitest runs with `--typecheck` and `test.typecheck` is enabled in the config. This
repo does **not** enable typecheck, so an `expectTypeOf` assertion here compiles to a
runtime no-op and verifies nothing. Do **not** use it to replace a runtime
`expect(typeof …)` check — that would silently drop the assertion. Reach for
`expectTypeOf` only in a dedicated `*.test-d.ts` type suite with typecheck turned on.

## Verify

```bash
pnpm test:run <path-to-file>     # the file you changed
pnpm test:run                    # full suite before you're done
```

Converting a loop to a table must be **behavior-preserving**: the same inputs asserted
the same way, only restructured. If the case count reported changes unexpectedly, you
probably dropped or duplicated a case (or hit an empty-table throw). Two known
exclusions never run regardless of a green suite — `src/helpers/__tests__/productBuilder.test.ts`
and `src/suppliers/__tests__/supplierMacklin.test.ts` (plus `src/__tests__/**`) — so
converting them proves nothing; verify their logic elsewhere if you touch them.
