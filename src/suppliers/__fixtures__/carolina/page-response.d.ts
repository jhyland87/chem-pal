/* eslint-disable @typescript-eslint/naming-convention */
// To parse this data:
//
//   import { Convert, ProductListByKeyword } from "./file";
//
//   const productListByKeyword = Convert.toProductListByKeyword(json);

export interface ProductListByKeyword {
  templateType: string;
  breadCrumbSchemaJson: ProductListByKeywordBreadCrumbSchemaJson;
  metadata: ProductListByKeywordMetadata;
  dataLayerObjectList: string;
  pageTitle: string;
  "@type": string;
  contentId: string;
  enableLoadImageAsLink: string;
  previewMode: boolean;
  responseStatusCode: number;
  contents: ProductListByKeywordContents;
  containerContentId: string;
  schemaJson: FamilyVariyantProductDetailsSchemaJson;
  pageImagesList: string[];
  attributes: ProductListByKeywordAttributes;
  executionStartTime: number;
}

export interface ProductListByKeywordAttributes {
  showAccessB: string;
  showLiveChat: string;
  defaultHeaderFooterGroup: string;
  width: string;
  selectedTimeZone: string;
  selectTemplate: string;
  class: string;
  needLoginAccess: NeedLoginAccess;
}

export enum NeedLoginAccess {
  N = "N",
}

export interface ProductListByKeywordBreadCrumbSchemaJson {
  "@context": string;
  itemListElement: ItemListElement[];
  "@type": string;
}

export interface ItemListElement {
  item: Item;
  "@type": string;
  position: number;
}

export interface Item {
  name: string;
  "@id": string;
}

export interface ProductListByKeywordContents {
  MainContent: MainContent[];
  HeaderContent: HeaderContent[];
  PopupContent: any[];
  FooterContent: FooterContent[];
}

export interface FooterContent {
  templateType: Type;
  metadata: PunchoutTargeterResultClass;
  contents: FooterContentContents;
  "@type": string;
  containerContentId: string;
  contentId: string;
  attributes: FooterContentAttributes;
  executionStartTime: number;
  previewMode: boolean;
}

export interface FooterContentAttributes {
  noOfContentsToInclude: string;
  renderAsTab: NeedLoginAccess;
  needLoginAccess: NeedLoginAccess;
}

export interface FooterContentContents {
  ContentFolderZone: PurpleContentFolderZone[];
}

export interface PurpleAttributes {
  noOfContentsToInclude: string;
  renderAsTab: NeedLoginAccess;
  folderContentsType: Type;
  folderName: string;
}

export enum Type {
  Plugin = "plugin",
}

export enum TypeEnum {
  ContentRule = "ContentRule",
}

export interface FluffyAttributes {
  rawContentTitle: string;
  htmlFormattedContent: string;
  htmlRawContent: string;
  needLoginAccess: NeedLoginAccess;
}

type PunchoutTargeterResultClass = Record<string, never>;

export interface TentacledAttributes {
  triggerCondition: string;
  ruleTemplate: string;
  contentId: string;
  triggerConditionStr: string;
  priority: string;
  userSegment: string;
  status: string;
}

export interface HeaderContent {
  templateType: Type;
  metadata: PunchoutTargeterResultClass;
  cartSize: number;
  userSegments: string[];
  "@type": string;
  isPunchout: boolean;
  cookieBannerStatus: boolean;
  contentId: string;
  punchoutTargeterResult: PunchoutTargeterResultClass;
  targeterResult: string;
  previewMode: boolean;
  enableAbandonCartEmail: string;
  isSearchPage: boolean;
  total: string;
  isFlag: boolean;
  profileDetails: ProfileDetails;
  navMenu: NavMenu;
  containerContentId: string;
  productSearchPageUrl: string;
  tileMenu: TileMenu;
  attributes: HeaderContentAttributes;
  executionStartTime: number;
  contentSearchPageurl: string;
  cartList: any[];
}

export interface HeaderContentAttributes {
  targeterContentType: string;
  isCheckOutPage: string;
  needLoginAccess: NeedLoginAccess;
  targeter: string;
}

export interface NavMenu {
  Menus: any[];
  ContentFolderZone: NavMenuContentFolderZone[];
}

export interface StickyAttributes {
  folderContentsType: string;
  folderName: string;
}

export enum RuleTemplate {
  NewMenu = "NewMenu",
}

export interface IndigoAttributes {
  selectedFacets: string;
  displayName: string;
  noOfContentsToInclude: string;
  renderAsTab?: NeedLoginAccess;
  link: string;
  navSubText: NavSubText;
  linkType: LinkType;
  topMenuName: string;
  selectedFacetsStr: string;
  needLoginAccess?: NeedLoginAccess;
  description?: string;
}

export enum LinkType {
  Facets = "facets",
  Text = "text",
  Tile = "tile",
}

export enum NavSubText {
  ActivitiesCareMSDSAndMore = "Activities, Care, (M)SDS, and More",
  Empty = "",
  ShopByCategory = "Shop by Category",
}

export interface PurpleContents {
  ContentFolderZone: FluffyContentFolderZone[];
}

export interface MostPopular {
  link: string;
  description: string;
  displayName: string;
  imageUrl?: string;
  productCategoryId?: string;
}

export interface IndecentAttributes {
  parentFolder: string;
  triggerCondition: string;
  ruleTemplate: RuleTemplate;
  contentId: string;
  ruleEndDateTime: string;
  triggerConditionStr: string;
  priority: string;
  userSegment: string;
  ruleStartDateTime: string;
  status: string;
}

export interface ProfileDetails {
  result: string;
  response: ProfileDetailsResponse;
  status: string;
}

export interface ProfileDetailsResponse {
  securityStatusCookie: number;
  miniCartDetails: MiniCartDetails;
  transient: boolean;
  userTypeCheck: PunchoutTargeterResultClass;
  enableOrderSubmission: boolean;
  hidePrice: string;
  miniCartCount: number;
  mergeOrderFlag: boolean;
  securityStatus: number;
  userSegment: { [key: string]: boolean };
}

export interface MiniCartDetails {
  hazmatDetail: PunchoutTargeterResultClass;
  subTotal: string;
  cartItems: any[];
  orderId: string;
}

export interface TileMenu {
  Menus: any[];
  ContentFolderZone: TileMenuContentFolderZone[];
}

export interface MainContent {
  templateType: Type;
  currentProductName: string;
  bvUrl: string;
  imageZoom: string;
  "@type": string;
  contentId: string;
  previewMode: boolean;
  breadCrumbDataLayer: BreadCrumbDataLayer;
  containerContentId: string;
  domainName: string;
  breadCrumb: BreadCrumb;
  resourcesOrderList: string[];
  attributes: PunchoutTargeterResultClass;
  executionStartTime: number;
  atgResponse: AtgResponse;
}

export interface AtgResponse {
  result: string;
  response: AtgResponseResponse;
}

export interface AtgResponseResponse {
  response: ResponseResponse;
  status: string;
}

export interface ResponseResponse {
  breadCrumbSchemaJson: ResponseBreadCrumbSchemaJson;
  longDescription: string;
  product: string;
  dataLayer: DataLayer;
  canonicalUrl: string;
  isDLProduct: boolean;
  displayName: string;
  isDiscontinuedItem: boolean;
  isproductGrouping: boolean;
  shortDescription: string;
  prodType: string;
  familyVariyantProductDetails: FamilyVariyantProductDetails;
  familyVariyantDisplayName: string;
}

export interface ResponseBreadCrumbSchemaJson {
  breadCrumbSchemaJson: string;
  dataLayer_obj: BreadCrumbDataLayer;
}

export interface BreadCrumbDataLayer {
  "dataLayer_obj.productSubCat1": string;
  "dataLayer_obj.productSubCat2": string;
  "dataLayer_obj.productSubCat3": string;
}

export interface DataLayer {
  productDetail: ProductDetail;
  dataLayerObject: DataLayerObject;
}

export interface DataLayerObject {
  dataLayerJson: DataLayerJson;
}

export interface DataLayerJson {
  customer_type: string;
  customer_country: string;
  cart_total_value: string;
  page_type: string;
  cart_total_items: string;
  cart_product_quantity: any[];
  currency_code: string;
  content_title: string;
  language_code: string;
  cart_product_price: any[];
  tab_info: string;
  shipping_methods: any[];
  page_name: string;
  price_plan_id: string;
  customer_id: string;
  event: string;
  cart_product_id: any[];
  cart_product_names: any[];
}

export interface ProductDetail {
  productImageUrl: string;
  productId: string;
  productUrl: string;
  page_type: string;
  productName: string;
}

export interface FamilyVariyantProductDetails {
  productDisplayGridList: ProductDisplayGridList[];
  pdp_heading_label_qanda: string;
  productId: string;
  pdp_heading_label_recommended_accessories: string;
  familyProductId: string;
  hidePrice: string;
  variantUrl: string;
  pdp_ship_account_restriction_info: string;
  pdp_heading_label_questions: string;
  pdp_heading_label_addwishlist: string;
  pdp_heading_label_reviews: string;
  galleryJsonResult: GalleryJsonResult;
  schemaJson: FamilyVariyantProductDetailsSchemaJson;
  pdp_heading_label_specifications: string;
  pdp_heading_label_description: string;
  accessoriesCount: number;
  relatedResources: RelatedResources;
  productVariantsResult: ProductVariantsResult;
}

export interface GalleryJsonResult {
  addlImagesList: AddlImagesList[];
  smallImg: string;
  largeImg: string;
  detailImg: string;
  productFeatureVideosList: ProductFeatureVideosList[];
  mediumImg: string;
  addlTopImagesList: AddlTopImagesList[];
  thumbnailImg: string;
  featureVideosList: FeatureVideosList[];
  prodType: string;
  seoName: string;
}

export interface AddlImagesList {
  addlMediumImg: string;
  addlThumbnailImg: string;
  addlLargeImg: string;
}

export interface AddlTopImagesList {
  addlTopLargeImg: string;
  addlTopMediumImg: string;
  addlTopThumbnailImg: string;
}

export interface FeatureVideosList {
  videoURL: string;
  videoThumbnailPath: string;
}

export interface ProductFeatureVideosList {
  videoPath: string;
}

export interface ProductDisplayGridList {
  productDisplayGrid: ProductDisplayGrid;
}

export interface ProductDisplayGrid {
  scStatus: string;
  cbsInventoryLookUp: CbsInventoryLookUp;
  productId: string;
  reviewURLAverage?: string;
  displayName: string;
  hidePrice: string;
  qtyDiscountAvailable: boolean;
  imageURL: string;
  itemPrice: string;
  activeFlagCount: number;
  productUrl: string;
  skuId: string;
  basePrice: string;
  reviewAverage?: string;
}

export interface CbsInventoryLookUp {
  discontinuedItem: boolean;
  invStatus: number;
  long_message: string;
  show_price: boolean;
  invMessageToShowInCart: string;
  add_to_cart: boolean;
  stockLevel: number;
  bg_color: string;
  txt_color: string;
  pdp_inv_message: string;
  backOrdered: boolean;
  hasReplacement: boolean;
  dateOutput: string;
  invMessageToShowInSPCCart: string;
}

export interface ProductVariantsResult {
  metaImageURL: string;
  masterProductBean: MasterProductBean;
  metaPrice: number;
}

export interface MasterProductBean {
  staticLabels: StaticLabels;
  skus: Skus[];
  selectedSku: SelectedSku;
  allVariants: AllVariant[];
}

export interface AllVariant {
  groupName: string;
  groupId: string;
  values: Value[];
}

export interface Value {
  value: string;
  displayName: string;
  selected: string;
  sortOrder: number;
  status: string;
}

export interface SelectedSku {
  variant: Variant[];
  skuId: string;
}

export interface Variant {
  value: string;
  groupId: string;
}

export interface Skus {
  images: Image[];
  inventoryStatus: string;
  video: Video[];
  specifications: Specifications;
  seoName: string;
  prop65Message: string;
  chockingHazardMessage: string;
  priceInfo: PriceInfo;
  variantsMap: VariantsMap;
  validReplacementAvailable: boolean;
  brand: string;
  productDescription: string;
  inventoryStatusMsg: string;
  skuId: string;
}

export interface Image {
  caption: string;
  thumbNail: string;
  medium: string;
  large: string;
}

export interface PriceInfo {
  regularPrice: string[];
}

export interface Specifications {
  returnPolicy: string;
  specs: any[];
  whatsIncludedList: any[];
  shippingInformation: string;
  whatsExcludedList: any[];
}

export interface VariantsMap {
  product: string;
}

export interface Video {
  videoUrl: string;
  thumbNail: string;
}

export interface StaticLabels {
  returnPolicy: string;
  specFeatures: string;
  includedList: string;
  shippingInfo: string;
  excludedList: string;
}

export interface RelatedResources {
  resourceItemsList: ResourceItemsList[];
}

export interface ResourceItemsList {
  cUrl: string;
  contentMediaType: string;
  keyValue: string;
  displayName: string;
  categoryIconMap: CategoryIconMap;
}

export interface CategoryIconMap {
  "10849": string;
  "10857": string;
  "11602": string;
  "11603": string;
  "11605": string;
  "11707": string;
  "20301": string;
  "25801": string;
  "32004": string;
  "35201": string;
  chokingHazard: string;
  prop65: string;
}

export interface FamilyVariyantProductDetailsSchemaJson {
  schemaJson: SchemaJsonSchemaJson;
}

export interface SchemaJsonSchemaJson {
  offers: Offer[];
  image: string;
  "@type": string;
  name: string;
  description: string;
  "@id": string;
  sku: string;
  "@context": string;
  url: string;
}

export interface Offer {
  image: string;
  priceCurrency: string;
  "@type": string;
  price: number;
  name: string;
  description: string;
  availability: string;
  sku: string;
  url: string;
  itemCondition: string;
}

export interface BreadCrumb {
  ancestors: Ancestor[];
}

export interface Ancestor {
  link: string;
  navigationState: string;
  label: string;
}

export interface ProductListByKeywordMetadata {
  currentPageTitle: string;
  parentCategoryName: string;
  metaKeywords: string;
  currentPageImage: string;
  pageUrl: string;
  parentCategoryId: string;
  metaDescription: string;
  currentProductId: string;
}

// --- Base Interface for Shared Fields ---
export interface BaseContent {
  templateType: Type;
  metadata: PunchoutTargeterResultClass;
  "@type": string;
  containerContentId: string;
  contentId: string;
  executionStartTime: number;
  previewMode: boolean;
}

// --- Generic Templates for Repeated Patterns ---
export interface ContentFolderZone<ChildRuleType, AttributesType> extends BaseContent {
  folderPath: string;
  childRules: ChildRuleType[];
  attributes: AttributesType;
}

export interface RuleBase extends BaseContent {
  pageTitle: string;
  ruleId: string;
}

export interface ChildRule<AttributesType, ContentRuleZoneType> extends RuleBase {
  attributes: AttributesType;
  ContentRuleZone: ContentRuleZoneType[];
}

export interface ContentRuleZone<ContentsType, AttributesType> extends BaseContent {
  contents: ContentsType;
  attributes: AttributesType;
  // containerContentId is already optional in some usages, so keep as is
}
// --- End Generic Templates ---

// --- Aliases for Specific Types ---
export type PurpleContentFolderZone = ContentFolderZone<PurpleChildRule, PurpleAttributes>;
export type FluffyContentFolderZone = ContentFolderZone<TentacledChildRule, StickyAttributes>;
export type TileMenuContentFolderZone = ContentFolderZone<StickyChildRule, StickyAttributes>;
export type NavMenuContentFolderZone = ContentFolderZone<FluffyChildRule, StickyAttributes>;

export type PurpleChildRule = ChildRule<TentacledAttributes, PurpleContentRuleZone>;
export type FluffyChildRule = ChildRule<IndecentAttributes, FluffyContentRuleZone>;
export type TentacledChildRule = ChildRule<IndecentAttributes, TentacledContentRuleZone>;
export type StickyChildRule = ChildRule<IndecentAttributes, StickyContentRuleZone>;

export type PurpleContentRuleZone = ContentRuleZone<PunchoutTargeterResultClass, FluffyAttributes>;
export type FluffyContentRuleZone = ContentRuleZone<PurpleContents, IndigoAttributes>;
export type TentacledContentRuleZone = ContentRuleZone<FooterContentContents, IndigoAttributes>;
export type StickyContentRuleZone = ContentRuleZone<FooterContentContents, IndigoAttributes>;
// --- End Aliases ---
