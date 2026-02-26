import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "@/components/theme/ThemeProvider";
import { Mail, Smartphone, Loader2, Eye, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { checkIsInAppBrowser, checkIsSocialInAppBrowser } from "@/components/utils/BrowserCompatibility";
import InAppBrowserGate from "@/components/guest/InAppBrowserGate";

export default function StepSignIn({ onSignIn, onGuestStart, onBack }) {
  const { isDark } = useTheme();
  const [showBrowserWarning, setShowBrowserWarning] = useState(false);
  const [guestLoading, setGuestLoading] = useState(false);
  const [guestError, setGuestError] = useState(null);
  const isInApp = checkIsInAppBrowser();
  const isSocialInApp = checkIsSocialInAppBrowser();

  const handleSignIn = (method) => {
    if (isInApp) {
      setShowBrowserWarning(true);
      return;
    }
    onSignIn(method);
  };

  const handleGuestStart = async () => {
    if (!onGuestStart) return;
    setGuestLoading(true);
    setGuestError(null);
    const result = await onGuestStart();
    if (!result.allowed) {
      setGuestError(result.reason);
    }
    setGuestLoading(false);
  };

  // TikTok/Instagram: completely gate auth — only show guest preview + open-in-browser
  if (isSocialInApp) {
    return (
      <motion.div
        initial={{ opacity: 0, x: 30 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -30 }}
        transition={{ duration: 0.25 }}
        className="text-center space-y-6 py-4"
      >
        {/* Guest preview CTA first */}
        {onGuestStart && (
          <div className="space-y-3 max-w-sm mx-auto">
            <div className="space-y-2">
              <h2 className={`text-2xl font-black ${isDark ? "text-white" : "text-slate-900"}`}>
                Try it out — no sign in needed
              </h2>
              <p className={`text-sm ${isDark ? "text-slate-400" : "text-slate-600"}`}>
                Upload your notes and get your predicted grade instantly.
              </p>
            </div>
            <button
              onClick={handleGuestStart}
              disabled={guestLoading}
              className="w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl font-semibold text-sm transition-all bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white shadow-lg shadow-emerald-500/25 disabled:opacity-50"
            >
              {guestLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Eye className="w-4 h-4" />
                  Preview as Guest
                </>
              )}
            </button>
            {guestError && (
              <p className="text-xs text-red-400 text-center">{guestError}</p>
            )}
            <div className={`flex items-center gap-3 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
              <div className={`flex-1 h-px ${isDark ? 'bg-white/10' : 'bg-slate-200'}`} />
              <span className="text-xs font-medium">or to save progress</span>
              <div className={`flex-1 h-px ${isDark ? 'bg-white/10' : 'bg-slate-200'}`} />
            </div>
          </div>
        )}

        {/* Open in browser gate — NO auth buttons */}
        <InAppBrowserGate
          title="Open in your browser to sign in"
          subtitle="This app browser doesn't support Google or email sign in. Open in Safari or Chrome first!"
        />

        {onBack && (
          <div className="pt-1">
            <Button
              variant="ghost"
              onClick={onBack}
              className={`${isDark ? "text-slate-400 hover:text-white" : "text-slate-500 hover:text-slate-900"}`}
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Back
            </Button>
          </div>
        )}
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -30 }}
      transition={{ duration: 0.25 }}
      className="text-center space-y-6 py-4"
    >
      <AnimatePresence mode="wait">
        {showBrowserWarning ? (
          <motion.div
            key="browser-warning"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-5"
          >
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto ${isDark ? 'bg-amber-500/20' : 'bg-amber-100'}`}>
              <Smartphone className={`w-8 h-8 ${isDark ? 'text-amber-400' : 'text-amber-600'}`} />
            </div>

            <div className="space-y-2">
              <h2 className={`text-xl font-black ${isDark ? "text-white" : "text-slate-900"}`}>
                Open in your browser to continue
              </h2>
              <p className={`text-sm ${isDark ? "text-slate-400" : "text-slate-600"}`}>
                This in-app browser doesn't support sign in. It only takes a second!
              </p>
            </div>

            <div className={`rounded-2xl p-5 border space-y-3 ${isDark ? 'bg-white/5 border-white/10' : 'bg-purple-50 border-purple-200'}`}>
              <p className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>How to open in your browser:</p>
              <div className="space-y-2 text-left">
                <div className="flex items-start gap-3">
                  <span className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${isDark ? 'bg-purple-600/30 text-purple-300' : 'bg-purple-200 text-purple-700'}`}>1</span>
                  <p className={`text-sm ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                    Tap the <strong>⋮</strong> or <strong>⋯</strong> menu at the top right
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <span className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${isDark ? 'bg-purple-600/30 text-purple-300' : 'bg-purple-200 text-purple-700'}`}>2</span>
                  <p className={`text-sm ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                    Select <strong>"Open in browser"</strong> or <strong>"Open in Safari/Chrome"</strong>
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-col items-center gap-3">
              <button
                onClick={() => setShowBrowserWarning(false)}
                className={`text-sm font-medium ${isDark ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600'} transition-colors`}
              >
                ← Go back
              </button>

              {onGuestStart && (
                <div className="w-full max-w-sm space-y-2 pt-2 border-t border-slate-200/20">
                  <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                    Or try a quick preview first
                  </p>
                  <button
                    onClick={handleGuestStart}
                    disabled={guestLoading}
                    className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm transition-all bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white shadow-lg shadow-emerald-500/25 disabled:opacity-50"
                  >
                    {guestLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <Eye className="w-4 h-4" />
                        Preview as Guest
                      </>
                    )}
                  </button>
                  {guestError && (
                    <p className="text-xs text-red-400">{guestError}</p>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="sign-in-options"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            <div className="space-y-3">
              <h2 className={`text-2xl font-black ${isDark ? "text-white" : "text-slate-900"}`}>
                Find out what grade you'd get today.
              </h2>
              <p className={`text-sm ${isDark ? "text-slate-400" : "text-slate-600"}`}>
                Sign in and upload your first lesson — we'll run a diagnostic and predict your actual grade.
              </p>
            </div>

            {/* Guest preview for mobile users - shown ABOVE auth buttons */}
            {onGuestStart && (
              <div className="space-y-2 max-w-sm mx-auto pb-1">
                <button
                  onClick={handleGuestStart}
                  disabled={guestLoading}
                  className="w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl font-semibold text-sm transition-all bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white shadow-lg shadow-emerald-500/25 disabled:opacity-50"
                >
                  {guestLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Eye className="w-4 h-4" />
                      Preview as Guest
                    </>
                  )}
                </button>
                {guestError && (
                  <p className="text-xs text-red-400 text-center">{guestError}</p>
                )}
                <div className={`flex items-center gap-3 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                  <div className={`flex-1 h-px ${isDark ? 'bg-white/10' : 'bg-slate-200'}`} />
                  <span className="text-xs font-medium">or sign up</span>
                  <div className={`flex-1 h-px ${isDark ? 'bg-white/10' : 'bg-slate-200'}`} />
                </div>
              </div>
            )}

            {/* Sign-in buttons */}
            <div className="space-y-3 max-w-sm mx-auto">
              <button
                onClick={() => handleSignIn("google")}
                className={`w-full flex items-center justify-center gap-3 px-6 py-3.5 rounded-xl font-semibold text-sm transition-all border ${
                  isDark
                    ? "bg-white/5 hover:bg-white/10 text-white border-white/10"
                    : "bg-white hover:bg-slate-50 text-slate-900 border-slate-200 shadow-sm"
                }`}
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
                Continue with Google
              </button>

              <button
                onClick={() => handleSignIn("email")}
                className={`w-full flex items-center justify-center gap-3 px-6 py-3.5 rounded-xl font-semibold text-sm transition-all border ${
                  isDark
                    ? "bg-white/5 hover:bg-white/10 text-white border-white/10"
                    : "bg-white hover:bg-slate-50 text-slate-900 border-slate-200 shadow-sm"
                }`}
              >
                <Mail className="w-5 h-5" />
                Continue with Email
              </button>
            </div>

            <p className={`text-xs ${isDark ? "text-slate-500" : "text-slate-400"}`}>
              By continuing, you agree to our{" "}
              <a href="https://studyappai.com/terms-of-service" target="_blank" rel="noopener noreferrer" className="underline">Terms of Service</a> and{" "}
              <a href="https://studyappai.com/privacy-policy" target="_blank" rel="noopener noreferrer" className="underline">Privacy Policy</a>
            </p>

            {onBack && (
              <div className="pt-1">
                <Button
                  variant="ghost"
                  onClick={onBack}
                  className={`${isDark ? "text-slate-400 hover:text-white" : "text-slate-500 hover:text-slate-900"}`}
                >
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  Back
                </Button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}