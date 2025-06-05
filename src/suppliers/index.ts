/**
 * Supplier module that exports various supplier implementations.
 * This module serves as a central point for accessing different chemical supplier classes.
 *
 * Each supplier class implements specific logic for querying and parsing product data
 * from their respective e-commerce sites.
 *
 * @module Suppliers
 *
 * @example
 * ```typescript
 * import { SupplierCarolina, SupplierBioFuranChem } from './suppliers';
 *
 * // Search Carolina supplier for Sodium Hydroxide
 * const carolina = new SupplierCarolina('Sodium Hydroxide');
 *
 * // Search BioFuranChem supplier for Acetic Acid
 * const bioFuran = new SupplierBioFuranChem('Acetic Acid');
 * ```
 */

export { default as SupplierBioFuranChem } from "./SupplierBiofuranChem";
//export { default as SupplierBunmurraLabs } from "./supplierBunmurraLabs";
export { default as SupplierCarolina } from "./SupplierCarolina";
export { default as SupplierCarolinaChemical } from "./SupplierCarolinaChemical";
export { default as SupplierChemsavers } from "./SupplierChemsavers";
export { default as SupplierFtfScientific } from "./SupplierFtfScientific";
export { default as SupplierHbarSci } from "./SupplierHbarSci";
export { default as SupplierLaballey } from "./SupplierLaballey";
export { default as SupplierLaboratoriumDiscounter } from "./SupplierLaboratoriumDiscounter";
export { default as SupplierLibertySci } from "./SupplierLibertySci";
export { default as SupplierLoudwolf } from "./SupplierLoudwolf";
export { default as SupplierMacklin } from "./SupplierMacklin";
export { default as SupplierOnyxmet } from "./SupplierOnyxmet";
export { default as SupplierWarchem } from "./SupplierWarchem";
