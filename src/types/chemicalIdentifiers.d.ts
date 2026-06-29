declare global {
  // Lightweight nominal (branded) types for chemical identifiers that don't warrant the
  // full compile-time structural validation used by `CAS` (cas.d.ts) and `Smiles`
  // (smiles.d.ts). Each brand is enforced at runtime by its matching type guard in
  // `typeGuards/common.ts` (`isIupacName`, `isInChIKey`, `isInChI`); the guards narrow plain
  // values to these types so setters can assign without casts. (`PubChemCID` lives in
  // pubchem.d.ts alongside the other PubChem types.)

  /** Non-empty IUPAC chemical name. @example "dipotassium;oxalate" */
  type IupacName<S extends string = string> = S & { readonly __iupac: unique symbol };

  /**
   * InChIKey: three hyphen-separated uppercase-letter blocks (14 + 10 + 1).
   * @example "IRXRGVFLQOSHOH-UHFFFAOYSA-L"
   */
  type InChIKey<S extends string = string> = S & { readonly __inchiKey: unique symbol };

  /**
   * InChI string, with or without the leading `InChI=` prefix.
   * @example "1S/C2H2O4.2K/c3-1(4)2(5)6;;/h(H,3,4)(H,5,6);;/q;2*+1/p-2"
   */
  type InChI<S extends string = string> = S & { readonly __inchi: unique symbol };
}

// This export is needed to make the file a module
export {};
