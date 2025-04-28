import _ from 'lodash';
import { Sku, Variant } from "../interfaces"
//import createData from '../components/ResultsTable'

export default class CarolinaSupplier<T> implements Iterable<T> {
  private _query: string
  //private _limit: number = 20
  private _products: Array<T> = []
  private _queryResults: any
  private _baseURL: string = 'https://www.carolina.com';
  private _headers: { [key: string]: string } = {
    "accept": "application/json, text/javascript, */*; q=0.01",
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

  constructor(query: string) {
    this._query = query;
    //this.limit = limit;

    this.init()
  }

  private async httpGet(url: string): Promise<Response> {
    return await fetch(url, {
      "headers": this._headers,
      "referrer": this._baseURL,
      "referrerPolicy": "strict-origin-when-cross-origin",
      "body": null,
      "method": "GET",
      "mode": "cors",
      "credentials": "include"
    });
  }

  private async jsonGet(url: string): Promise<Response> {
    const response = await this.httpGet(url)
    const jsonResponse = await response.json()
    return jsonResponse
  }

  private async init(): Promise<void> {
    try {
      await this.queryProducts();
      await this.parseProducts();
    }
    catch (err) {
      console.debug('ERROR in init:', err)
    }
  }

  private async queryProducts(): Promise<void> {
    const params = new URLSearchParams({
      Dy: '1',
      Nty: '1',
      Ntt: this._query,
      _: new Date().toISOString()
    });

    this._queryResults = await this.jsonGet(`${this._baseURL}/includes/gadgets/type-ahead-new.jsp?${params.toString()}`)
    this._queryResults = this._queryResults.productTypeaheadSuggestions.records.map((r: { label: string; link: string }) => ({ name: r.label, href: r.link.replaceAll('&#039;', '') }))
  }

  private async parseProducts(): Promise<any> {
    return Promise
      .all(this._queryResults.map((r: { name: string; href: string }) => this._getProductData(r.href)))
      .then(this._insertProducts)
  }

  private async _insertProducts(results: Array<T>) {
    for (const result of results) {
      console.log('result:', result)
      //createData(result.name, result.price, result.quantity, result.supplier, result.manufacturer)
    }
  }

  private async _getProductData(productUrl: string) {

    try {
      const response = await this.httpGet(`https://www.carolina.com${productUrl}`)
      if (!response.ok) {
        throw new Error(`Response status: ${response.status}`);
      }

      const data = await response.text();

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

      const pdpDataTxt = Array.from(doc.getElementsByTagName("script"))
        .filter(s => s.innerText.includes('pdpData'))[0].innerText
        .replace('\n\t\t\twindow.pdpData = ', '')
        .replace(/(?<=});(\n|\t|.)*$/mgi, '')

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

      return {
        title, url,
        manufacturer: "test",
        cas: description['casNo'],
        formula: description['formula'],
        ...defaultVariant,
        variants
      }

    } catch (error: any) {
      console.error(error.message);
    }
  }

  *[Symbol.iterator](): Iterator<T> {
    for (const item of this._products) {
      yield item;
    }
  }
}
