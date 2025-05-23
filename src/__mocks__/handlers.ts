import { getRequestHash } from "helpers/request";
import { deserialize } from "helpers/utils";
import { DefaultBodyType, delay, http, HttpResponse, HttpResponseResolver, PathParams } from "msw";
import type { RequestHashObject } from "types/request.d";
import { AccessTokenResponse } from "types/wix";
// src/__mocks__/handlers.js

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

const mockHeaders = {
  headers: new Headers([["ismockedresponse", "true"]]),
};

export const handlers = [
  http.get<never, never, AccessTokenResponse>(
    "https://*/_api/v1/access-tokens",
    withDelay(150, async ({ request }) => {
      const response = await import("./responses/wix/access-tokens.json");
      return HttpResponse.json(response, mockHeaders);
    }),
  ),
  http.get<PathParams, DefaultBodyType, DefaultBodyType>(
    "https://*/*",
    withDelay(150, async ({ request }) => {
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

      //decodeURIComponent(_d(cachedData.content));
      if (cachedData.contentType.includes("json")) {
        return HttpResponse.json(
          JSON.parse(
            //decodeURIComponent(_d(cachedData.content))
            deserialize(cachedData.content),
          ),
          mockHeaders,
        );
      }
      return HttpResponse.text(
        //decodeURIComponent(_d(cachedData.content)), mockHeaders
        deserialize(cachedData.content),
        mockHeaders,
      );
    }),
  ),
  http.post<PathParams, DefaultBodyType, DefaultBodyType>(
    "https://*/*",
    withDelay(150, async ({ request }) => {
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

      //decodeURIComponent(_d(cachedData.content));
      if (cachedData.contentType.includes("json")) {
        return HttpResponse.json(
          JSON.parse(
            //decodeURIComponent(_d(cachedData.content))
            deserialize(cachedData.content),
          ),
          mockHeaders,
        );
      }
      return HttpResponse.text(
        //decodeURIComponent(_d(cachedData.content))
        deserialize(cachedData.content),
        mockHeaders,
      );
    }),
  ),
];
