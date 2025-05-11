
// Source: https://stackoverflow.com/a/79616084/1596569
// string length utility types (up to 10, depends on the `INDEX_HIGHER` tuple)

type INDEX_HIGHER = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

type L_MAX<T extends string, L extends number, C extends number = 0> = C extends L
  ? T
  : T extends `${infer _}${infer R}`
    ? L_MAX<R, L, INDEX_HIGHER[C]>
    : never;

type MAX_LEN<T extends string, L extends number> =
  L_MAX<T, INDEX_HIGHER[L], 0> extends never ? T : never;
// min is just the inverted version of MAX_LEN
type MIN_LEN<T extends string, L extends number> = L_MAX<T, L, 0> extends never ? never : T;

type MINMAX_LEN<T extends string, MIN extends number, MAX extends number> =
  MIN_LEN<T, MIN> extends never ? never : MAX_LEN<T, MAX> extends never ? never : T;

type EXACT_LEN<T extends string, L extends number> =
  MIN_LEN<T, L> extends never ? never : MAX_LEN<T, L> extends never ? never : T;

type REVERSE<T extends string> = T extends `${infer First}${infer Rest}`
  ? `${REVERSE<Rest>}${First}`
  : '';

type ADDITION_MAP = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 2, 3, 4, 5, 6, 7, 8, 9, 0],
  [2, 3, 4, 5, 6, 7, 8, 9, 0, 1],
  [3, 4, 5, 6, 7, 8, 9, 0, 1, 2],
  [4, 5, 6, 7, 8, 9, 0, 1, 2, 3],
  [5, 6, 7, 8, 9, 0, 1, 2, 3, 4],
  [6, 7, 8, 9, 0, 1, 2, 3, 4, 5],
  [7, 8, 9, 0, 1, 2, 3, 4, 5, 6],
  [8, 9, 0, 1, 2, 3, 4, 5, 6, 7],
  [9, 0, 1, 2, 3, 4, 5, 6, 7, 8]
];

type MULTIPLY_MAP = [
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [0, 2, 4, 6, 8, 0, 2, 4, 6, 8],
  [0, 3, 6, 9, 2, 5, 8, 1, 4, 7],
  [0, 4, 8, 2, 6, 0, 4, 8, 2, 6],
  [0, 5, 0, 5, 0, 5, 0, 5, 0, 5],
  [0, 6, 2, 8, 4, 0, 6, 2, 8, 4],
  [0, 7, 4, 1, 8, 5, 2, 9, 6, 3],
  [0, 8, 6, 4, 2, 0, 8, 6, 4, 2],
  [0, 9, 8, 7, 6, 5, 4, 3, 2, 1]
];

// lookup table for stringified numbers
type NUMBERS = {
  '0': 0;
  '1': 1;
  '2': 2;
  '3': 3;
  '4': 4;
  '5': 5;
  '6': 6;
  '7': 7;
  '8': 8;
  '9': 9;
};

// 1. "loop" over first character
type CHECKSUM<
  T extends string,
  I extends number = 1,
  C extends number = 0
> = T extends `${infer F}${infer R}`
  ? // 2. check that first character is a digit
    F extends keyof NUMBERS
    ? // 3. do current = current + (index * number)
      CHECKSUM<R, INDEX_HIGHER[I], ADDITION_MAP[C][MULTIPLY_MAP[I][NUMBERS[F]]]>
    : never
  : // 4. we're at the last character
    C;

// 1. check if all sections are numbers
export type CAS<T extends string> = T extends `${number}-${number}-${number}`
  ? // 2. get the 3 sections as types
    T extends `${infer SEG_A}-${infer SEG_B}-${number}`
    ? // 3. validate the length of the first 2 sections and the checksum
      T extends `${MINMAX_LEN<SEG_A, 2, 7>}-${EXACT_LEN<SEG_B, 2>}-${CHECKSUM<REVERSE<`${SEG_A}${SEG_B}`>>}`
      ? T
      : never
    : never
  : never;
