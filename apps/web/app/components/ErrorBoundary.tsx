"use client";

import { Component, ReactNode } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

/**
 * Error Boundary Component
 * Catches JavaScript errors in child components and displays fallback UI
 * Used to wrap lazy-loaded components for graceful degradation
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("ErrorBoundary caught error:", error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div
          style={{
            padding: "2rem",
            textAlign: "center",
            background: "var(--panel)",
            border: "1px solid var(--line-soft)",
            borderRadius: "8px",
          }}
        >
          <h3 style={{ color: "var(--cream)", marginBottom: "0.5rem" }}>
            Something went wrong
          </h3>
          <p style={{ color: "var(--warm-gray)", fontSize: "0.9rem" }}>
            We're having trouble loading this component. Please try refreshing the page.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="btn btn-secondary"
            style={{ marginTop: "1rem" }}
          >
            Refresh Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
