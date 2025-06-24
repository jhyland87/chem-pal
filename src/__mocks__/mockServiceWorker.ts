/// <reference lib="webworker" />

/**
 * Mock Service Worker.
 * @see https://github.com/mswjs/msw
 * - Please do NOT modify this file.
 * - Please do NOT serve this file on production.
 */

// @ts-ignore: Service worker global scope has additional properties
const swSelf = self as any;

interface MessagePayload {
  type: string;
  payload?: any;
  data?: any;
}

interface MockResponse {
  status: number;
  body: any;
  [key: string]: any;
}

const PACKAGE_VERSION = "2.8.3";
const INTEGRITY_CHECKSUM = "00729d72e3b82faf54ca8b9621dbb96f";
const IS_MOCKED_RESPONSE = Symbol("isMockedResponse");
const activeClientIds = new Set<string>();

swSelf.addEventListener("install", function () {
  swSelf.skipWaiting();
});

swSelf.addEventListener("activate", function (event: any) {
  event.waitUntil(swSelf.clients.claim());
});

swSelf.addEventListener("message", async function (event: any) {
  const clientId = (event.source as any)?.id;

  if (!clientId || !swSelf.clients) {
    return;
  }

  const client = await swSelf.clients.get(clientId);

  if (!client) {
    return;
  }

  const allClients = await swSelf.clients.matchAll({
    type: "window",
  });

  switch (event.data) {
    case "KEEPALIVE_REQUEST": {
      sendToClient(client, {
        type: "KEEPALIVE_RESPONSE",
      });
      break;
    }

    case "INTEGRITY_CHECK_REQUEST": {
      sendToClient(client, {
        type: "INTEGRITY_CHECK_RESPONSE",
        payload: {
          packageVersion: PACKAGE_VERSION,
          checksum: INTEGRITY_CHECKSUM,
        },
      });
      break;
    }

    case "MOCK_ACTIVATE": {
      activeClientIds.add(clientId);

      sendToClient(client, {
        type: "MOCKING_ENABLED",
        payload: {
          client: {
            id: client.id,
            frameType: client.frameType,
          },
        },
      });
      break;
    }

    case "MOCK_DEACTIVATE": {
      activeClientIds.delete(clientId);
      break;
    }

    case "CLIENT_CLOSED": {
      activeClientIds.delete(clientId);

      const remainingClients = allClients.filter((client: Client) => {
        return client.id !== clientId;
      });

      // Unregister itself when there are no more clients
      if (remainingClients.length === 0) {
        swSelf.registration.unregister();
      }

      break;
    }
  }
});

swSelf.addEventListener("fetch", function (event: any) {
  const { request } = event;

  // Bypass navigation requests.
  if (request.mode === "navigate") {
    return;
  }

  // Opening the DevTools triggers the "only-if-cached" request
  // that cannot be handled by the worker. Bypass such requests.
  if (request.cache === "only-if-cached" && request.mode !== "same-origin") {
    return;
  }

  // Bypass all requests when there are no active clients.
  // Prevents the self-unregistered worked from handling requests
  // after it's been deleted (still remains active until the next reload).
  if (activeClientIds.size === 0) {
    return;
  }

  // Generate unique request ID.
  const requestId = crypto.randomUUID();
  event.respondWith(handleRequest(event, requestId));
});

async function handleRequest(event: any, requestId: string): Promise<Response> {
  const client = await resolveMainClient(event);
  const response = await getResponse(event, client, requestId);

  // Send back the response clone for the "response:*" life-cycle events.
  // Ensure MSW is active and ready to handle the message, otherwise
  // this message will pend indefinitely.
  if (client && activeClientIds.has(client.id)) {
    (async function () {
      const responseClone = response.clone();

      sendToClient(
        client,
        {
          type: "RESPONSE",
          payload: {
            requestId,
            isMockedResponse: IS_MOCKED_RESPONSE in response,
            type: responseClone.type,
            status: responseClone.status,
            statusText: responseClone.statusText,
            body: responseClone.body,
            headers: Object.fromEntries((responseClone.headers as any).entries()),
          },
        },
        responseClone.body ? [responseClone.body] : [],
      );
    })();
  }

  return response;
}

// Resolve the main client for the given event.
// Client that issues a request doesn't necessarily equal the client
// that registered the worker. It's with the latter the worker should
// communicate with during the response resolving phase.
async function resolveMainClient(event: any): Promise<any> {
  const client = await swSelf.clients.get(event.clientId);

  if (client && activeClientIds.has(event.clientId)) {
    return client;
  }

  if (client?.frameType === "top-level") {
    return client;
  }

  const allClients = await swSelf.clients.matchAll({
    type: "window",
  });

  return allClients
    .filter((client: any) => {
      // Get only those clients that are currently visible.
      return client.visibilityState === "visible";
    })
    .find((client: any) => {
      // Find the client ID that's recorded in the
      // set of clients that have registered the worker.
      return activeClientIds.has(client.id);
    });
}

async function getResponse(event: any, client: any, requestId: string): Promise<Response> {
  const { request } = event;

  // Clone the request because it might've been already used
  // (i.e. its body has been read and sent to the client).
  const requestClone = request.clone();

  function passthrough(): Promise<Response> {
    // Cast the request headers to a new Headers instance
    // so the headers can be manipulated with.
    const headers = new Headers(requestClone.headers);

    // Remove the "accept" header value that marked this request as passthrough.
    // This prevents request alteration and also keeps it compliant with the
    // user-defined CORS policies.
    const acceptHeader = headers.get("accept");
    if (acceptHeader) {
      const values = acceptHeader.split(",").map((value: string) => value.trim());
      const filteredValues = values.filter((value: string) => value !== "msw/passthrough");

      if (filteredValues.length > 0) {
        headers.set("accept", filteredValues.join(", "));
      } else {
        headers.delete("accept");
      }
    }

    return fetch(requestClone, { headers });
  }

  // Bypass mocking when the client is not active.
  if (!client) {
    return passthrough();
  }

  // Bypass initial page load requests (i.e. static assets).
  // The absence of the immediate/parent client in the map of the active clients
  // means that MSW hasn't dispatched the "MOCK_ACTIVATE" event yet
  // and is not ready to handle requests.
  if (!activeClientIds.has(client.id)) {
    return passthrough();
  }

  // Notify the client that a request has been intercepted.
  const requestBuffer = await request.arrayBuffer();
  const clientMessage = await sendToClient(
    client,
    {
      type: "REQUEST",
      payload: {
        id: requestId,
        url: request.url,
        mode: request.mode,
        method: request.method,
        headers: Object.fromEntries((request.headers as any).entries()),
        cache: request.cache,
        credentials: request.credentials,
        destination: request.destination,
        integrity: request.integrity,
        redirect: request.redirect,
        referrer: request.referrer,
        referrerPolicy: request.referrerPolicy,
        body: requestBuffer,
        keepalive: request.keepalive,
      },
    },
    [requestBuffer],
  );

  switch (clientMessage.type) {
    case "MOCK_RESPONSE": {
      return respondWithMock(clientMessage.data);
    }

    case "PASSTHROUGH": {
      return passthrough();
    }
  }

  return passthrough();
}

function sendToClient(
  client: any,
  message: MessagePayload,
  transferrables: any[] = [],
): Promise<any> {
  return new Promise((resolve, reject) => {
    const channel = new MessageChannel();

    channel.port1.onmessage = (event: MessageEvent) => {
      if (event.data && event.data.error) {
        return reject(event.data.error);
      }

      resolve(event.data);
    };

    client.postMessage(message, [channel.port2, ...transferrables]);
  });
}

async function respondWithMock(response: MockResponse): Promise<Response> {
  // Setting response status code to 0 is a no-op.
  // However, when responding with a "Response.error()", the produced Response
  // instance will have status code set to 0. Since it's not possible to create
  // a Response instance with status code 0, handle that use-case separately.
  if (response.status === 0) {
    return Response.error();
  }

  const mockedResponse = new Response(response.body, response);

  Reflect.defineProperty(mockedResponse, IS_MOCKED_RESPONSE, {
    value: true,
    enumerable: true,
  });

  return mockedResponse;
}
