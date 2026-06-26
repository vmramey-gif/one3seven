import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  onBackToDashboard: () => void;
}

interface State {
  hasError: boolean;
  errorMessage: string;
}

/**
 * Screen-level error boundary for IntakeReviewScreen.
 * Catches render errors in the intake review flow and shows a safe recovery UI
 * with a "Back to Dashboard" button — better UX than crashing the whole app.
 * The top-level AppErrorBoundary is still the last resort backstop.
 */
export class IntakeReviewErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      errorMessage: error?.message ?? 'Unexpected error loading this intake.',
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[o3s-intake-review-boundary] render error', {
      message: error?.message,
      stack: error?.stack,
      componentStack: info?.componentStack,
    });
  }

  handleBack = () => {
    // Reset boundary state before navigating back
    this.setState({ hasError: false, errorMessage: '' });
    this.props.onBackToDashboard();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#F6F2FF] flex flex-col items-center justify-center px-6 text-center">
          <div className="max-w-sm w-full">
            <p className="text-lg font-semibold text-[#1E1B4B] mb-1">one3seven</p>
            <p className="text-sm text-[#1E1B4B]/60 mb-8">
              This intake couldn't be loaded. Your dashboard is unaffected.
            </p>
            <button
              onClick={this.handleBack}
              className="w-full rounded-full bg-[#6D4AFF] py-4 text-sm font-semibold text-white shadow-lg"
            >
              Back to Dashboard
            </button>
            <p className="mt-5 text-xs text-[#1E1B4B]/40">
              If this keeps happening on the same intake, contact{' '}
              <a href="mailto:info@one3seven.com?subject=Intake%20review%20issue" className="font-semibold text-[#6D4AFF] hover:underline">info@one3seven.com</a>.
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
