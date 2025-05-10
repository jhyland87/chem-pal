
import { ReactNode } from 'react';
import HttpStatusCode from './types/HttpStatusCode';

/**
 * A type representing a valid CAS number.
 * This type ensures that the string matches the CAS number format and passes the checksum validation.
 *
 * @example
 * const validCas: CasNumber = '1234-56-6'; // Valid
 * const invalidCas: CasNumber = '1234-56-7'; // Type error
 */
export type CasNumber = string & {
  readonly __brand: unique symbol;
};

export type QuantityObject = { quantity: number, uom: string };
export type HeaderObject = { [key: string]: string };
export type ChromeStorageItems = { [key: string]: any };

export type CurrencyRate = number;

export type ExchangeRateResponse = {
  status_code: HttpStatusCode;
  data: {
    base: CurrencyCode;
    target: CurrencyCode;
    mid: number;
    unit: number;
    timestamp: string; // ISOString
  };
};

export type CurrencyCode =
  | 'AED' | 'AFN' | 'ALL' | 'AMD' | 'ANG' | 'AOA' | 'ARS'
  | 'AUD' | 'AWG' | 'AZN' | 'BAM' | 'BBD' | 'BDT' | 'BGN'
  | 'BHD' | 'BIF' | 'BMD' | 'BND' | 'BOB' | 'BRL' | 'BSD'
  | 'BTC' | 'BTN' | 'BWP' | 'BYR' | 'BYN' | 'BZD' | 'CAD'
  | 'CDF' | 'CHF' | 'CLP' | 'CNY' | 'COP' | 'CRC' | 'CUC'
  | 'CUP' | 'CVE' | 'CZK' | 'DJF' | 'DKK' | 'DOP' | 'DZD'
  | 'EEK' | 'EGP' | 'ERN' | 'ETB' | 'ETH' | 'EUR' | 'FJD'
  | 'FKP' | 'GBP' | 'GEL' | 'GGP' | 'GHC' | 'GHS' | 'GIP'
  | 'GMD' | 'GNF' | 'GTQ' | 'GYD' | 'HKD' | 'HNL' | 'HRK'
  | 'HTG' | 'HUF' | 'IDR' | 'ILS' | 'IMP' | 'INR' | 'IQD'
  | 'IRR' | 'ISK' | 'JEP' | 'JMD' | 'JOD' | 'JPY' | 'KES'
  | 'KGS' | 'KHR' | 'KMF' | 'KPW' | 'KRW' | 'KWD' | 'KYD'
  | 'KZT' | 'LAK' | 'LBP' | 'LKR' | 'LRD' | 'LSL' | 'LTC'
  | 'LTL' | 'LVL' | 'LYD' | 'MAD' | 'MDL' | 'MGA' | 'MKD'
  | 'MMK' | 'MNT' | 'MOP' | 'MRO' | 'MRU' | 'MUR' | 'MVR'
  | 'MWK' | 'MXN' | 'MYR' | 'MZN' | 'NAD' | 'NGN' | 'NIO'
  | 'NOK' | 'NPR' | 'NZD' | 'OMR' | 'PAB' | 'PEN' | 'PGK'
  | 'PHP' | 'PKR' | 'PLN' | 'PYG' | 'QAR' | 'RMB' | 'RON'
  | 'RSD' | 'RUB' | 'RWF' | 'SAR' | 'SBD' | 'SCR' | 'SDG'
  | 'SEK' | 'SGD' | 'SHP' | 'SLL' | 'SOS' | 'SRD' | 'SSP'
  | 'STD' | 'STN' | 'SVC' | 'SYP' | 'SZL' | 'THB' | 'TJS'
  | 'TMT' | 'TND' | 'TOP' | 'TRL' | 'TRY' | 'TTD' | 'TVD'
  | 'TWD' | 'TZS' | 'UAH' | 'UGX' | 'USD' | 'UYU' | 'UZS'
  | 'VEF' | 'VND' | 'VUV' | 'WST' | 'XAF' | 'XBT' | 'XCD'
  | 'XOF' | 'XPF' | 'YER' | 'ZAR' | 'ZWD';

export enum CurrencyCodeMap {
  'Lek' = 'ALL',
  '؋' = 'AFN',
  '$' = 'USD',
  'CA$' = 'CAD',
  'ƒ' = 'ANG',
  '₼' = 'AZN',
  'Br' = 'BYN',
  'BZ$' = 'BZD',
  '$b' = 'BOB',
  'KM' = 'BAM',
  'P' = 'BWP',
  'лв' = 'UZS',
  'R$' = 'BRL',
  '៛' = 'KHR',
  '¥' = 'JPY',
  '₡' = 'CRC',
  '₱' = 'PHP',
  'Kč' = 'CZK',
  'kr' = 'SEK',
  'RD$' = 'DOP',
  '£' = 'GBP',
  '€' = 'EUR',
  '¢' = 'GHS',
  'Q' = 'GTQ',
  'L' = 'HNL',
  'Ft' = 'HUF',
  '₹' = 'INR',
  'Rp' = 'IDR',
  '﷼' = 'YER',
  '₪' = 'ILS',
  'J$' = 'JMD',
  '₩' = 'KRW',
  '₭' = 'LAK',
  'ден' = 'MKD',
  'RM' = 'MYR',
  'AU$' = 'AUD',
  '₨' = 'LKR',
  '₮' = 'MNT',
  ' د.إ' = 'AED',
  'MT' = 'MZN',
  'C$' = 'NIO',
  '₦' = 'NGN',
  'B/.' = 'PAB',
  'Gs' = 'PYG',
  'S/.' = 'PEN',
  'zł' = 'PLN',
  'lei' = 'RON',
  '₽' = 'RUB',
  'Дин.' = 'RSD',
  'S' = 'SOS',
  'R' = 'ZAR',
  'CHF' = 'CHF',
  'NT$' = 'TWD',
  '฿' = 'THB',
  'TT$' = 'TTD',
  '₺' = 'TRY',
  '₴' = 'UAH',
  '$U' = 'UYU',
  'Bs' = 'VEF',
  '₫' = 'VND',
  'Z$' = 'ZWD',
}

export enum CurrencySymbolMap {
  AED = 'د.إ',
  AFN = '؋',
  ALL = 'L',
  AMD = '֏',
  ANG = 'ƒ',
  AOA = 'Kz',
  ARS = '$',
  AUD = '$',
  AWG = 'ƒ',
  AZN = '₼',
  BAM = 'KM',
  BBD = '$',
  BDT = '৳',
  BGN = 'лв',
  BHD = '.د.ب',
  BIF = 'FBu',
  BMD = '$',
  BND = '$',
  BOB = '$b',
  BRL = 'R$',
  BSD = '$',
  BTC = '฿',
  BTN = 'Nu.',
  BWP = 'P',
  BYR = 'Br',
  BYN = 'Br',
  BZD = 'BZ$',
  CAD = 'CA$',
  CDF = 'FC',
  CHF = 'CHF',
  CLP = '$',
  CNY = '¥',
  COP = '$',
  CRC = '₡',
  CUC = '$',
  CUP = '₱',
  CVE = '$',
  CZK = 'Kč',
  DJF = 'Fdj',
  DKK = 'kr',
  DOP = 'RD$',
  DZD = 'دج',
  EEK = 'kr',
  EGP = '£',
  ERN = 'Nfk',
  ETB = 'Br',
  ETH = 'Ξ',
  EUR = '€',
  FJD = '$',
  FKP = '£',
  GBP = '£',
  GEL = '₾',
  GGP = '£',
  GHC = '₵',
  GHS = 'GH₵',
  GIP = '£',
  GMD = 'D',
  GNF = 'FG',
  GTQ = 'Q',
  GYD = '$',
  HKD = '$',
  HNL = 'L',
  HRK = 'kn',
  HTG = 'G',
  HUF = 'Ft',
  IDR = 'Rp',
  ILS = '₪',
  IMP = '£',
  INR = '₹',
  IQD = 'ع.د',
  IRR = '﷼',
  ISK = 'kr',
  JEP = '£',
  JMD = 'J$',
  JOD = 'JD',
  JPY = '¥',
  KES = 'KSh',
  KGS = 'лв',
  KHR = '៛',
  KMF = 'CF',
  KPW = '₩',
  KRW = '₩',
  KWD = 'KD',
  KYD = '$',
  KZT = '₸',
  LAK = '₭',
  LBP = '£',
  LKR = '₨',
  LRD = '$',
  LSL = 'M',
  LTC = 'Ł',
  LTL = 'Lt',
  LVL = 'Ls',
  LYD = 'LD',
  MAD = 'MAD',
  MDL = 'lei',
  MGA = 'Ar',
  MKD = 'ден',
  MMK = 'K',
  MNT = '₮',
  MOP = 'MOP$',
  MRO = 'UM',
  MRU = 'UM',
  MUR = '₨',
  MVR = 'Rf',
  MWK = 'MK',
  MXN = '$',
  MYR = 'RM',
  MZN = 'MT',
  NAD = '$',
  NGN = '₦',
  NIO = 'C$',
  NOK = 'kr',
  NPR = '₨',
  NZD = '$',
  OMR = '﷼',
  PAB = 'B/.',
  PEN = 'S/.',
  PGK = 'K',
  PHP = '₱',
  PKR = '₨',
  PLN = 'zł',
  PYG = 'Gs',
  QAR = '﷼',
  RMB = '￥',
  RON = 'lei',
  RSD = 'Дин.',
  RUB = '₽',
  RWF = 'R₣',
  SAR = '﷼',
  SBD = '$',
  SCR = '₨',
  SDG = 'ج.س.',
  SEK = 'kr',
  SGD = '$',
  SHP = '£',
  SLL = 'Le',
  SOS = 'S',
  SRD = '$',
  SSP = '£',
  STD = 'Db',
  STN = 'Db',
  SVC = '$',
  SYP = '£',
  SZL = 'E',
  THB = '฿',
  TJS = 'SM',
  TMT = 'T',
  TND = 'د.ت',
  TOP = 'T$',
  TRL = '₤',
  TRY = '₺',
  TTD = 'TT$',
  TVD = '$',
  TWD = 'NT$',
  TZS = 'TSh',
  UAH = '₴',
  UGX = 'USh',
  USD = '$',
  UYU = '$U',
  UZS = 'лв',
  VEF = 'Bs',
  VND = '₫',
  VUV = 'VT',
  WST = 'WS$',
  XAF = 'FCFA',
  XBT = 'Ƀ',
  XCD = '$',
  XOF = 'CFA',
  XPF = '₣',
  YER = '﷼',
  ZAR = 'R',
  ZWD = 'Z$'
}

export enum UOM_LONG {
  kg = 'kilogram',
  lb = 'pound',
  ml = 'milliliter',
  g = 'gram',
  L = 'liter',
  qt = 'quart',
  gal = 'gallon',
  mm = 'millimeter',
  cm = 'centimeter',
  m = 'meter',
  oz = 'ounce',
  mg = 'milligram',
  km = 'kilometer',
}

// These are the UOM values that will be displayed to the user.
// Changing the values here will change the UOM values in the
// search results.
// export enum UOM {
//   kg = 'kg',
//   lb = 'lb',
//   ml = 'ml',
//   g = 'g',
//   L = 'L',
//   qt = 'qt',
//   gal = 'gal',
//   mm = 'mm',
//   cm = 'cm',
//   m = 'm',
//   oz = 'oz',
//   mg = 'mg',
//   km = 'km',
// }

export enum UOM {
  KG = 'kg',
  LB = 'lb',
  ML = 'ml',
  G = 'g',
  L = 'L',
  QT = 'qt',
  GAL = 'gal',
  MM = 'mm',
  CM = 'cm',
  M = 'm',
  OZ = 'oz',
  MG = 'mg',
  KM = 'km',
}

export interface Settings {
  caching: boolean;
  autocomplete: boolean;
  currency: string;
  location: string;
  shipsToMyLocation: boolean;
  foo: string;
  jason: boolean;
  antoine: boolean;
  popupSize: string;
  autoResize: boolean;
  someSetting: boolean;
  suppliers: Array<string>;
}

export interface Item {
  id: number;
  name: string;
  deadline: Date;
  type: string;
  isComplete: boolean;
  nodes?: Item[];
}

export interface Sku {
  priceInfo: { regularPrice: number[] };
  variantsMap: { volume: number; 'chemical-grade': string; concentration: string };
  skuId: string;
  seoName: string;
  inventoryStatus: string;
  inventoryStatusMsg: string;
  specifications: { shippingInformation: string };
}

export interface Variant {
  price: number;
  quantity: number;
  sku: number;
  grade: string;
  conc: string;
  seoname: string;
  status: string;
  statusTxt: string;
  shippingInformation: string;
}

export interface SearchProps {
  query: string;
  setQuery: (value: string) => void;
}

export interface Supplier {
  supplierName: string;
  _query: string;
  _products: Array<Product>;
  _queryResults: Array<any>;
  _baseURL: string;
  _controller: AbortController;
  _limit: number;
  _httpRequestHardLimit: number;
}

export interface Product {
  supplier: string;
  title: string;
  url: string;
  manufacturer?: string;
  cas?: string;
  formula?: string;
  price: number;
  quantity: number;
  sku?: number;
  grade?: string;
  conc?: string;
  seoname?: string;
  status?: string;
  statusTxt?: string;
  shippingInformation?: string;
  variants?: Variant[];
}


export interface TabPanelProps {
  children?: ReactNode;
  dir?: string;
  index: number;
  value: number | string;
  style?: object;
  name: string;
}

export interface SettingsContextProps {
  settings: Settings;
  setSettings: (settings: Settings) => void;
}
