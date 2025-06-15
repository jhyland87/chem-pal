/**
 * Main entry point for the ChemPare application.
 * This file initializes the React application and renders the root component.
 *
 * The application is wrapped in React's StrictMode for additional development checks
 * and rendered into the DOM element with id "root".
 *
 * @module Main
 *
 * @example
 * ```tsx
 * // The entry point renders the App component wrapped in StrictMode
 * createRoot(document.getElementById("root")!).render(
 *   <StrictMode>
 *     <App />
 *   </StrictMode>
 * );
 * ```
 */
//import 'react-material-symbols/rounded';
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./main.scss";

/**
 * Enable mocking if there is no chrome.extension object (ie: were running outsie of the
 * extension) and were in development mode
 *
 */
async function enableMocking() {
  return;
  if (typeof chrome.extension === "undefined") {
    return;
  }

  const { worker } = await import("./__mocks__/browser.ts");

  // `worker.start()` returns a Promise that resolves
  // once the Service Worker is up and ready to intercept requests.
  return worker.start();
}

enableMocking().then(() => {
  return createRoot(document.getElementById("root")!, {
    onUncaughtError: (error, errorInfo) => {
      console.error("Uncaught error:", error, errorInfo);
    },
    onCaughtError: (error, errorInfo) => {
      console.error("Caught error:", error, errorInfo);
    },
  }).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
});
