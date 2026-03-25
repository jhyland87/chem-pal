# Mock Response Files for E2E & Unit Testing

This directory contains captured HTTP response files used to mock API calls during testing. Each file represents a single request/response pair, stored in the same format used by the MSW handlers in `src/__mocks__/handlers.ts`.

## Directory Structure

```
responses/
  {hostname}/
    {hash}.json       # One file per unique request
```

Example:
```
responses/
  www.carolina.com/
    6dbb7f0d043263baaef679c1131beea2.json
    447a2d9209528b280f55b823c1f7d4e8.json
  www.laboratoriumdiscounter.nl/
    f1429208d19fd13306eb98ff88d4e390.json
```

## File Format

Each JSON file contains two fields:

```json
{
  "contentType": "application/json",
  "content": "JTdCJTIycmVzdWx0cyUyMiUzQS4uLiU3RA=="
}
```

- **`contentType`** — The MIME type of the original response (e.g. `application/json`, `text/html;charset=UTF-8`)
- **`content`** — The response body, serialized as `btoa(encodeURIComponent(body))`

This is the same format used by `getCachableResponse()` in `src/helpers/request.ts` and consumed by the MSW handlers in `src/__mocks__/handlers.ts`.

## How the Hash Works

The filename hash is an MD5 of: `method + pathname + search + body`

For example, a GET request to `https://www.carolina.com/browse/product-search-results?tab=p&format=json&q=acid` produces:
```
md5("GET" + "/browse/product-search-results" + "?tab=p&format=json&q=acid" + "")
```

This is computed by `getRequestHash()` in `src/helpers/request.ts` (browser) and `e2e/helpers/requestHash.ts` (Node.js).

## Generating Mock Response Files

### Step 1: Build in Aggregate Mode

```bash
pnpm build:aggregate
```

This builds the extension with the `__RESPONSE_AGGREGATE__` flag enabled, which hooks into `fetchDecorator` to capture every HTTP request/response pair in memory.

### Step 2: Load and Use the Extension

1. Open `chrome://extensions` in Chrome
2. Enable "Developer mode"
3. Click "Load unpacked" and select the `build/` directory
4. Open the extension popup and run a search (e.g. "acid")
5. Wait for results to finish loading

### Step 3: Download Captured Responses

Open Chrome DevTools (right-click the extension popup → "Inspect") and use the console API:

```js
// See what was captured
window.__responseAggregate.list()

// Check count
window.__responseAggregate.count

// Download as zip
window.__responseAggregate.download()

// Clear captured data and start fresh
window.__responseAggregate.clear()
```

The zip file will be downloaded with the directory structure ready to extract.

### Step 4: Extract to This Directory

```bash
# Extract the downloaded zip into this directory
unzip ~/Downloads/response-aggregate-*.zip -d tests/mock-requests/responses/
```

### Step 5: Use in Tests

**Unit tests (MSW):** The files are automatically loaded by the MSW handlers in `src/__mocks__/handlers.ts` — just place them in `src/__mocks__/responses/` with the same structure.

**E2E tests (Playwright):** Use the `setupMockRoutes()` helper:

```ts
import { setupMockRoutes } from "../helpers/mockRoutes";

test("search for acid returns mocked results", async ({ page }) => {
  await setupMockRoutes(page, {
    responsesDir: "tests/mock-requests/responses",
    fallback: "abort", // fail if no mock found (default)
  });

  // ... interact with extension, all HTTPS requests will be mocked
});
```

## Tips

- **Multiple queries:** Run multiple searches in aggregate mode before downloading — all responses accumulate in a single session.
- **Updating mocks:** Re-run the aggregate flow to capture fresh responses. The hash-based naming means unchanged requests produce the same filenames.
- **Debugging:** If a test fails with a missing mock, check the test output for the expected hash and verify the file exists in the correct hostname directory.
- **Copying to MSW:** To use captured responses with unit tests, copy them from `tests/mock-requests/responses/` to `src/__mocks__/responses/`:
  ```bash
  cp -r tests/mock-requests/responses/* src/__mocks__/responses/
  ```
