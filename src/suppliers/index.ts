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

//import SupplierBunmurraLabs from './supplier_bunmurralabs'
import SupplierBioFuranChem from "./supplier_biofuranchem";
import SupplierCarolina from "./supplier_carolina";
import SupplierFtfScientific from "./supplier_ftfscientific";
import SupplierLaboratoriumDiscounter from "./supplier_laboratoriumdiscounter";

export {
  SupplierBioFuranChem,
  SupplierCarolina,
  SupplierFtfScientific,
  SupplierLaboratoriumDiscounter,
};
