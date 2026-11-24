/**
 * Stand-in for `jszip` in the service-worker build. Only the aggregate-mode response
 * downloader uses jszip, and that needs a page, so shipping ~100 KB of it in the worker
 * would be dead weight.
 */
export default class JSZipStub {
  constructor() {
    throw new Error("jszip is not available in the service worker");
  }
}
