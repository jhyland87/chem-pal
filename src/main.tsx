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

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./main.scss";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
