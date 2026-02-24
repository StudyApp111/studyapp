import React from "react";
import { motion } from "framer-motion";
import { useTheme } from "@/components/theme/ThemeProvider";
import { Mail, Smartphone, Lock } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { checkIsInAppBrowser } from "@/components/utils/BrowserCompatibility";

export default function GuestSignUpModal({ predictedGrade, predictedScore }) {
  const { isDark } = useTheme();
  const isInApp = checkIsInAppBrowser();

  const handleSignIn = (method) => {
    const returnUrl = window.location.pathname + window.location.search;
    sessionStorage.setItem("guest_returning_to_lesson", "true");
    base44.auth.redirectToLogin(returnUrl);
  };

  return (
    <div className="fixed inset-0 z-[99999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className={`w-full max-w-md rounded-3xl shadow-2xl border overflow-hidden ${
          isDark ? 'bg-[#12121a] border-white/10' : 'bg-white border-slate-200'
        }`}
      >
        {/* Header with blurred grade */}
        <div className="bg-gradient-to-r from-purple-600 via-purple-700 to-indigo-700 px-6 py-8 text-center relative">
          {/* Blurred predicted grade pill */}
          <div className="relative inline-flex items-center gap-2 px-6 py-3 rounded-2xl border bg-white/10 border-white/20 mb-4">
            <div
              className="absolute inset-0 rounded-2xl z-10"
              style={{
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
                background: 'rgba(255,255,255,0.05)',
              }}
            />
            <Lock className="w-4 h-4 text-white/60 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20" />
            <span className="text-3xl font-black text-white select-none">{predictedGrade || 'B+'}</span>
            <span className="text-lg font-bold text-white/80 select-none">{predictedScore || '78'}%</span>
          </div>

          <h2 className="text-xl font-black text-white mb-1">
            Your Predicted Grade is Ready!
          </h2>
          <p className="text-purple-100 text-sm">
            Sign up free to unlock your grade and full study plan
          </p>
        </div>

        <div className="p-6 space-y-4">
          {/* In-app browser warning */}
          {isInApp && (
            <div className={`rounded-2xl p-4 border space-y-3 ${isDark ? 'bg-amber-500/10 border-amber-500/30' : 'bg-amber-50 border-amber-200'}`}>
              <div className="flex items-center gap-2 justify-center">
                <Smartphone className={`w-5 h-5 ${isDark ? 'text-amber-400' : 'text-amber-600'}`} />
                <p className={`text-sm font-bold ${isDark ? 'text-amber-300' : 'text-amber-800'}`}>
                  Open in your browser first
                </p>
              </div>
              <div className="space-y-2 text-left">
                <div className="flex items-start gap-3">
                  <span className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${isDark ? 'bg-amber-600/30 text-amber-300' : 'bg-amber-200 text-amber-700'}`}>1</span>
                  <p className={`text-sm ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                    Tap the <strong>⋮</strong> or <strong>⋯</strong> menu at the top
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <span className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${isDark ? 'bg-amber-600/30 text-amber-300' : 'bg-amber-200 text-amber-700'}`}>2</span>
                  <p className={`text-sm ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                    Select <strong>"Open in Safari/Chrome"</strong>
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <span className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${isDark ? 'bg-amber-600/30 text-amber-300' : 'bg-amber-200 text-amber-700'}`}>3</span>
                  <p className={`text-sm ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                    Then sign up — your lesson will be waiting!
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Sign-in buttons */}
          <div className="space-y-3">
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

          <p className={`text-center text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
            100% free • No credit card • Your lesson is saved
          </p>
        </div>
      </motion.div>
    </div>
  );
}