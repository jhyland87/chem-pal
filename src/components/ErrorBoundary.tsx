import { captureOwnerStack, Component, ReactNode } from "react";

/**
 * ErrorBoundary component that catches JavaScript errors anywhere in their child component tree,
 * logs those errors, and displays a fallback UI instead of the component tree that crashed.
 *
 * @component
 *
 * @param {Object} props - Component props
 * @param {ReactNode} props.children - Child components to render
 * @param {ReactNode} props.fallback - UI to render when an error occurs
 *
 * @example
 * ```tsx
 * <ErrorBoundary fallback={<p>Something went wrong</p>}>
 *   <MyComponent />
 * </ErrorBoundary>
 * ```
 */
class ErrorBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { hasError: boolean }
> {
  /**
   * Creates an instance of ErrorBoundary.
   * @param {Object} props - Component props
   * @param {ReactNode} props.children - Child components to render
   * @param {ReactNode} props.fallback - UI to render when an error occurs
   */
  constructor(props: { children: ReactNode; fallback: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  /**
   * Static lifecycle method that is called when a descendant component throws an error.
   * Updates the state to show the fallback UI on the next render.
   * @returns {Object} New state object with hasError set to true
   */
  static getDerivedStateFromError() {
    // Update state so the next render will show the fallback UI.
    return { hasError: true };
  }

  /**
   * Lifecycle method that is called after an error has been thrown in a descendant component.
   * Logs the error and component stack trace.
   * @param {Error} error - The error that was thrown
   * @param {Object} info - Additional information about the error
   * @param {string} info.componentStack - The component stack trace
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
  }

  /**
   * Renders either the children or the fallback UI based on whether an error has occurred.
   * @returns {ReactNode} The rendered component
   */
  render() {
    if (this.state.hasError) {
      // You can render any custom fallback UI
      return this.props.fallback;
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
