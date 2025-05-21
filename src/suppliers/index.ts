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

//import SupplierBunmurraLabs from './supplierBunmurraLabs'
import SupplierBioFuranChem from "./supplierBiofuranChem";
import SupplierCarolina from "./supplierCarolina";
import SupplierFtfScientific from "./supplierFtfScientific";
import SupplierHbarSci from "./supplierHbarSci";
import SupplierLaballey from "./supplierLaballey";
import SupplierLaboratoriumDiscounter from "./supplierLaboratoriumDiscounter";

export {
  SupplierBioFuranChem,
  SupplierCarolina,
  SupplierFtfScientific,
  SupplierHbarSci,
  SupplierLaballey,
  SupplierLaboratoriumDiscounter,
};
