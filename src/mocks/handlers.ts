import { DefaultBodyType, delay, http, HttpResponse, HttpResponseResolver, PathParams } from "msw";
import { getRequestHash } from "../helpers/request";
import { RequestHashObject } from "../helpers/request.d";
import { AccessTokenResponse } from "../suppliers/supplier_wixbase.d";
// src/mocks/handlers.js

function withDelay<
  // Recreate the generic signature of the HTTP resolver
  // so the arguments passed to "http.get" propagate here.
  Params extends PathParams,
  RequestBodyType extends DefaultBodyType,
  ResponseBodyType extends DefaultBodyType,
>(
  durationMs: number,
  resolver: HttpResponseResolver<Params, RequestBodyType, ResponseBodyType>,
): HttpResponseResolver<Params, RequestBodyType, ResponseBodyType> {
  return async (...args) => {
    await delay(durationMs);
    return resolver(...args);
  };
}

export const handlers = [
  http.get<never, never, AccessTokenResponse>(
    "https://*/_api/v1/access-tokens",
    withDelay(250, async ({ request }) => {
      const response = await import("./responses/wix/access-tokens.json");
      return HttpResponse.json(response);
    }),
  ),
  http.get<PathParams, DefaultBodyType, DefaultBodyType>(
    "https://*/*",
    withDelay(250, async ({ request }) => {
      const reqHash = getRequestHash(request) as RequestHashObject;

      // Trying to dynamically import ./responses/${reqUrl.hostname}/${reqUrl.path}/${searchQuery}.json will cause the exception:
      //
      //    Error: Unknown variable dynamic import: ./responses/www.biofuranchem.com/_api/wix-ecommerce-storefront-web/api/acid.json.
      //    Note that variables only represent file names one level deep.
      //
      // Thus, just like how the python request_cache library works, ill be storing and referencing the files by their hash instead of the filename.

      console.debug("Looking for cached response at:", `./responses/${reqHash.file}`);
      const cachedData = await import(/* @vite-ignore */ `./responses/${reqHash.file}`);

      console.debug("HANDLER cachedData:", cachedData);

      const _d = (data: string) => {
        debugger;
        return atob(data);
      };

      //decodeURIComponent(_d(cachedData.content));
      if (cachedData.contentType.includes("json")) {
        return HttpResponse.json(JSON.parse(decodeURIComponent(_d(cachedData.content))));
      }
      return HttpResponse.text(decodeURIComponent(_d(cachedData.content)));
    }),
  ),
];

//o=getFilteredProducts
//s=WixStoresWebClient
//q="query%2CgetFilteredProductsWithHasDiscount%28%24mainCollectionId%3AString%21%2C%24filters%3AProductFilters%2C%24sort%3AProductSort%2C%24offset%3AInt%2C%24limit%3AInt%2C%24withOptions%3ABoolean%2C%3D%2Cfalse%2C%24withPriceRange%3ABoolean%2C%3D%2Cfalse%29%7Bcatalog%7Bcategory%28categoryId%3A%24mainCollectionId%29%7BnumOfProducts%2CproductsWithMetaData%28filters%3A%24filters%2Climit%3A%24limit%2Csort%3A%24sort%2Coffset%3A%24offset%2ConlyVisible%3Atrue%29%7BtotalCount%2Clist%7Bid%2Coptions%7Bid%2Ckey%2Ctitle%2C%40include%28if%3A%24withOptions%29%2CoptionType%2C%40include%28if%3A%24withOptions%29%2Cselections%2C%40include%28if%3A%24withOptions%29%7Bid%2Cvalue%2Cdescription%2Ckey%2CinStock%7D%7DproductItems%2C%40include%28if%3A%24withOptions%29%7Bid%2CoptionsSelections%2Cprice%2CformattedPrice%7DproductType%2Cprice%2Csku%2CisInStock%2CurlPart%2CformattedPrice%2Cname%2Cdescription%2Cbrand%2CpriceRange%28withSubscriptionPriceRange%3Atrue%29%2C%40include%28if%3A%24withPriceRange%29%7BfromPriceFormatted%7D%7D%7D%7D%7D%7D"
//v="%7B%22mainCollectionId%22%3A%2200000000-000000-000000-000000000001%22%2C%22offset%22%3A0%2C%22limit%22%3A10%2C%22sort%22%3Anull%2C%22filters%22%3A%7B%22term%22%3A%7B%22field%22%3A%22name%22%2C%22op%22%3A%22CONTAINS%22%2C%22values%22%3A%5B%22*acid*%22%5D%7D%7D%2C%22withOptions%22%3Atrue%2C%22withPriceRange%22%3Afalse%7D"
