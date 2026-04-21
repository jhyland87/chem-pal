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
 * @source
 */

// Akmekem got booted from Amazon
//export { default as SupplierAkmekem } from "./SupplierAkmekem";
// BunmurraLabs is under construction, new website only has default shopping cart items.
//export { default as SupplierBunmurraLabs } from "./supplierBunmurraLabs";
// N2O3 is offline since 01/20/2026
//export { default as SupplierN2O3 } from "./SupplierN2O3";

export { default as SupplierAladdinSci } from "./SupplierAladdinSci";
export { default as SupplierAlchemieLabs } from "./SupplierAlchemieLabs";
export { default as SupplierAmbeed } from "./SupplierAmbeed";
export { default as SupplierBioFuranChem } from "./SupplierBiofuranChem";
export { default as SupplierBVV } from "./SupplierBVV";
export { default as SupplierCarolina } from "./SupplierCarolina";
export { default as SupplierCarolinaChemical } from "./SupplierCarolinaChemical";
export { default as SupplierChemsavers } from "./SupplierChemsavers";
export { default as SupplierFtfScientific } from "./SupplierFtfScientific";
export { default as SupplierGoldAndSilverTesting } from "./SupplierGoldAndSilverTesting";
export { default as SupplierHbarSci } from "./SupplierHbarSci";
export { default as SupplierHimedia } from "./SupplierHimedia";
export { default as SupplierInnovatingScience } from "./SupplierInnovatingScience";
export { default as SupplierLaballey } from "./SupplierLaballey";
export { default as SupplierLaboratoriumDiscounter } from "./SupplierLaboratoriumDiscounter";
export { default as SupplierLibertySci } from "./SupplierLibertySci";
export { default as SupplierLoudwolf } from "./SupplierLoudwolf";
export { default as SupplierMacklin } from "./SupplierMacklin";
export { default as SupplierOnyxmet } from "./SupplierOnyxmet";
export { default as SupplierSynthetika } from "./SupplierSynthetika";
export { default as SupplierWarchem } from "./SupplierWarchem";
