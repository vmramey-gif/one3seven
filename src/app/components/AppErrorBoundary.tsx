import { Component, type ErrorInfo, type ReactNode } from 'react';
import { WordMark } from './WordMark';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  errorMessage: string;
}

/**
 * Top-level error boundary.
 * Catches any unhandled render error and shows a recovery screen
 * instead of a blank white screen — critical for mobile where DevTools
 * aren't available to diagnose silent crashes.
 */
export class AppErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      errorMessage: error?.message ?? 'An unexpected error occurred.',
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Keep this log for debugging — safe to leave in production
    console.error('[o3s-error-boundary] caught render error', {
      message: error?.message,
      stack: error?.stack,
      componentStack: info?.componentStack,
    });
  }

  handleReload = () => {
    // Clear state and attempt recovery by reloading
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#f2f4ec] flex flex-col items-center justify-center px-6 text-center">
          <div className="max-w-sm w-full">
            <p className="text-xl font-bold text-[#1B2623] mb-2"><WordMark /></p>
            <p className="text-sm text-[#1B2623]/60 mb-4">
              Something went wrong loading the app.
            </p>
            {this.state.errorMessage && (
              <p className="mb-8 break-words rounded-lg bg-white/70 px-3 py-2 text-left font-mono text-[11px] leading-relaxed text-[#1B2623]/55">
                {this.state.errorMessage}
              </p>
            )}
            <button
              onClick={this.handleReload}
              className="w-full rounded-full bg-[#42574e] py-4 text-sm font-semibold text-white shadow-lg"
            >
              Reload App
            </button>
            <p className="mt-6 text-xs text-[#1B2623]/40">
              If this keeps happening, try signing out and back in.
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
