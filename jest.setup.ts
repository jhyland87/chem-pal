// Import necessary modules
import "@testing-library/jest-dom";
import util from "util";
import { IChromeStorageItems } from "./src/types";

// Extend the global type to include chrome
declare global {
  var chrome: {
    storage: {
      local: {
        set: (items: any, callback?: () => void) => void;
        get: (items: any, callback?: (items: any) => void) => void;
      }
    }
  }
}

// Assign jest-chrome to the global object
Object.assign(global, require("jest-chrome"));

// Define an interface for the Chrome storage items


// Promisify chrome.storage.local.set and chrome.storage.local.get
global.chrome.storage.local.set = util.promisify(
  global.chrome.storage.local.set
) as (items: Partial<IChromeStorageItems>) => Promise<void>;

global.chrome.storage.local.get = util.promisify(
  global.chrome.storage.local.get
) as (items: Partial<IChromeStorageItems>) => Promise<void>;