import { logError } from "@/components/utils/errorLogger";

/**
 * Installs window-level error listeners ONCE per session. Captures:
 *  - `window.error`         → uncaught synchronous errors
 *  - `unhandledrejection`   → uncaught promise rejections
 *
 * Both are logged to ErrorLog so we have full visibility into runtime
 * failures, not just errors we manually `try/catch` and report.
 *
 * Without this, runtime crashes on user devices are invisible to us —
 * we'd never know mobile users were seeing blank screens.
 */
let installed = false;

export function installGlobalErrorHandlers() {
  if (installed || typeof window === "undefined") return;
  installed = true;

  // Throttle: don't spam ErrorLog if the same error fires in a tight loop.
  const recent = new Map();
  const shouldLog = (key) => {
    const now = Date.now();
    const last = recent.get(key) || 0;
    if (now - last < 10_000) return false; // 10s window
    recent.set(key, now);
    return true;
  };

  window.addEventListener("error", (e) => {
    // Ignore ResizeObserver loop noise (benign, browser-emitted)
    const msg = e?.message || "";
    if (msg.includes("ResizeObserver loop")) return;

    const key = `err:${msg}`;
    if (!shouldLog(key)) return;

    logError("uncaught_error", e?.error || new Error(msg), {
      filename: e?.filename,
      lineno: e?.lineno,
      colno: e?.colno,
    }).catch(() => {});
  });

  window.addEventListener("unhandledrejection", (e) => {
    const reason = e?.reason;
    const msg = (reason && (reason.message || String(reason))) || "Unknown rejection";
    const key = `rej:${msg}`;
    if (!shouldLog(key)) return;

    logError("unhandled_rejection", reason instanceof Error ? reason : new Error(msg), {}).catch(() => {});
  });
}