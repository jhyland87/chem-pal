/**
 * Main entry point for the ChemPal application.
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
 * @source
 */
//import 'react-material-symbols/rounded';
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.tsx";
import "./main.scss";
import { isTabView } from "./utils/displayContext";

(async () => {
  // Tag the document so CSS can drop the popup's fixed dimensions and fill the
  // window when the extension is opened in a full browser tab. Done pre-render
  // to avoid a resize flash.
  if (isTabView()) {
    document.body.classList.add("view-tab");
  }

  createRoot(document.getElementById("root")!, {
    onUncaughtError: (error, errorInfo) => {
      console.error("Uncaught error:", error, errorInfo);
    },
    onCaughtError: (error, errorInfo) => {
      console.error("Caught error:", error, errorInfo);
    },
  }).render(
    <StrictMode>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </StrictMode>,
  );
})();
