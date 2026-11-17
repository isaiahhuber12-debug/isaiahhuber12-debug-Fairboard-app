import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, message: error.message || 'An unexpected error occurred.' };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('ErrorBoundary caught error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-[var(--rally-bg)] text-[var(--rally-on-surface)]">
          <div className="max-w-md w-full rounded-2xl border border-[var(--rally-outline)] bg-[var(--rally-surface)] p-6 space-y-4">
            <h2 className="text-xl font-bold font-display">Something went wrong</h2>
            <p className="text-sm text-[var(--rally-on-surface-variant)] break-words">
              {this.state.message}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="w-full py-2.5 px-4 rounded-xl font-semibold text-white bg-[#1B4DFF] hover:bg-[#1034B8] transition-colors cursor-pointer"
            >
              Reload RallyHub
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
