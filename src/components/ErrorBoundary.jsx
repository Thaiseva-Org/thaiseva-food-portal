import React from "react";

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // You can also log the error to an error reporting service like Sentry
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      // You can render any custom fallback UI
      return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-neutral-50 px-4 text-center">
          <div className="mb-6 inline-flex h-16 w-16 items-center justify-center rounded-full bg-danger-100 text-danger-600">
            <i className="bi bi-exclamation-triangle text-3xl" aria-hidden="true" />
          </div>
          <h1 className="text-2xl font-bold text-ink">Something went wrong</h1>
          <p className="mt-2 max-w-md text-sm text-ink-muted">
            An unexpected error occurred in the application. We&apos;ve logged this issue. 
            You can try refreshing the page or going back home.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <button
              onClick={() => window.location.reload()}
              className="btn-primary"
            >
              Refresh page
            </button>
            <button
              onClick={() => {
                this.setState({ hasError: false });
                window.location.href = "/";
              }}
              className="btn-outline"
            >
              Go to Homepage
            </button>
          </div>
          {import.meta.env.DEV && (
            <div className="mt-8 w-full max-w-2xl overflow-auto rounded-xl bg-neutral-900 p-4 text-left text-xs text-neutral-300 shadow-inner">
              <p className="font-semibold text-danger-400">{this.state.error?.toString()}</p>
              <pre className="mt-2 whitespace-pre-wrap">{this.state.error?.stack}</pre>
            </div>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
