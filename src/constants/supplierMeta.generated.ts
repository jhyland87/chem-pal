/**
 * GENERATED FILE — DO NOT EDIT.
 *
 * Written by `tools/generate-supplier-meta.js` (`pnpm run generate`) from the `static`
 * fields of the supplier classes, which remain the single source of truth. Change a
 * supplier's name, country, shipping scope or `shipsTo` on its class and regenerate;
 * `src/suppliers/__tests__/supplierMeta.test.ts` fails if this file drifts.
 *
 * Its reason to exist is bundle size: the UI needs supplier metadata at mount, and
 * reading it off the classes would pull the whole supplier layer into the popup's
 * startup bundle. See `src/constants/supplierMeta.ts` for the accessors.
 *
 * @module supplierMetaGenerated
 * @category Constants
 * @group Suppliers
 * @source
 */
import type { SupplierMetaEntry } from './supplierMeta';

/**
 * Display and shipping metadata for every live supplier, keyed by class name, in the
 * order `src/suppliers/index.ts` exports them.
 * @category Constants
 * @group Suppliers
 * @source
 */
export const SUPPLIER_META: Readonly<Record<SupplierClassName, SupplierMetaEntry>> = {
  SupplierAladdinSci: {
    displayName: 'AladdinSci',
    country: 'US',
    shipping: 'worldwide',
  },
  SupplierAlboChemicals: {
    displayName: 'Albo Chemicals',
    country: 'US',
    shipping: 'domestic',
  },
  SupplierAlchemieLabs: {
    displayName: 'Alchemie Labs',
    country: 'US',
    shipping: 'domestic',
  },
  SupplierAllianceChemical: {
    displayName: 'Alliance Chemical',
    country: 'US',
    shipping: 'domestic',
  },
  SupplierAmarisChemicalSolutions: {
    displayName: 'Amaris Chemical Solutions',
    country: 'US',
    shipping: 'international',
  },
  SupplierAmbeed: {
    displayName: 'Ambeed',
    country: 'CN',
    shipping: 'international',
    shipsTo: [
      'AR',
      'BR',
      'CA',
      'MX',
      'US',
      'AT',
      'BE',
      'BG',
      'HR',
      'CY',
      'CZ',
      'DK',
      'EE',
      'FI',
      'FR',
      'DE',
      'GR',
      'HU',
      'IE',
      'IT',
      'LV',
      'LI',
      'LT',
      'LU',
      'MT',
      'NL',
      'NO',
      'PL',
      'PT',
      'RO',
      'SK',
      'SI',
      'ES',
      'SE',
      'CH',
      'TR',
      'GB',
      'AU',
      'CN',
      'IN',
      'ID',
      'JP',
      'KR',
      'MY',
      'NZ',
      'PH',
      'SG',
      'TH',
      'VN',
      'EG',
      'IL',
    ],
  },
  SupplierAsesChem: {
    displayName: 'AsesChem',
    country: 'IN',
    shipping: 'domestic',
  },
  SupplierBioFuranChem: {
    displayName: 'BioFuran Chem',
    country: 'US',
    shipping: 'international',
  },
  SupplierBVV: {
    displayName: 'BVV',
    country: 'US',
    shipping: 'domestic',
  },
  SupplierCarolina: {
    displayName: 'Carolina',
    country: 'US',
    shipping: 'domestic',
  },
  SupplierCarolinaChemical: {
    displayName: 'Carolina Chemical',
    country: 'US',
    shipping: 'domestic',
  },
  SupplierChemsavers: {
    displayName: 'Chemsavers',
    country: 'US',
    shipping: 'international',
  },
  SupplierConsolidatedChemical: {
    displayName: 'Consolidated Chemical & Solvents',
    country: 'US',
    shipping: 'domestic',
  },
  SupplierDailyBioUSA: {
    displayName: 'Daily Bio USA',
    country: 'US',
    shipping: 'domestic',
  },
  SupplierFtfScientific: {
    displayName: 'FTF Scientific',
    country: 'US',
    shipping: 'worldwide',
  },
  SupplierGoldAndSilverTesting: {
    displayName: 'Gold and Silver Testing',
    country: 'US',
    shipping: 'domestic',
  },
  SupplierHimedia: {
    displayName: 'Himedia',
    country: 'IN',
    shipping: 'international',
  },
  SupplierHyperFuels: {
    displayName: 'HyperFuels',
    country: 'US',
    shipping: 'domestic',
  },
  SupplierInnovatingScience: {
    displayName: 'Innovating Science',
    country: 'US',
    shipping: 'international',
  },
  SupplierLaballey: {
    displayName: 'Laballey',
    country: 'US',
    shipping: 'international',
  },
  SupplierLabChem: {
    displayName: 'LabChem',
    country: 'DE',
    shipping: 'international',
  },
  SupplierLaboratoriumDiscounter: {
    displayName: 'Laboratorium Discounter',
    country: 'NL',
    shipping: 'domestic',
  },
  SupplierLabProServices: {
    displayName: 'LabPro Services',
    country: 'US',
    shipping: 'domestic',
  },
  SupplierLeroChem: {
    displayName: 'LeroChem',
    country: 'LT',
    shipping: 'international',
  },
  SupplierLibertySci: {
    displayName: 'LibertySci',
    country: 'US',
    shipping: 'worldwide',
  },
  SupplierLiMac: {
    displayName: 'LiMac',
    country: 'LV',
    shipping: 'worldwide',
  },
  SupplierLoudwolf: {
    displayName: 'Loudwolf',
    country: 'US',
    shipping: 'worldwide',
  },
  SupplierMacklin: {
    displayName: 'Macklin',
    country: 'CN',
    shipping: 'worldwide',
  },
  SupplierOnyxmet: {
    displayName: 'Onyxmet',
    country: 'CA',
    shipping: 'international',
  },
  SupplierOrbitNaturalProductDerivatives: {
    displayName: 'Orbit Natural Product Derivatives',
    country: 'US',
    shipping: 'domestic',
  },
  SupplierS3Chemicals: {
    displayName: 'S3 Chemicals',
    country: 'DE',
    shipping: 'international',
  },
  SupplierScienceLab: {
    displayName: 'ScienceLab',
    country: 'US',
    shipping: 'domestic',
  },
  SupplierSynthetika: {
    displayName: 'Synthetika',
    country: 'PL',
    shipping: 'international',
  },
  SupplierTheLabStockroom: {
    displayName: 'The Lab Stockroom',
    country: 'US',
    shipping: 'international',
  },
  SupplierVWR: {
    displayName: 'VWR',
    country: 'US',
    shipping: 'worldwide',
  },
  SupplierWarchem: {
    displayName: 'Warchem',
    country: 'PL',
    shipping: 'domestic',
  },
};
