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

export { default as SupplierBioFuranChem } from "./supplierBiofuranChem";
//export { default as SupplierBunmurraLabs } from "./supplierBunmurraLabs";
export { default as SupplierCarolina } from "./supplierCarolina";
export { default as SupplierCarolinaChemical } from "./supplierCarolinaChemical";
export { default as SupplierFtfScientific } from "./supplierFtfScientific";
export { default as SupplierHbarSci } from "./supplierHbarSci";
export { default as SupplierLaballey } from "./supplierLaballey";
export { default as SupplierLaboratoriumDiscounter } from "./supplierLaboratoriumDiscounter";
