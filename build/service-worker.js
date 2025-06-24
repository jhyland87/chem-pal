const CACHE_VERSION = 1;
const CURRENT_CACHES = {
  query: `query-cache-v${CACHE_VERSION}`,
};
// caches.open(CURRENT_CACHES.query).then(cache => {
//   cache.keys().then((keys) => {
//     keys.forEach((request, index, array) => {
//       console.log({ index, request, array })
//     });
//   });
// })
/*
self.addEventListener("activate", (event) => {
  //console.log("import.meta.env.MODE:", import.meta.env.MODE);
  // Delete all caches that aren't named in CURRENT_CACHES.
  // While there is only one cache in this example, the same logic
  // will handle the case where there are multiple versioned caches.
  const expectedCacheNamesSet = new Set(Object.values(CURRENT_CACHES));
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames.map((cacheName) => {
          //console.log("import.meta.env.MODE:", import.meta.env.MODE);
          if (!expectedCacheNamesSet.has(cacheName)) {
            // If this cache name isn't present in the set of
            // "expected" cache names, then delete it.
            console.debug("Deleting out of date cache:", cacheName);
            return caches.delete(cacheName);
          }
        }),
      ),
    ),
  );
});

self.addEventListener("fetch", (event) => {
  console.debug("Handling fetch event for", event.request.url);
  console.log("import.meta.env.MODE:", import.meta.env.MODE);

  event.respondWith(
    caches.open(CURRENT_CACHES.query).then((cache) => {
      return cache
        .match(event.request)
        .then((response) => {
          console.log("import.meta.env.MODE:", import.meta.env.MODE);
          if (response) {
            // If there is an entry in the cache for event.request,
            // then response will be defined and we can just return it.
            // Note that in this example, only font resources are cached.
            console.debug(" Found response in cache:", response);

            return response;
          }

          // Otherwise, if there is no entry in the cache for event.request,
          // response will be undefined, and we need to fetch() the resource.
          console.debug(
            " No response for %s found in cache. About to fetch " + "from network…",
            event.request.url,
          );

          // We call .clone() on the request since we might use it
          // in a call to cache.put() later on.
          // Both fetch() and cache.put() "consume" the request,
          // so we need to make a copy.
          // (see https://developer.mozilla.org/en-US/docs/Web/API/Request/clone)
          return fetch(event.request.clone()).then((response) => {
            console.debug("  Response for %s from network is: %O", event.request.url, response);
            if (
              event.request.url.match("^(http|https)://") &&
              ["HEAD", "POST"].includes(event.request.method) === false
            ) {
              cache.put(event.request, response.clone());
            }

            // Return the original response object, which will be used to
            // fulfill the resource request.
            return response;
          });
        })
        .catch((error) => {
          // This catch() will handle exceptions that arise from the match()
          // or fetch() operations.
          // Note that a HTTP error response (e.g. 404) will NOT trigger
          // an exception.
          // It will return a normal response object that has the appropriate
          // error code set.
          console.error("  Error in fetch handler:", error);

          throw error;
        });
    }),
  );
});
*/
