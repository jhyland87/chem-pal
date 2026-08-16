import { captureOwnerStack, Component, ReactNode } from 'react';
import { trackRenderError } from '@/helpers/analytics';
import { i18n } from '@/helpers/i18n';
import { showReportDialog } from './ReportDialog';

/** Internal state: whether a descendant threw, and the captured error details. */
interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  componentStack?: string;
}

/**
 * ErrorBoundary component that catches JavaScript errors anywhere in their child component tree,
 * logs those errors, and displays a fallback UI instead of the component tree that crashed.
 * The fallback includes a "Report Error" button that opens the bug-report dialog prefilled with
 * the caught error and its component stack.
 *
 * @component
 *
 * @param props - Component props
 *
 * @example
 * ```tsx
 * <ErrorBoundary fallback={<p>Something went wrong</p>}>
 *   <MyComponent />
 * </ErrorBoundary>
 * ```
 * @source
 */
class ErrorBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  ErrorBoundaryState
> {
  /**
   * Creates an instance of ErrorBoundary.
   * @param props - Component props
   * @source
   */
  constructor(props: { children: ReactNode; fallback: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  /**
   * Static lifecycle method that is called when a descendant component throws an error.
   * Updates the state to show the fallback UI and retain the error on the next render.
   * @param error - The error that was thrown
   * @returns New state object with hasError set to true and the error captured
   * @source
   */
  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error };
  }

  /**
   * Lifecycle method that is called after an error has been thrown in a descendant component.
   * Logs the error and component stack trace, and retains the component stack for reporting.
   * @param error - The error that was thrown
   * @param info - React-supplied error info, including the component stack
   * @source
   */
  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error(
      error,
      // Example "componentStack":
      //   in ComponentThatThrows (created by App)
      //   in ErrorBoundary (created by App)
      //   in div (created by App)
      //   in App
      info.componentStack,
      // Warning: `captureOwnerStack` is not available in production.
      captureOwnerStack(),
    );
    this.setState({ componentStack: info.componentStack });
    // Report the crash to PostHog (non-PII, best-effort).
    void trackRenderError(error);
  }

  /**
   * Opens the bug-report dialog prefilled with the caught error and component stack.
   * @source
   */
  handleReport = () => {
    void showReportDialog(this.state.error, {
      action: 'render-crash',
      extra: this.state.componentStack ? { componentStack: this.state.componentStack } : undefined,
    });
  };

  /**
   * Renders either the children or the fallback UI (plus a report button) based on
   * whether an error has occurred.
   * @returns The rendered component
   * @source
   */
  render() {
    if (this.state.hasError) {
      // Rendered above the app's ThemeProvider, so use a plain, self-contained
      // button rather than a MUI component that would lack a theme here.
      return (
        <>
          {this.props.fallback}
          <button
            type="button"
            data-testid="error-boundary-report"
            onClick={this.handleReport}
            style={{
              display: 'block',
              margin: '8px auto',
              padding: '6px 14px',
              font: 'inherit',
              cursor: 'pointer',
              borderRadius: 6,
              border: '1px solid currentColor',
              background: 'transparent',
              color: 'inherit',
            }}
          >
            {i18n('error_boundary_report')}
          </button>
        </>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
