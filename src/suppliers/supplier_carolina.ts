import _ from '../lodash';
import { parseQuantity } from '../helpers/quantity';
import { Sku, Variant, Product, HeaderObject, QuantityMatch } from "../types"
import SupplierBase from './supplier_base'

/**
 * Carolina.com uses Oracle ATG Commerce as their ecommerce platform.
 *
 * The ATG Commerce platform uses a custom script to fetch product data.
 * This script is located in the `script[nonce]` element of the product page.
 *
 * The script is a JSON object that contains the product data.
 *
 * Product search for Carolina.com will query the following URL (with `lithium` as the search query):
 *
 *  https://www.carolina.com/browse/product-search-results? \
 *    product.productTypes=chemicals \
 *    &facetFields=product.productTypes
 *    &defaultFilter=product.cbsLowPrice|GT%200.0||product.startDate|LTEQ%201.7457984E12||product.startDate|LTEQ%201.7457984E12 \
 *    &Nr=AND(product.siteId:100001,OR(product.type:Product),OR(product.catalogId:cbsCatalog)) \
 *    &viewSize=120 \
 *    &q=lithium \
 *    &noRedirect=true \
 *    &nore=y \
 *    &searchExecByFormSubmit=true \
 *    &tab=p \
 *    &question=lithium
 *
 * The query params are:
 * - product.productTypes: The product type to search for.
 * - facetFields: The fields to facet on.
 * - defaultFilter: The default filter to apply to the search.
 * - Nr: ???
 * - viewSize: The number of results to return per page.
 * - q: The search query.
 * - noRedirect: Whether to redirect to the search results page.
 * - nore: Whether to return the results in a non-redirecting format.
 * - searchExecByFormSubmit: Whether to execute the search by form submission.
 * - tab: The tab to display the results in.
 * - question: The search query.
 */


export default class SupplierCarolina<T extends Product> extends SupplierBase<T> implements AsyncIterable<T> {
  // Name of supplier (for display purposes)
  public readonly supplierName: string = 'Carolina'

  // Base URL for HTTP(s) requests
  protected _baseURL: string = 'https://www.carolina.com';

  // This is a limit to how many queries can be sent to the supplier for any given query.
  protected _httpRequestHardLimit: number = 50

  // Used to keep track of how many requests have been made to the supplier.
  protected _http_requst_count: number = 0;

  // If using async requests, this will determine how many of them to batch together (using
  // something like Promise.all()). This is to avoid overloading the users bandwidth and
  // to not flood the supplier with 100+ requests all at once.
  protected _http_request_batch_size: number = 10;

  // HTTP headers used as a basis for all queries.
  protected _headers: HeaderObject = {
    //"accept": "application/json, text/javascript, */*; q=0.01",
    'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'accept-language': 'en-US,en;q=0.6',
    'cache-control': 'no-cache',
    'pragma': 'no-cache',
    'sec-ch-ua': '"Brave";v="135\', "Not-A.Brand";v="8\', "Chromium";v="135"',
    'sec-ch-ua-arch': '"arm"',
    'sec-ch-ua-full-version-list': '"Brave";v="135.0.0.0\', "Not-A.Brand";v="8.0.0.0\', "Chromium";v="135.0.0.0"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-model': '""',
    'sec-ch-ua-platform': '"macOS"',
    'sec-fetch-dest': 'empty',
    'sec-fetch-mode': 'cors',
    'sec-fetch-site': 'same-origin',
    'sec-gpc': '1',
    'x-requested-with': 'XMLHttpRequest'
  }

  //constructor(query: string, limit: number = 5, controller: AbortController) {
  //  super(query, limit, controller);
  //}

  protected _makeQueryUrl(query: string): string {
    const searchParams: Record<string, any> = {
      /*
      790004999   Chemicals category ID
      836054137   ACS grade
      471891351   Lab grade
      3929848101  Reagent grade
      */
      'N': 790004999,
      'Nf': 'product.cbsLowPrice|GT 0.0||product.startDate|LTEQ 1.7457984E12||product.startDate|LTEQ 1.7457984E12',
      'Nr': 'AND(product.siteId:100001,OR(product.type:Product),OR(product.catalogId:cbsCatalog))',
      // Number of products to display
      'Nrpp': 120,
      // Query string
      'Ntt': query,
      'noRedirect': true,
      // No idea
      'nore': 'y',
      // Query string
      'question': query,
      'searchExecByFormSubmit': true,
      // Products tab
      'tab': 'p'
    }
    const url = new URL('/browse/product-search-results', this._baseURL);
    const params = new URLSearchParams(searchParams);
    url.search = params.toString()
    return url.toString()
  }

  protected async queryProducts(): Promise<void> {
    const queryURL = this._makeQueryUrl(this._query)
    //console.debug({ queryURL })
    const response = await this.httpGet(queryURL)

    if (!response?.ok) {
      throw new Error(`Response status: ${response?.status}`);
    }

    const resultHTML = await response.text();
    //console.log('resultHTML:', resultHTML)

    const parser = new DOMParser();
    const doc = parser.parseFromString(resultHTML, 'text/html');

    if (!doc) {
      throw new Error('Failed to load product HTML into DOMParser')
    }

    const productElements: NodeListOf<HTMLElement> = doc.querySelectorAll('div.c-feature-product')
    //console.log('productElements:', productElements)

    const elementList: { title: string; href: string; prices: string; count: string }[] = []

    const _trimSpaceLike = (txt: string) => txt?.replaceAll(/(^(\\n|\\t|\s)*|(\\n|\\t|\s)*$)/gm, '')

    for (const elem of productElements) {
      elementList.push({
        title: _trimSpaceLike((elem.querySelector('h3.c-product-title') as HTMLElement)?.innerText),
        href: _trimSpaceLike((elem.querySelector('a.c-product-link') as HTMLAnchorElement)?.href?.replace(/chrome-extension:\/\/[a-z]+/, '')),
        prices: _trimSpaceLike((elem.querySelector('p.c-product-price') as HTMLElement)?.innerText),
        count: _trimSpaceLike((elem.querySelector('p.c-product-total') as HTMLElement)?.innerText)
      })
    }

    this._queryResults = elementList.slice(0, this._limit)
    //console.log('[queryProducts] this._queryResults:', this._queryResults)
  }

  protected async parseProducts(): Promise<any> {
    return Promise.all(this._queryResults.map((result) => this._getProductData(result)))
    //.then(results => console.debug('[parseProducts]:', { results, queryResults: this._queryResults }))
  }

  protected async _getProductData(productIndexObject: { href: string; title: string; prices: string; count: string }): Promise<Product | void> {
    try {
      const response = await this.httpGet(`https://www.carolina.com${productIndexObject.href}`)
      if (!response?.ok) {
        throw new Error(`Response status: ${response?.status}`);
      }

      const data = await response.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(data, 'text/html');
      if (!doc) {
        throw new Error('Failed to load product HTML into DOMParser')
      }

      let productScriptNonce = doc.querySelector('script[nonce]');
      if (!productScriptNonce) {
        throw new Error('Failed to find product script nonce')
      }

      const productScriptNonceText = productScriptNonce.textContent;
      if (!productScriptNonceText) {
        throw new Error('Failed to find product script nonce text')
      }

      const productScriptNonceTextMatch = productScriptNonceText.match('(?<== )(.*)(?=;\\n)');

      if (!productScriptNonceTextMatch) {
        throw new Error('Failed to find product script nonce text')
      }

      const productAtgJson = JSON.parse(productScriptNonceTextMatch[0])
      //console.debug('productAtgJson:', productAtgJson)

      const productData: any = _.result(productAtgJson, 'fetch.response.contents.MainContent[0].atgResponse.response.response');

      if (!productData) {
        throw new Error('Failed to find product data')
      }

      //console.debug('productData:', productData)

      const quantityMatch: QuantityMatch = parseQuantity(productData.displayName)

      //console.debug('quantityMatch:', quantityMatch)

      // The price can be stored at different locations in the productData object. Select them all then
      // choose the first non-undefined, non-null value.
      const price = _(productData)
        .at([
          'dataLayer.productPrice[0]',
          'familyVariyantProductDetails.productVariantsResult.masterProductBean.skus[0].priceInfo.regularPrice[0]'
        ])
        .compact()
        .result('[0]')

      //console.debug('price:', price)


      const product = {
        supplier: this.supplierName,
        title: productData.displayName,
        url: this._baseURL + productData.canonicalUrl,
        price: price,
        ...quantityMatch
      }

      console.debug('[getProductData] product:', product)

      return product as Product;

      //JSON.parse(document.querySelector('script[nonce]').innerText.match('(?<== )(.*)(?=;\\n)')[0]).fetch.response.contents.MainContent[0].atgResponse.response.response

      /*
      let description: { casNo?: string; formula?: string } = {}
      const descMeta = doc.querySelector('meta[name=description]')

      const descMetaContent = (descMeta as HTMLMetaElement).content;

      if (descMetaContent) {
        description = Object.fromEntries(
          descMetaContent.trim().split('\n')
            .map(e => e.split(':'))
            .map(([k, v]) => ([_.camelCase(k?.trim()), v?.trim()]))
        )
      }

      //const sku = parseInt((doc.getElementById('pdp-skuId') as HTMLMetaElement).innerText)
      const title = (doc.querySelector('meta[property="og:title"]') as HTMLMetaElement).content
      const url = (doc.querySelector('meta[property="og:url"]') as HTMLMetaElement).content

      const pdpDataElem = Array.from(doc.getElementsByTagName("script"))
        .filter(s => s.innerText.includes('pdpData'))?.[0]?.innerText

      if (!pdpDataElem) {
        console.warn('Unable to find or parse pdpData')
        return
      }

      // https://regex101.com/r/3OhYbo/1
      const pdpDataTxt = pdpDataElem.replace(/(?:^.*window.pdpData = (?={)|(?<=});(?:\n|\t|.)*$)/mgi, '')
      const json_data = JSON.parse(pdpDataTxt)

      const variants: Variant[] = json_data.skus.map((s: Sku) => ({
        price: s.priceInfo.regularPrice[0],
        quantity: s.variantsMap.volume,
        sku: parseInt(s.skuId),
        grade: s.variantsMap['chemical-grade'],
        conc: s.variantsMap.concentration,
        seoname: s.seoName,
        status: s.inventoryStatus,
        statusTxt: s.inventoryStatusMsg,
        shippingInformation: s.specifications.shippingInformation
      }));

      const defaultVariant = variants.filter(v => v.sku == json_data.selectedSku.skuId)?.[0] || {}

      const product = {
        supplier: this.supplierName,
        title, url,
        manufacturer: "test",
        cas: description['casNo'],
        formula: description['formula'],
        ...defaultVariant,
        variants
      }

      this._products.push(product as T);
      return product as T;
      */

    } catch (error: any) {
      console.error(error.message);
    }
  }
}

