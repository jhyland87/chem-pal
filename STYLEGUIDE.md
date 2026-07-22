# TypeScript style guide

The house style for ChemPal. It follows the Google TypeScript style guide, with a handful
of deliberate deviations recorded in the first section — read those before applying
anything you remember from elsewhere — the assertions rule in particular is stricter here
than most codebases.

Precedence: the linter and Prettier config win over this document; this document wins over
personal habit. Match the surrounding file when a local area already settled on something
and reformatting it isn't the point of your change.

---

## Where ChemPal deviates

| Topic | Google | ChemPal |
| --- | --- | --- |
| `as` / `!` assertions | Allowed with a justifying comment | **Banned outside test files.** Use a type guard, generic, or `in`-narrowing |
| Doc comments | JSDoc for API docs only; avoid restating types | **Every function**, including private helpers, gets a TSDoc block |
| `null` vs `undefined` | No preference | **Prefer `undefined`.** Pass `null` through unchanged only where a wire protocol uses it |
| `_` prefix | Never an identifier prefix or suffix | **`_`-prefixed params/vars mark intentional non-use** (`argsIgnorePattern: "^_"`) |
| Class field order | Not addressed | **All properties declared at the top**, above the methods |
| `readonly` | Mark class fields never reassigned outside the constructor | **`readonly` by default**, on interface and type members too; mutability is the deliberate exception |

Everything else below follows Google.

### Formatting is Prettier's job

`.prettierrc`: `printWidth: 100`, `trailingComma: "all"`, imports organized
alphabetically. Semicolons always. Don't hand-tune whitespace — run the formatter.

---

## Modules

- **Named exports.** A default export has no canonical name, so two files can import the
  same thing under different names and nothing errors.
  - **`.ts` modules: never `export default`.** There are zero in non-test `src/**/*.ts`.
  - **`.tsx` components: named exports for anything new.** About 40 older components and
    icons still default-export; the 13 most recently added (`WhatsNewPrompt`,
    `UpdatePrompt`, `MigrationPrompt`, `SupplierStoreNotice`, …) use named exports. Follow
    the newer ones. Don't churn the old ones just to convert them.
- **Never `export let`.** Mutable exports behave differently across re-export boundaries.
  Export a getter function instead.
- **ES modules only.** No `namespace Foo {}`, no `import x = require(...)`, no
  `/// <reference>`. `namespace` is permitted only to describe third-party ambient code.
- **`import type` / `export type`** when a symbol is used only as a type.
- **Only export what's used outside the module.** Minimize the exported surface.
- **No container classes for namespacing** — a class of `static` members used purely to
  group things. Export the constants and functions individually.
- Prefer relative paths within the project; avoid deep `../../../` chains.
- Prefer named imports for a few well-known symbols, namespace imports (`import * as x`)
  when pulling many symbols from a large API.
- Reuse before you write: prefer a maintained npm package over a hand-rolled utility, but
  don't add antiquated ones (jQuery, lodash-style kitchen sinks, underscore) for things
  modern JS does natively.

## Naming

| Case | Applies to |
| --- | --- |
| `UpperCamelCase` | classes, interfaces, types, enums, decorators, type parameters, React components |
| `lowerCamelCase` | variables, parameters, functions, methods, properties, module aliases |
| `CONSTANT_CASE` | module-level constants, enum values, `static readonly` fields |

- **Treat acronyms as words**: `loadHttpUrl`, not `loadHTTPURL`; `customerId`, not
  `customerID`. Exception for platform names that are spelled that way (`XMLHttpRequest`).
- **Descriptive, not cryptic.** No ambiguous abbreviations, no deleting letters inside a
  word (`cstmrId`), no Hungarian notation. Length should track scope — a variable alive for
  five lines can be short; an exported name cannot.
- **No `I` prefix on interfaces**, no type-suffixed names where the type already says it.
- **No leading or trailing underscores on class members.** 619 of 620 private/protected
  members in `src/` follow this. (`eslint.config.js` contains a `leadingUnderscore:
  "require"` entry for private members that does not currently fire — the codebase
  convention, not that dormant rule, is what to follow.)
- **`_`-prefixed names are the exception**, and only to mark something deliberately unused:
  an ignored parameter, a caught-and-discarded error. ESLint's `no-unused-vars` is
  configured to accept exactly that.
- `CONSTANT_CASE` only for values instantiated once for the program's lifetime. A `const`
  inside a function is `lowerCamelCase` even though it never changes.

## Types

- **Lean on inference.** Drop annotations that restate a literal: `const x = true`, not
  `const x: boolean = true`. Annotate when inference would produce `unknown` (`new
  Set<string>()`), or when a complex expression's type isn't obvious at a glance.
- **`interface` for object shapes**, especially any shape that might later be extended —
  an interface can be `extends`-ed and declaration-merged, a type alias can't, and errors
  surface at the declaration rather than at every use site. Reach for `type` when the thing
  isn't an extensible object shape: primitives, unions, complex intersections, mapped and
  conditional types, tuples, and function signatures.

  The codebase already splits this way — 125 exported interfaces to 46 type aliases, of
  which only 4 describe an object literal, all small and file-local
  (`QuantityObject`, `UnitConversion`, `CountryOption`, `FilterMenuRef`). The three
  interfaces that use `extends` all extend a third-party shape
  (`DBSchema`, `SVGProps`, `SvgIconProps`) — which is the case a type alias couldn't have
  served.

  ```ts
  // yes — extensible object shape
  interface SupplierOptions {
    readonly baseUrl: string;
    readonly limit?: number;
  }

  // yes — union, not an object shape
  type ShippingRange = "domestic" | "worldwide" | "regional";

  // no — object shape as a type alias
  type SupplierOptions = { baseUrl: string };
  ```
- **Properties are `readonly` unless they are meant to be mutated.** Make immutability the
  default and reassignability the deliberate exception — a mutable field should be a choice
  a reader can see, not the fallback. Applies to interface and type-alias members as much
  as to class fields.

  ```ts
  interface CachedQuery {
    readonly query: string;
    readonly results: readonly Product[];
    hitCount: number;  // deliberately mutable — incremented on every cache read
  }
  ```

  This one is **aspirational**: zero of the 555 interface properties in `src/` are
  `readonly` today. Apply it to new and rewritten types rather than sweeping the existing
  ones — and note that `readonly` is shallow, so a `readonly` array field still wants
  `readonly T[]` to stop element writes.
- **Annotate object literals, don't assert them**: `const foo: Foo = {…}`. An assertion
  hides the field-rename bugs that an annotation catches.
- **Arrays**: `T[]` / `readonly T[]` for simple element types; `Array<T>` when the element
  type is a union or an inline object. Applies at each nesting level.
- **`Record<K, V>`** for dictionaries with statically known keys; **`Map`/`Set`** for
  genuine runtime maps. Index signatures need a meaningful key label
  (`{[fileName: string]: number}`), not `[key: string]`.
- **No `any`.** `@typescript-eslint/no-explicit-any` is an error. Use a specific type, or
  `unknown` narrowed by a type guard from `src/utils/typeGuards/`.
- **No wrapper types** — `string`/`number`/`boolean`, never `String`/`Number`/`Boolean`,
  and never as constructors. Avoid bare `Object` and `{}`; reach for `unknown`,
  `Record<string, T>`, or `object`.
- **Don't bake `| null` / `| undefined` into a type alias.** Add it at the use site.
- **Prefer optional `foo?: T`** over `foo: T | undefined`.
- **Prefer the simplest construct that works.** An explicit interface beats a clever
  `Pick`/mapped/conditional type — it reads better, tools can find references, and the
  evaluation rules won't shift under you.
- **Avoid return-type-only generics.** When calling an existing API that has one, specify
  the type parameter explicitly.
- Use a tuple (`[string, string]`) instead of inventing a `Pair` interface; use an inline
  object type when named fields read better.

### Assertions

`as` and `!` are banned outside test files, fixtures, and mocks. They silence the compiler
without inserting a runtime check, so they convert a type error into a crash.

```ts
// no
(x as Foo).foo();
y!.bar();

// yes
if (x instanceof Foo) x.foo();
if (y) y.bar();
```

Reach for a type guard, a generic, `in`-narrowing, or a properly-typed value. If a value
genuinely cannot be typed without an assertion, say so rather than quietly casting.

Roughly 92 `as` assertions remain in non-test `src/` from before this rule. They're legacy,
not precedent — don't cite them, and clean one up when you're already editing its line.
There are zero `!` assertions; keep it that way.

## Variables and functions

- `const` by default, `let` only when reassigned, **never `var`**.
- One declaration per statement.
- **Top-level named functions use `function foo() {}`.** Callbacks and nested helpers use
  arrow functions — in a method body especially, since they inherit the outer `this`.
- **Never function expressions** (`function() {}` as a value). Arrow functions instead. The
  exceptions are generators and the rare case that must rebind `this`.
- **Concise arrow bodies only when the return value is used.** `promise.then(v => log(v))`
  leaks a return value into a `void` position; write the block form, or `void log(v)`.
- **Classes should not hold arrow-function properties** — except for an event handler that
  must be uninstallable, where the stable bound reference is the point.
- **Rest params over `arguments`**; spread over `Function.prototype.apply`. Never name
  anything `arguments`.
- **No side effects in default parameter values**, and keep them simple. Past a couple of
  optional parameters, take an options object.
- **Don't pass a named function straight to a higher-order function** unless you're certain
  of both signatures — `['11','5','10'].map(parseInt)` is the classic. Wrap it:
  `.map(n => Number(n))`.

## Classes

- **All properties declared at the top of the class**, above the methods, grouped with
  related config. Don't park a field next to the one method that reads it.
- **TS visibility keywords** (`private` / `protected`), not `#private` — `#` fields
  down-level badly. There are none in the codebase.
- **Never write `public`**; it's the default. The one exception is a non-readonly public
  parameter property in a constructor.
- **`readonly` by default**, on every field that isn't explicitly meant to be reassigned —
  not merely on the ones that happen not to be today. 285 of 849 class members carry it now;
  new fields should start `readonly` and drop it only when something actually writes to
  them. `SupplierBase` is the model — its config knobs (`minMatchPercentage`, `fuzzScorer`,
  `maxFallbackQueries`, `requiredCookies`) are all `protected readonly`. Individual
  suppliers are less consistent: `SupplierLoudwolf` marks its five identity fields
  `public readonly` but leaves `httpRequestHardLimit` and `maxConcurrentRequests` mutable
  even though nothing writes to them. Those are the ones to start getting right.
- **Initialize fields at declaration**; use parameter properties for plain dependency
  injection (`constructor(private readonly svc: Svc) {}`).
- **Drop empty constructors.** Keep one only if it has parameter properties, visibility
  modifiers, decorators, or is `private` to block instantiation.
- No semicolon after a class *declaration*; a class *expression* assigned to a const does
  end with one.
- Getters must be pure — no observable state change. Don't write a getter/setter pair that
  only forwards to a private field; make the field public.
- Don't rely on dynamic dispatch of static methods, and never use `this` in a static
  context.
- Prefer a module-local function to a `private static` method.

## Control flow

- **Early returns and guard clauses over nesting.** Invert the condition, handle the edge
  case, `return`/`continue`/`break` — keep the happy path at the base indentation instead of
  wrapping it in `if/else` pyramids.
- **Always brace bodies.** A single-statement `if` may stay on one line (`if (x) x.foo();`)
  but must not span two lines unbraced.
- **`switch` needs a `default`**, placed last, even if empty. Non-empty cases end in
  `break`, `return`, or `throw` — no fallthrough.
- **`===` / `!==` everywhere**, with one exception: `== null` / `!= null` to test for null
  and undefined together.
- **`for…of` over arrays**; `Object.keys/values/entries` over objects. Never `for…in` on an
  array — it yields string indices. On a dict, `for…in` needs a `hasOwnProperty` guard.
- **Don't assign inside a control statement.** If it's genuinely wanted, double-parenthesize
  it to show it's deliberate.
- **`throw new Error('…')`** — always `new`, always an `Error` (or subclass), never a
  string, and never reject a promise with a non-Error. Non-Errors carry no stack trace.
- **In `catch`, assume the value is an `Error`.** Don't write defensive non-Error handling
  unless a specific API is known to violate that, and comment where it comes from.
- **Never leave an empty `catch {}`.** If doing nothing is right, the comment explains why.
- **Keep `try` blocks tight** — only the throwing call and what depends on it.

## Literals and coercion

- **Single quotes** for ordinary strings; backticks for interpolation and multi-line.
  Prettier enforces this (`singleQuote: true`) — run `pnpm format`, don't hand-fix.

  Two things stay double-quoted, by design rather than oversight:
  - **JSX attributes** (`<Foo bar="baz" />`) — `jsxSingleQuote` is `false`, matching HTML
    and the React/MUI convention.
  - **Strings containing an apostrophe** — Prettier picks whichever quote needs fewer
    escapes, so `"don't"` stays as it is instead of becoming `'don\'t'`.

  Code inside TSDoc `@example` blocks is also still double-quoted throughout. Prettier does
  not format code in comments and no tooling will, so doc examples disagree with the code
  they document. Write new examples single-quoted; there's no value in a mass rewrite of
  the existing ones.
- **No line continuations** (backslash at end of line inside a string). Concatenate or use a
  template literal.
- **`Number()` to parse numbers**, then check the result — `Number.isFinite`, or
  `Math.floor` / `Math.trunc` for integers. **Never `parseInt` / `parseFloat`** on base-10
  input: they ignore trailing garbage and hide malformed values. `parseInt` with an explicit
  radix is fine for non-base-10, after validating the input characters — the six
  `Number.parseInt(…, 16)` hex calls in `src/theme/colors.ts` and `src/icons/` are the
  sanctioned form. For string input that may be blank or malformed (form fields, scraped
  values), use the `toFiniteNumber` helper in `src/helpers/utils.ts`.
- **Never unary `+`** to coerce a string to a number.
- `String(x)`, `Boolean(x)`, `!!x` are fine for coercion — but **never coerce an enum value
  to a boolean**. Compare it: `level !== SupportLevel.NONE`.
- **No redundant `!!`** in an `if`/`while`/`for` condition, which already coerces.
- Number prefixes are lowercase `0x` / `0o` / `0b`; no leading zeros otherwise.

## Async

- **Always `async`/`await` with `try`/`catch`.** Never chain `.then()` / `.catch()` /
  `.finally()`.
- Wrap deliberate fire-and-forget calls in `void`.
- React effect callbacks stay synchronous — declare an inner async function and `void` it.

## Comments

- **`/** … */` for documentation** a caller should read; **`//` for implementation notes**.
- **Stack multi-line implementation comments as consecutive `//` lines**, not a `/* */`
  block.
- **Keep them short.** One tight comment beats a multi-paragraph block. Say what the code
  does and why; leave out the history, the alternatives you rejected, and the debugging
  story. If a comment passes ~10 lines, the design is the thing to reconsider.
- **Comments should add information the types don't already carry.** A comment restating
  the signature is noise.
- ChemPal documents every function, including private helpers — see the `typedoc-comments`
  skill for the required tag set, ordering, `@category`/`@group` taxonomy, and `@source`.
- Don't use `@override`, `@implements`, `@enum`, or `@private` as type annotations —
  TypeScript's own syntax covers all of them.

## Disallowed

`var` · `with` · `eval` / `new Function(string)` · `debugger` · `const enum` ·
`export default` from a `.ts` module · `export let` · `namespace` · `import x = require()` ·
`#private` fields · `new String/Number/Boolean` · modifying built-in prototypes ·
relying on automatic semicolon insertion · self-defined decorators (framework-provided
ones only) · APIs marked `@deprecated` (use the documented replacement).

## Checking your work

```bash
pnpm lint          # naming-convention, no-explicit-any, tsdoc/syntax, react-hooks
pnpm type-check
```

`npx eslint <file>` is much faster than the full run when iterating on one file.
