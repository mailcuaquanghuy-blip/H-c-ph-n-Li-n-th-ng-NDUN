import React, { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
    this.setState({
      error,
      errorInfo
    });
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="p-4 m-4 bg-red-100 border border-red-400 text-red-700 rounded overflow-auto">
          <h1 className="text-xl font-bold mb-2">Something went wrong.</h1>
          <p className="font-mono text-sm whitespace-pre-wrap">{this.state.error?.toString()}</p>
          <p className="font-mono text-xs whitespace-pre-wrap mt-4">{this.state.errorInfo?.componentStack}</p>
        </div>
      );
    }

    return this.props.children;
  }
}
