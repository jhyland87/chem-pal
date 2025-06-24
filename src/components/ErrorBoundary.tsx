import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { Typography } from '@mui/material';
import { ErrorOutline as ErrorIcon, Refresh as RefreshIcon } from '@mui/icons-material';
import {
  ErrorBoundaryContainer,
  ErrorBoundaryPaper,
  ErrorBoundaryIcon,
  ErrorBoundaryMessage,
  ErrorDetailsContainer,
  ErrorDetailsText,
  ErrorDetailsTextWithMargin,
  ErrorBoundaryActions,
  ErrorBoundaryButton,
  ErrorIdText,
} from './StyledComponents';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log the error to console for debugging
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    // Update state with error details
    this.setState({
      error,
      errorInfo,
    });

    // Here you could also log to an error reporting service
    // Example: logErrorToService(error, errorInfo);
  }

  handleReload = () => {
    // Reset the error boundary state
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
    
    // Reload the page as a fallback
    window.location.reload();
  };

  handleRetry = () => {
    // Just reset the error boundary state to try again
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render() {
    if (this.state.hasError) {
      return (
        <ErrorBoundaryContainer>
          <ErrorBoundaryPaper elevation={3}>
            <ErrorBoundaryIcon>
              <ErrorIcon />
            </ErrorBoundaryIcon>
            
            <Typography variant="h4" component="h1" gutterBottom>
              Oops! Something went wrong
            </Typography>
            
            <ErrorBoundaryMessage variant="body1" color="text.secondary">
              We're sorry, but something unexpected happened. Please try refreshing the page or contact support if the problem persists.
            </ErrorBoundaryMessage>

            {/* Show error details in development */}
            {import.meta.env.DEV && this.state.error && (
              <ErrorDetailsContainer variant="outlined">
                <Typography variant="subtitle2" color="error" gutterBottom>
                  Error Details (Development Only):
                </Typography>
                <ErrorDetailsText variant="body2">
                  {this.state.error.toString()}
                </ErrorDetailsText>
                {this.state.errorInfo && (
                  <ErrorDetailsTextWithMargin variant="body2">
                    {this.state.errorInfo.componentStack}
                  </ErrorDetailsTextWithMargin>
                )}
              </ErrorDetailsContainer>
            )}

            <ErrorBoundaryActions>
              <ErrorBoundaryButton
                variant="contained"
                startIcon={<RefreshIcon />}
                onClick={this.handleRetry}
              >
                Try Again
              </ErrorBoundaryButton>
              
              <ErrorBoundaryButton
                variant="outlined"
                onClick={this.handleReload}
              >
                Reload Page
              </ErrorBoundaryButton>
            </ErrorBoundaryActions>

            <ErrorIdText variant="caption" color="text.secondary">
              Error ID: {Date.now().toString(36)}
            </ErrorIdText>
          </ErrorBoundaryPaper>
        </ErrorBoundaryContainer>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary; 