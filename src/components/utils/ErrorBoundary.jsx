import React from "react";
import { logError } from "@/components/utils/errorLogger";

/**
 * ErrorBoundary — Catches uncaught React render errors that would otherwise
 * leave the user staring at a blank screen.
 *
 * - Logs the error to ErrorLog via our existing logError helper (so admins
 *   can see it in the dashboard).
 * - Shows a clear, actionable fallback UI with a "Try again" button that
 *   resets the boundary, and a "Go Home" link.
 *
 * Wrap suspect-of-crashing areas (especially pages) with this. Each
 * boundary catches errors only in its own subtree, so a crash in one
 * page won't take down the whole app.
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    // Fire-and-forget log; never let the logger itself throw.
    try {
      logError("ui_error", error, {
        scope: this.props.scope || "unknown",
        componentStack: info?.componentStack?.substring(0, 1500),
      });
    } catch {}
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.handleReset);
      }
      return (
        <div className="min-h-[60vh] flex items-center justify-center p-6">
          <div className="max-w-sm w-full text-center bg-white dark:bg-[#12121a] border border-slate-200 dark:border-white/10 rounded-2xl p-6 shadow-lg">
            <div className="text-4xl mb-3">⚠️</div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-1">
              Something went wrong
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
              We've logged the issue. Try reloading — and if it keeps happening,
              tap "Go Home".
            </p>
            <div className="flex gap-2 justify-center">
              <button
                onClick={this.handleReset}
                className="h-10 px-4 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold"
              >
                Try again
              </button>
              <a
                href="/Home"
                className="h-10 px-4 rounded-lg border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 text-sm font-semibold flex items-center"
              >
                Go Home
              </a>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}