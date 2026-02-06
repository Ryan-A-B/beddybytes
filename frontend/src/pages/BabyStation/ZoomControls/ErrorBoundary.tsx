/**
 * ErrorBoundary for ZoomControls component
 * Catches and handles errors in zoom functionality gracefully
 */

import React from "react";

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ZoomControlsErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error("[ZoomControls] Error caught by boundary:", error, errorInfo);
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <div className="alert alert-warning" role="alert">
          <p>Camera zoom controls encountered an error.</p>
          <p className="mb-0">
            <small>The camera feed will continue without zoom functionality.</small>
          </p>
        </div>
      );
    }

    return this.props.children;
  }
}
