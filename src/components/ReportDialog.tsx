import {
  buildGithubUrl,
  buildGoogleFormUrl,
  collectDiagnostics,
  formatDiagnostics,
  openTab,
  type Diagnostics,
  type ReportContext,
} from '@/helpers/bugReport';
import { i18n } from '@/helpers/i18n';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import { createTheme, styled, ThemeProvider } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';

/** Which report path the user chose, or that they dismissed the dialog. */
export type ReportChoice = 'github' | 'google' | 'dismissed';

/**
 * Scrollable, monospaced block that shows the prefilled diagnostics text.
 * @category Components
 * @group Bug reporting
 */
const DiagnosticsBlock = styled('pre')(({ theme }) => ({
  maxHeight: 200,
  overflow: 'auto',
  margin: 0,
  padding: theme.spacing(1.25),
  borderRadius: theme.shape.borderRadius,
  backgroundColor: theme.palette.action.hover,
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  fontSize: 12,
  lineHeight: 1.45,
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
}));

/** Props for {@link ReportDialog}. */
interface ReportDialogProps {
  /** Whether the dialog is open. */
  open: boolean;
  /** The full, formatted diagnostics text shown and copied. */
  fullText: string;
  /** Prefilled GitHub issue URL. */
  githubUrl: string;
  /** Prefilled Google Form URL, when a form is configured. */
  googleUrl?: string;
  /** Called with the user's choice when the dialog closes. */
  onClose: (choice: ReportChoice) => void;
}

/**
 * The bug-report review dialog. Shows the prefilled diagnostics and offers the
 * two credential-free submission paths (GitHub and Google) plus copy-to-clipboard.
 * Presentational only — URL building and diagnostics collection happen upstream.
 * @component
 * @category Components
 * @param props - See {@link ReportDialogProps}.
 * @example
 * ```tsx
 * <ReportDialog open fullText={text} githubUrl={gh} onClose={handleClose} />
 * ```
 * @source
 */
export function ReportDialog({ open, fullText, githubUrl, googleUrl, onClose }: ReportDialogProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    void navigator.clipboard?.writeText(fullText);
    setCopied(true);
  };

  const handleGithub = () => {
    openTab(githubUrl);
    onClose('github');
  };

  const handleGoogle = () => {
    if (!googleUrl) return;
    // Long stacks are truncated in the URL, so also hand over the full text.
    void navigator.clipboard?.writeText(fullText);
    openTab(googleUrl);
    onClose('google');
  };

  return (
    <Dialog
      open={open}
      onClose={() => onClose('dismissed')}
      aria-labelledby="report-dialog-title"
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle id="report-dialog-title">{i18n('report_dialog_title')}</DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ mb: 1.5 }}>{i18n('report_dialog_desc')}</DialogContentText>
        <DiagnosticsBlock>{fullText}</DiagnosticsBlock>
      </DialogContent>
      <DialogActions>
        <Button variant="contained" onClick={handleGithub}>
          {i18n('report_via_github')}
        </Button>
        {googleUrl ? <Button onClick={handleGoogle}>{i18n('report_via_google')}</Button> : null}
        <Button onClick={handleCopy}>{copied ? i18n('report_copied') : i18n('report_copy')}</Button>
        <Button onClick={() => onClose('dismissed')}>{i18n('report_close')}</Button>
      </DialogActions>
    </Dialog>
  );
}

/** Props for {@link ReportDialogHost}. */
interface ReportDialogHostProps {
  /** The assembled diagnostics snapshot to report. */
  diagnostics: Diagnostics;
  /** Called once the user resolves the dialog. */
  onDone: (choice: ReportChoice) => void;
}

/**
 * Stateful wrapper that owns the dialog's open state and a self-contained theme,
 * so {@link showReportDialog} can mount it into its own React root — independent
 * of the app tree, and therefore still functional when that tree has crashed.
 * @param props - See {@link ReportDialogHostProps}.
 * @returns The themed dialog.
 * @source
 */
function ReportDialogHost({ diagnostics, onDone }: ReportDialogHostProps) {
  const [open, setOpen] = useState(true);
  const prefersDark = useMediaQuery('(prefers-color-scheme: dark)');
  const theme = useMemo(
    () => createTheme({ palette: { mode: prefersDark ? 'dark' : 'light' } }),
    [prefersDark],
  );

  const githubUrl = useMemo(() => buildGithubUrl(diagnostics), [diagnostics]);
  const googleUrl = useMemo(() => buildGoogleFormUrl(diagnostics), [diagnostics]);
  const fullText = useMemo(() => formatDiagnostics(diagnostics), [diagnostics]);

  const handleClose = (choice: ReportChoice) => {
    setOpen(false);
    onDone(choice);
  };

  return (
    <ThemeProvider theme={theme}>
      <ReportDialog
        open={open}
        fullText={fullText}
        githubUrl={githubUrl}
        googleUrl={googleUrl}
        onClose={handleClose}
      />
    </ThemeProvider>
  );
}

/**
 * Collects diagnostics and shows the review dialog, resolving once the user
 * picks a report path or dismisses. Mounts the dialog into a throwaway React
 * root appended to `document.body`, so it works from any context — including the
 * class-based `ErrorBoundary` after a render crash. When no DOM is available it
 * opens the GitHub path directly.
 * @param error - The error that triggered the report, if any.
 * @param context - Optional page URL, action label, and extra payload.
 * @returns The user's choice.
 * @example
 * ```ts
 * await showReportDialog(err, { action: "render-crash" });
 * ```
 * @source
 */
export async function showReportDialog(
  error?: unknown,
  context?: ReportContext,
): Promise<ReportChoice> {
  const diagnostics = await collectDiagnostics(error, context);

  if (typeof document === 'undefined') {
    openTab(buildGithubUrl(diagnostics));
    return 'github';
  }

  return new Promise<ReportChoice>((resolve) => {
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    let settled = false;

    const finish = (choice: ReportChoice) => {
      if (settled) return;
      settled = true;
      resolve(choice);
      // Defer teardown so the dialog's close transition can finish.
      globalThis.setTimeout(() => {
        root.unmount();
        container.remove();
      }, 300);
    };

    root.render(<ReportDialogHost diagnostics={diagnostics} onDone={finish} />);
  });
}
