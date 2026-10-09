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
import { initRemoteLogs } from './helpers/remoteLogs';
import './main.scss';
import { initThemeAwareToolbarIcon } from './utils/themeIcon';
import { Logger } from '@/utils/Logger';
import { getErrorMessage } from '@/helpers/exceptions';

const logger = new Logger('options');

document.title = i18n('app_title');

// Match the toolbar icon to the browser's light/dark scheme (no-ops off-extension).
initThemeAwareToolbarIcon();

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('Options page root element (#root) not found');

createRoot(rootEl, {
  onUncaughtError: (error, errorInfo) => {
    logger.fatal(`Uncaught error: ${getErrorMessage(error)}`, { error, errorInfo });
  },
  onCaughtError: (error, errorInfo) => {
    logger.error(`Caught error: ${getErrorMessage(error)}`, { error, errorInfo });
  },
}).render(
  <StrictMode>
    <OptionsApp />
  </StrictMode>,
);

// After first render: forward Logger output to PostHog Logs (respects the usage-sharing opt-out).
void initRemoteLogs();
