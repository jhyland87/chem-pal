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
//export { SupplierAkmekem } from "./SupplierAkmekem";
// BunmurraLabs is under construction, new website only has default shopping cart items.
//export { SupplierBunmurraLabs } from "./supplierBunmurraLabs";
// N2O3 is offline since 01/20/2026
//export { SupplierN2O3 } from "./SupplierN2O3";

export { SupplierAladdinSci } from "./SupplierAladdinSci";
export { SupplierAlchemieLabs } from "./SupplierAlchemieLabs";
export { SupplierAmbeed } from "./SupplierAmbeed";
export { SupplierAsesChem } from "./SupplierAsesChem";
//export { SupplierAsesChem2 } from "./SupplierAsesChem2";
export { SupplierAmarisChemicalSolutions } from "./SupplierAmarisChemicalSolutions";
export { SupplierBioFuranChem } from "./SupplierBiofuranChem";
export { SupplierBVV } from "./SupplierBVV";
export { SupplierCarolina } from "./SupplierCarolina";
export { SupplierCarolinaChemical } from "./SupplierCarolinaChemical";
//export { SupplierChemsavers } from "./SupplierChemsavers";
export { SupplierFtfScientific } from "./SupplierFtfScientific";
export { SupplierGoldAndSilverTesting } from "./SupplierGoldAndSilverTesting";
export { SupplierHbarSci } from "./SupplierHbarSci";
export { SupplierHimedia } from "./SupplierHimedia";
export { SupplierInnovatingScience } from "./SupplierInnovatingScience";
export { SupplierLaballey } from "./SupplierLaballey";
export { SupplierLaboratoriumDiscounter } from "./SupplierLaboratoriumDiscounter";
export { SupplierLibertySci } from "./SupplierLibertySci";
export { SupplierLiMac } from "./SupplierLiMac";
export { SupplierLoudwolf } from "./SupplierLoudwolf";
export { SupplierMacklin } from "./SupplierMacklin";
export { SupplierOnyxmet } from "./SupplierOnyxmet";
export { SupplierS3Chemicals } from "./SupplierS3Chemicals";
export { SupplierSynthetika } from "./SupplierSynthetika";
export { SupplierVWR } from "./SupplierVWR";
export { SupplierWarchem } from "./SupplierWarchem";
