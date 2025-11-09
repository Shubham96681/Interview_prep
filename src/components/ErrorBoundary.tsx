import React, { Component, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({
      error,
      errorInfo,
    });
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
            <div className="text-red-500 text-6xl mb-4">⚠️</div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Something went wrong</h2>
            <p className="text-gray-600 mb-4">
              There was an error loading the meeting. This is usually a temporary issue.
            </p>
            {this.state.error?.message && (
              <p className="text-sm text-red-600 mb-4 bg-red-50 p-2 rounded">
                {this.state.error.message}
              </p>
            )}
            <div className="space-y-3">
              <button 
                onClick={() => this.setState({ hasError: false, error: null })}
                className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-semibold hover:bg-blue-700 transition"
              >
                Try Again
              </button>
              <button 
                onClick={() => window.location.href = '/'}
                className="w-full bg-gray-200 text-gray-800 py-3 px-4 rounded-lg font-semibold hover:bg-gray-300 transition"
              >
                Go Home
              </button>
              <button 
                onClick={() => window.location.reload()}
                className="w-full bg-green-600 text-white py-3 px-4 rounded-lg font-semibold hover:bg-green-700 transition"
              >
                Reload Page
              </button>
            </div>
            {process.env.NODE_ENV === 'development' && this.state.errorInfo && (
              <details className="mt-4 text-left">
                <summary className="cursor-pointer text-sm text-gray-600 mb-2">
                  Error Details (Development Only)
                </summary>
                <pre className="bg-gray-100 p-4 rounded text-xs overflow-auto max-h-64">
                  {this.state.error?.stack}
                  {'\n\n'}
                  {this.state.errorInfo.componentStack}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;

