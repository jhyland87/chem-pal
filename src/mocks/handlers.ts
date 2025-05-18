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
