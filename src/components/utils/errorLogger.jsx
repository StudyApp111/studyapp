import { base44 } from "@/api/base44Client";

/**
 * Log an error to the ErrorLog entity for internal tracking
 * @param {string} errorType - Category: 'api_error', 'function_error', 'ui_error', 'validation_error'
 * @param {Error|string} error - The error object or message
 * @param {object} context - Additional context (page, function name, parameters, etc.)
 */
export async function logError(errorType, error, context = {}) {
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

    await base44.entities.ErrorLog.create({
      error_type: errorType,
      error_message: errorMessage,
      error_stack: errorStack,
      context: {
        ...context,
        url: window.location.href,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent
      },
      user_email: userEmail,
      resolved: false
    });

    // Also log to console for development
    console.error(`[ErrorLog] ${errorType}:`, errorMessage, context);
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