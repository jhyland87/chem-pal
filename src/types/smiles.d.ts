declare global {
  // Structural, compile-time SMILES validation — the type-level counterpart to the runtime
  // `isProbablyValidSmiles` check in smiles.ts. It verifies that:
  //   1. every character is in the legal SMILES set, and
  //   2. parentheses `()` and brackets `[]` are balanced.
  //
  // It is intentionally NOT a full parser. Like the runtime guard, it does not verify ring-closure
  // pairing, atom-symbol validity, or valences — those require a stateful, effectively unbounded
  // parse that has no practical, terminating expression in TypeScript's type system. So a string
  // that is syntactically plausible but chemically nonsense (e.g. `C1CC`) still passes, exactly as
  // it would through `isProbablyValidSmiles`.
  //
  // This only constrains *string literal types* known at compile time (inline constants, const
  // arrays, function arguments). It cannot validate a `string` value that only exists at runtime —
  // keep using `looksLikeSmiles` / `resolveSmiles` for that.

  /** Every character legal in a SMILES string (matches SMILES_CHAR in smiles.ts). */
  type SmilesChar =
    | "a"
    | "b"
    | "c"
    | "d"
    | "e"
    | "f"
    | "g"
    | "h"
    | "i"
    | "j"
    | "k"
    | "l"
    | "m"
    | "n"
    | "o"
    | "p"
    | "q"
    | "r"
    | "s"
    | "t"
    | "u"
    | "v"
    | "w"
    | "x"
    | "y"
    | "z"
    | "A"
    | "B"
    | "C"
    | "D"
    | "E"
    | "F"
    | "G"
    | "H"
    | "I"
    | "J"
    | "K"
    | "L"
    | "M"
    | "N"
    | "O"
    | "P"
    | "Q"
    | "R"
    | "S"
    | "T"
    | "U"
    | "V"
    | "W"
    | "X"
    | "Y"
    | "Z"
    | "0"
    | "1"
    | "2"
    | "3"
    | "4"
    | "5"
    | "6"
    | "7"
    | "8"
    | "9"
    | "@"
    | "+"
    | "-"
    | "="
    | "#"
    | "$"
    | ":"
    | "/"
    | "\\"
    | "."
    | "%"
    | "*";

  /**
   * Walks the string one character at a time, tracking the open `(` and `[` depth as tuple
   * lengths (`Parens` / `Brackets`). Written as a tail-recursive conditional type so TypeScript's
   * tail-call optimisation can handle long inputs — the longest of the supplied examples is ~357
   * characters, comfortably under the ~1000-step limit.
   *
   * Resolves to `true` only when every character is legal, every close has a matching open, and
   * both stacks are empty at the end. Any illegal character or unbalanced delimiter short-circuits
   * to `false`.
   */
  type ValidateSmiles<
    S extends string,
    Parens extends 0[] = [],
    Brackets extends 0[] = [],
  > = S extends `${infer C}${infer Rest}`
    ? C extends "("
      ? ValidateSmiles<Rest, [0, ...Parens], Brackets>
      : C extends ")"
        ? Parens extends [0, ...infer PRest extends 0[]]
          ? ValidateSmiles<Rest, PRest, Brackets>
          : false // close paren with no matching open
        : C extends "["
          ? ValidateSmiles<Rest, Parens, [0, ...Brackets]>
          : C extends "]"
            ? Brackets extends [0, ...infer BRest extends 0[]]
              ? ValidateSmiles<Rest, Parens, BRest>
              : false // close bracket with no matching open
            : C extends SmilesChar
              ? ValidateSmiles<Rest, Parens, Brackets>
              : false // illegal character
    : Parens extends []
      ? Brackets extends []
        ? true
        : false // unclosed bracket(s)
      : false; // unclosed paren(s)

  /**
   * Resolves to `S` itself when `S` is a structurally-plausible SMILES string, otherwise `never`.
   * Mirrors the spirit of the `CAS<T>` type in cas.d.ts: a literal in, a constrained literal out.
   *
   * @example
   * ```typescript
   * // Direct annotation — the right-hand side must satisfy the structure:
   * const ethanol: Smiles<"CCO"> = "CCO";          // ok
   * const benzene: Smiles<"c1ccccc1"> = "c1ccccc1"; // ok
   * const broken:  Smiles<"CC(=O"> = "CC(=O";       // error: Type '"CC(=O"' is not assignable to type 'never'
   *
   * // As a function constraint that brands only valid SMILES literals:
   * declare function asSmiles<S extends string>(value: Smiles<S>): S;
   * const a = asSmiles("CC(=O)O"); // type: "CC(=O)O"
   * const b = asSmiles("CC(=O");   // error at the call site
   *
   * // As a per-element constraint over a const array:
   * type SmilesList<T extends readonly string[]> = { [K in keyof T]: Smiles<T[K]> };
   * declare function smilesList<const T extends readonly string[]>(list: SmilesList<T>): T;
   * const lib = smilesList(["CCO", "CC(=O)O", "c1ccccc1"]); // ok
   * ```
   */
  type Smiles<S extends string> = "" extends S ? never : ValidateSmiles<S> extends true ? S : never;
}

// This export is needed to make the file a module (same pattern as cas.d.ts).
export {};
