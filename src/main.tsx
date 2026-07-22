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
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.tsx';
import { i18n } from './helpers/i18n';
import './main.scss';
import { isTabView } from './utils/displayContext';
import { IS_DEV_BUILD } from './utils/isDevBuild';
import { initThemeAwareToolbarIcon } from './utils/themeIcon';

// Expose chemistry helpers on window.chempal for manual console testing. Dynamically imported and
// gated by IS_DEV_BUILD so it (and its dependencies) are tree-shaken out of production builds.
if (IS_DEV_BUILD) {
  void (async () => {
    const { exposeDebugApi } = await import('./utils/debugConsole');
    exposeDebugApi();
  })();
}

(async () => {
  document.title = i18n('app_title');

  // Match the toolbar icon to the browser's light/dark scheme (no-ops off-extension).
  initThemeAwareToolbarIcon();

  // Tag the document so CSS can drop the popup's fixed dimensions and fill the
  // window when the extension is opened in a full browser tab. Done pre-render
  // to avoid a resize flash.
  if (isTabView()) {
    document.body.classList.add('view-tab');
  }

  createRoot(document.getElementById('root')!, {
    onUncaughtError: (error, errorInfo) => {
      console.error('Uncaught error:', error, errorInfo);
    },
    onCaughtError: (error, errorInfo) => {
      console.error('Caught error:', error, errorInfo);
    },
  }).render(
    <StrictMode>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </StrictMode>,
  );
})();
