
// Source: https://stackoverflow.com/a/79616084/1596569
// string length utility types (up to 10, depends on the `INDEX_HIGHER` tuple)

type Idx<T, K> = K extends keyof T ? T[K] : never
type Add<K1, K2> = Idx<Idx<[
    ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"],
    ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"],
    ["2", "3", "4", "5", "6", "7", "8", "9", "0", "1"],
    ["3", "4", "5", "6", "7", "8", "9", "0", "1", "2"],
    ["4", "5", "6", "7", "8", "9", "0", "1", "2", "3"],
    ["5", "6", "7", "8", "9", "0", "1", "2", "3", "4"],
    ["6", "7", "8", "9", "0", "1", "2", "3", "4", "5"],
    ["7", "8", "9", "0", "1", "2", "3", "4", "5", "6"],
    ["8", "9", "0", "1", "2", "3", "4", "5", "6", "7"],
    ["9", "0", "1", "2", "3", "4", "5", "6", "7", "8"]
], K1>, K2>

type CS<T, S = "0", A = "0"> = T extends `${infer F}${infer R}` ? CS<R, Add<F, S>, Add<A, S>> : Add<A, S>;

type Len<T extends string, A extends any[] = []> = T extends `${infer _}${infer R}` ? Len<R, [0, ...A]> : A['length']

type Trunc<T, A extends any[], O extends string = ""> =
    A extends [infer _, ...infer RA] ? T extends `${infer F}${infer R}` ? Trunc<R, RA, `${O}${F}`> : O : O;


type Compose<SA extends string, SB extends string> = `${SA}-${SB}-${CS<`${SA}${SB}`>}`
type Digit = "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9"
type FilterDigits<T extends string, A extends string = ""> = T extends `${infer F}${infer R}` ?
    FilterDigits<R, F extends Digit | "-" ? `${A}${F}` : A> : A;

export type CAS<T extends string> = T extends `0${infer R}` ? CAS<R> :
    FilterDigits<T> extends `${infer SA}-${infer SB}-${string}` ?
    Compose<
        Len<SA> extends 0 ? "11" : Len<SA> extends 1 ? `${SA}1` : Trunc<SA, [0, 0, 0, 0, 0, 0, 0]>,
        Len<SB> extends 0 ? "00" : Len<SB> extends 1 ? `${SB}0` : Trunc<SB, [0, 0]>
    > : `${string}-${string}-${string} `
