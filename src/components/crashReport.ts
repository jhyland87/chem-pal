import {
  buildGithubUrl,
  buildGoogleFormUrl,
  collectDiagnostics,
  formatDiagnostics,
  openTab,
  type ReportContext,
} from '@/helpers/bugReport';
import { i18n } from '@/helpers/i18n';

/**
 * Last-resort, **non-React** crash reporter for errors that escape every React
 * error boundary (the app tree is gone, so {@link showReportDialog}'s React root
 * can't be relied on). Builds a plain-DOM overlay with the two report paths.
 * Used only from the root `onUncaughtError` hook; in-subtree render errors are
 * still handled by the React `ErrorBoundary` fallback.
 *
 * @module crashReport
 * @category Components
 * @source
 */

/** Only one crash overlay at a time. */
let overlayVisible = false;

const STYLES = `
  .chempal-crash-backdrop {
    position: fixed; inset: 0; z-index: 2147483647;
    display: grid; place-items: center;
    background: rgb(0 0 0 / 0.5);
    font: 14px/1.5 system-ui, -apple-system, sans-serif;
  }
  .chempal-crash-card {
    width: min(440px, calc(100vw - 32px));
    background: #fff; color: #1a1a1a;
    border-radius: 10px; padding: 20px;
    box-shadow: 0 12px 32px rgb(0 0 0 / 0.3);
  }
  .chempal-crash-card h2 { margin: 0 0 6px; font-size: 16px; font-weight: 600; }
  .chempal-crash-card p { margin: 0 0 14px; color: #555; }
  .chempal-crash-card pre {
    max-height: 160px; overflow: auto; margin: 0 0 16px;
    padding: 10px; border-radius: 6px;
    background: #f4f4f5; font: 12px/1.45 ui-monospace, monospace;
    white-space: pre-wrap; word-break: break-word;
  }
  .chempal-crash-actions { display: flex; flex-wrap: wrap; gap: 8px; }
  .chempal-crash-actions button {
    font: inherit; padding: 8px 14px; border-radius: 6px;
    border: 1px solid #d4d4d8; background: #fff; color: #1a1a1a; cursor: pointer;
  }
  .chempal-crash-actions button:hover { background: #fafafa; }
  .chempal-crash-actions .chempal-crash-primary { background: #1a1a1a; border-color: #1a1a1a; color: #fff; }
  .chempal-crash-actions .chempal-crash-spacer { flex: 1; }
  @media (prefers-color-scheme: dark) {
    .chempal-crash-card { background: #1c1c1f; color: #f4f4f5; }
    .chempal-crash-card p { color: #a1a1aa; }
    .chempal-crash-card pre { background: #27272a; }
    .chempal-crash-actions button { background: #27272a; border-color: #3f3f46; color: #f4f4f5; }
    .chempal-crash-actions button:hover { background: #333338; }
    .chempal-crash-actions .chempal-crash-primary { background: #f4f4f5; border-color: #f4f4f5; color: #18181b; }
  }
`;

/**
 * Creates a styled action button for the crash overlay.
 * @param label - The button text.
 * @param primary - Whether to render it as the emphasized action.
 * @param onClick - Click handler.
 * @returns The button element.
 * @source
 */
function makeButton(label: string, primary: boolean, onClick: () => void): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = label;
  if (primary) button.className = 'chempal-crash-primary';
  button.addEventListener('click', onClick);
  return button;
}

/**
 * Shows the non-React crash overlay, prefilled with diagnostics, offering the
 * GitHub and Google report paths plus copy-to-clipboard. Idempotent while an
 * overlay is already open, and a no-op without a DOM. Text is set via
 * `textContent`, so untrusted diagnostics can't inject markup.
 * @param error - The error that escaped all boundaries.
 * @param context - Optional page URL, action label, and extra payload.
 * @returns A promise that resolves once the overlay is mounted.
 * @example
 * ```ts
 * void showCrashReport(error, { action: "uncaught render" });
 * ```
 * @source
 */
export async function showCrashReport(error?: unknown, context?: ReportContext): Promise<void> {
  if (overlayVisible || typeof document === 'undefined') return;
  overlayVisible = true;

  const diagnostics = await collectDiagnostics(error, { action: 'uncaught error', ...context });
  const fullText = formatDiagnostics(diagnostics);
  const githubUrl = buildGithubUrl(diagnostics);
  const googleUrl = buildGoogleFormUrl(diagnostics);

  const style = document.createElement('style');
  style.textContent = STYLES;

  const backdrop = document.createElement('div');
  backdrop.className = 'chempal-crash-backdrop';
  backdrop.setAttribute('role', 'dialog');
  backdrop.setAttribute('aria-modal', 'true');

  const card = document.createElement('div');
  card.className = 'chempal-crash-card';

  const title = document.createElement('h2');
  title.textContent = i18n('report_dialog_title');

  const desc = document.createElement('p');
  desc.textContent = i18n('report_dialog_desc');

  const pre = document.createElement('pre');
  pre.textContent = fullText;

  const actions = document.createElement('div');
  actions.className = 'chempal-crash-actions';

  const dismiss = (): void => {
    backdrop.remove();
    style.remove();
    overlayVisible = false;
  };

  actions.append(
    makeButton(i18n('report_via_github'), true, () => {
      openTab(githubUrl);
      dismiss();
    }),
  );
  if (googleUrl) {
    actions.append(
      makeButton(i18n('report_via_google'), false, () => {
        // Long stacks are truncated in the URL, so also hand over the full text.
        void navigator.clipboard?.writeText(fullText);
        openTab(googleUrl);
        dismiss();
      }),
    );
  }

  const spacer = document.createElement('span');
  spacer.className = 'chempal-crash-spacer';
  actions.append(spacer);

  const copyButton = makeButton(i18n('report_copy'), false, () => {
    void navigator.clipboard?.writeText(fullText);
    copyButton.textContent = i18n('report_copied');
  });
  actions.append(copyButton);
  actions.append(makeButton(i18n('report_close'), false, dismiss));

  card.append(title, desc, pre, actions);
  backdrop.append(card);
  document.documentElement.append(style, backdrop);
}
