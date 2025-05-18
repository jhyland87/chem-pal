// Import necessary modules
import "@testing-library/jest-dom";
import jestChrome from "jest-chrome";

// Assign jest-chrome to the global object
Object.assign(global, jestChrome);
/*
// Type assertion for the global chrome object
const globalChrome = global as unknown as { chrome: Chrome };


// Promisify chrome.storage.session.set and chrome.storage.session.get
globalChrome.chrome.storage.session.set = util.promisify(
  globalChrome.chrome.storage.session.set,
) as (items: ChromeStorageItems) => Promise<void>;

globalChrome.chrome.storage.session.get = util.promisify(
  globalChrome.chrome.storage.session.get,
) as (items: string | string[] | ChromeStorageItems) => Promise<ChromeStorageItems>;

// Promisify chrome.storage.local.set and chrome.storage.local.get
globalChrome.chrome.storage.local.set = util.promisify(globalChrome.chrome.storage.local.set) as (
  items: ChromeStorageItems,
) => Promise<void>;

globalChrome.chrome.storage.local.get = util.promisify(globalChrome.chrome.storage.local.get) as (
  items: string | string[] | ChromeStorageItems,
) => Promise<ChromeStorageItems>;

*/
