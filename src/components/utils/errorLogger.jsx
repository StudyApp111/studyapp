import { base44 } from "@/api/base44Client";
import { detectDeviceInfo } from "@/components/utils/userTracking";

/**
 * Log an error to the ErrorLog entity for internal tracking
 * @param {string} errorType - Category: 'api_error', 'function_error', 'ui_error', 'validation_error'
 * @param {Error|string} error - The error object or message
 * @param {object} context - Additional context (page, function name, parameters, etc.)
 */
export async function logError(errorType, error, context = {}) {
  // Always log to console immediately
  console.error(`[ErrorLog] ${errorType}:`, error?.message || error, context);
  
  try {
    const errorMessage = error?.message || String(error);
    const errorStack = error?.stack || null;
    
    let userEmail = null;
    try {
      const user = await base44.auth.me();
      userEmail = user?.email;
    } catch {
      // User not authenticated, that's fine
    }

    const enrichedContext = {
      ...context,
      url: typeof window !== 'undefined' ? window.location.href : undefined,
      timestamp: new Date().toISOString(),
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
      pageName: typeof window !== 'undefined' ? window.__currentPageName : undefined,
      appStep: typeof window !== 'undefined' ? window.__appStep : undefined,
      lastAction: typeof window !== 'undefined' ? window.__lastAction : undefined,
      device: (() => { try { return detectDeviceInfo(); } catch { return undefined; } })(),
    };

    const errorCode = (error && error.response && error.response.data && error.response.data.code) || error?.code || null;

    // Try entity creation with better error handling
    try {
      await base44.entities.ErrorLog.create({
        error_type: errorType,
        error_message: errorMessage,
        error_stack: errorStack,
        context: { ...enrichedContext, error_code: errorCode },
        user_email: userEmail,
        resolved: false
      });
    } catch (entityErr) {
      console.error('[ErrorLog] Failed to create ErrorLog entity:', entityErr.message);
    }

    // Fire-and-forget support email with timeout
    Promise.race([
      base44.functions.invoke('reportError', {
        subject: `${errorType.toUpperCase()} - ${errorMessage.substring(0, 140)}`,
        body: errorStack || errorMessage,
        severity: 'error',
        context: { ...enrichedContext, error_code: errorCode },
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Email timeout')), 5000))
    ]).catch(emailErr => {
      console.warn('[ErrorLog] Failed to notify support:', emailErr?.message || emailErr);
    });

  } catch (logError) {
    // Don't let logging errors break the app
    console.error('[ErrorLog] Failed to log error:', logError);
  }
}

/**
 * Wrapper to catch and log errors from async functions
 * @param {Function} fn - Async function to wrap
 * @param {string} errorType - Error category
 * @param {object} context - Additional context
 */
export function withErrorLogging(fn, errorType, context = {}) {
  return async (...args) => {
    try {
      return await fn(...args);
    } catch (error) {
      await logError(errorType, error, { ...context, args: JSON.stringify(args).substring(0, 500) });
      throw error; // Re-throw so the UI can handle it
    }
  };
}