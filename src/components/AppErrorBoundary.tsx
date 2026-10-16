import { Component, type ErrorInfo, type ReactNode } from 'react';

declare global {
  interface Window {
    isDeploymentLoadError?: (error: unknown) => boolean;
    recoverFromDeploymentError?: (error: unknown) => boolean;
  }
}

interface AppErrorBoundaryProps {
  children?: ReactNode;
}

interface AppErrorBoundaryState {
  error: Error | null;
  recovering: boolean;
}

export default class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = { error: null, recovering: false };

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return { error, recovering: false };
  }

  componentDidCatch(error: Error, _errorInfo: ErrorInfo): void {
    const isDeploymentError = window.isDeploymentLoadError?.(error) ?? false;
    const recovering = isDeploymentError && (window.recoverFromDeploymentError?.(error) ?? false);
    this.setState({ recovering });
  }

  render(): ReactNode {
    if (this.state.recovering) return null;
    if (this.state.error) {
      return (
        <main className="flex min-h-[100dvh] items-center justify-center bg-slate-50 p-6 text-center">
          <div>
            <h1 className="text-lg font-semibold text-slate-900">This page could not be loaded.</h1>
            <p className="mt-2 text-sm text-slate-600">Please refresh the page and try again.</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
            >
              Refresh page
            </button>
          </div>
        </main>
      );
    }
    return this.props.children;
  }
}
