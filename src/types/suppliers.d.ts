export {};

declare global {
  /**
   * Union of the barrel-exported supplier class names, e.g. `"SupplierCarolina"`.
   * Derived from the `src/suppliers` barrel so it stays in sync automatically as
   * suppliers are added or removed there.
   */
  type SupplierClassName = keyof typeof import('@/suppliers');
}
