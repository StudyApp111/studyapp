import React from "react";
import { logError } from "@/components/utils/errorLogger";

/**
 * Global React error boundary.
 *
 * Catches uncaught render-time errors anywhere in the component tree below
 * it, logs them via `logError` (which writes to ErrorLog entity and emails
 * support), and shows a friendly fallback UI instead of a blank white screen.
 *
 * Mounted near the root in App.jsx — wraps every page.
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // Fire-and-forget — never block the UI on logging.
    logError("react_error_boundary", error, {
      componentStack: errorInfo?.componentStack?.slice(0, 2000),
      url: typeof window !== "undefined" ? window.location.href : undefined,
    }).catch(() => {});
  }

  handleReset = () => {
    // Navigate to Home and reset the boundary state.
    window.location.href = "/";
  };

  render() {
    if (this.state.hasError) {
      const message = this.state.error?.message || "Something went wrong.";
      return (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-6 bg-slate-50">
          <div className="max-w-sm w-full bg-white rounded-2xl shadow-xl border border-slate-200 p-6 text-center">
            <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-3 text-2xl">
              ⚠️
            </div>
            <h2 className="text-lg font-bold text-slate-900 mb-1">
              Something went wrong
            </h2>
            <p className="text-sm text-slate-600 mb-4 break-words">
              {message.slice(0, 200)}
            </p>
            <button
              onClick={this.handleReset}
              className="w-full h-10 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white text-sm font-semibold transition-colors"
            >
              Back to Home
            </button>
            <p className="text-[11px] text-slate-400 mt-3">
              We've logged the issue automatically.
            </p>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}