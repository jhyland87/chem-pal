/**
 * Entry point for the extension's options page (`options.html`). Mirrors
 * `main.tsx`: sets the document title, matches the toolbar icon to the browser
 * color scheme, and mounts {@link OptionsApp} into `#root`.
 *
 * @module Options
 *
 * @example
 * ```tsx
 * createRoot(rootEl).render(
 *   <StrictMode>
 *     <OptionsApp />
 *   </StrictMode>
 * );
 * ```
 * @source
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { OptionsApp } from './OptionsApp';
import { i18n } from './helpers/i18n';
import './main.scss';
import { initThemeAwareToolbarIcon } from './utils/themeIcon';

document.title = i18n('app_title');

// Match the toolbar icon to the browser's light/dark scheme (no-ops off-extension).
initThemeAwareToolbarIcon();

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('Options page root element (#root) not found');

createRoot(rootEl, {
  onUncaughtError: (error, errorInfo) => {
    console.error('Uncaught error:', error, errorInfo);
  },
  onCaughtError: (error, errorInfo) => {
    console.error('Caught error:', error, errorInfo);
  },
}).render(
  <StrictMode>
    <OptionsApp />
  </StrictMode>,
);
