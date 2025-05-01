// Import necessary modules
import "@testing-library/jest-dom";
//import util from "util";

// Extend the global type to include chrome
declare global {
  var chrome: typeof import("jest-chrome");
}

// Assign jest-chrome to the global object
Object.assign(global, require("jest-chrome"));

// Define an interface for the Chrome storage items
// interface ChromeStorageItems {
//   [key: string]: any;
// }

// // Promisify chrome.storage.local.set and chrome.storage.local.get
// global.chrome.storage.local.set = util.promisify(
//   global.chrome.storage.local.set
// ) as (items: Partial<ChromeStorageItems>) => Promise<void>;

// global.chrome.storage.local.get = util.promisify(
//   global.chrome.storage.local.get
// ) as (items: Partial<ChromeStorageItems>) => Promise<void>;