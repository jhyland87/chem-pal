import _ from 'lodash';
import { Sku, Variant, Product } from "../interfaces"


export default class CarolinaSupplier<T extends Product> implements Iterable<T> {
  supplierName: string = 'Carolina'
  private _query: string
  private _limit: number
  //private _limit: number = 20
  private _products: Array<T> = []
  private _queryResults: any
  private _baseURL: string = 'https://www.carolina.com';
  private _headers: { [key: string]: string } = {
    //"accept": "application/json, text/javascript, */*; q=0.01",
    'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    "accept-language": "en-US,en;q=0.6",
    "cache-control": "no-cache",
    "pragma": "no-cache",
    "sec-ch-ua": "\"Brave\";v=\"135\", \"Not-A.Brand\";v=\"8\", \"Chromium\";v=\"135\"",
    "sec-ch-ua-arch": "\"arm\"",
    "sec-ch-ua-full-version-list": "\"Brave\";v=\"135.0.0.0\", \"Not-A.Brand\";v=\"8.0.0.0\", \"Chromium\";v=\"135.0.0.0\"",
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-model": "\"\"",
    "sec-ch-ua-platform": "\"macOS\"",
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "same-origin",
    "sec-gpc": "1",
    "x-requested-with": "XMLHttpRequest"
  }

  constructor(query: string, limit: number = 5) {
    this._query = query;
    this._limit = limit;
  }

  private async httpGet(url: string): Promise<Response> {
    return await fetch(url, {
      "headers": {
        ...this._headers,
        "accept": 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8'
      },
      "referrer": this._baseURL,
      "referrerPolicy": "strict-origin-when-cross-origin",
      "body": null,
      "method": "GET",
      "mode": "cors",
      "credentials": "include"
    });
  }

  public async init(): Promise<any> {
    try {
      await this.queryProducts();
      await this.parseProducts();
      return this._products;
    }
    catch (err) {
      console.debug('ERROR in init:', err)
    }
  }

  private _makeQueryUrl(query: string): string {
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

  private async queryProducts(): Promise<void> {
    const queryURL = this._makeQueryUrl(this._query)
    console.debug({ queryURL })
    const response = await this.httpGet(queryURL)

    if (!response.ok) {
      throw new Error(`Response status: ${response.status}`);
    }

    const resultHTML = await response.text();

    const parser = new DOMParser();
    const doc = parser.parseFromString(resultHTML, 'text/html');

    if (!doc) {
      throw new Error('Failed to load product HTML into DOMParser')
    }

    const productElements: NodeListOf<HTMLElement> = doc.querySelectorAll('div.tab-content > .tab-pane > .category-grid > div')

    const elementList = []

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
  }

  private async parseProducts(): Promise<any> {
    return Promise
      .all(this._queryResults.map((r: { href: string }) => this._getProductData(r.href.replace(/chrome-extension:\/\/[a-z]+/, ''))))
    //.then(results => console.debug('[parseProducts]:', { results, queryResults: this._queryResults }))
  }

  private async _getProductData(productUrl: string) {
    try {
      const response = await this.httpGet(`https://www.carolina.com${productUrl}`)
      if (!response.ok) {
        throw new Error(`Response status: ${response.status}`);
      }

      const data = await response.text();
      console.log('[_getProductData]:', { data })
      const parser = new DOMParser();
      const doc = parser.parseFromString(data, 'text/html');
      if (!doc) {
        throw new Error('Failed to load product HTML into DOMParser')
      }

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

      this._products.push(product as T)

    } catch (error: any) {
      console.error(error.message);
    }
  }

  results() {
    return this._products
  }

  // WHY WON'T THIS WORK
  *[Symbol.iterator](): Iterator<T> {
    for (const item of this._products) {
      console.log('Printing item:', item)
      yield item;
    }
  }
}
