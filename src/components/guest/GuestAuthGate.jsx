import React, { useState } from "react";
import { motion } from "framer-motion";
import { useTheme } from "@/components/theme/ThemeProvider";
import { Lock, Mail, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { checkIsSocialInAppBrowser } from "@/components/utils/BrowserCompatibility";
import { useGuestSession } from "@/components/guest/GuestSessionContext";
import InAppBrowserGate from "@/components/guest/InAppBrowserGate";

/**
 * Full-page gate shown to guest users on locked pages (SmartGrader, Settings, etc.).
 * Shows sign-up prompt in normal browsers, or InAppBrowserGate in TikTok/Instagram.
 */
export default function GuestAuthGate({ icon: Icon = Lock, title, subtitle }) {
  const { isDark } = useTheme();
  const { guestData } = useGuestSession();
  const isSocialInApp = checkIsSocialInAppBrowser();
  const [isRedirecting, setIsRedirecting] = useState(false);

  const handleSignIn = () => {
    setIsRedirecting(true);
    const lessonId = guestData?.lessonData?.id;
    if (lessonId) {
      localStorage.setItem("guest_returning_lesson_id", lessonId);
      sessionStorage.setItem("guest_returning_lesson_id", lessonId);
    }
    if (guestData?.fingerprint) {
      localStorage.setItem("guest_returning_fingerprint", guestData.fingerprint);
      sessionStorage.setItem("guest_returning_fingerprint", guestData.fingerprint);
    }
    localStorage.setItem("guest_returning_to_lesson", "true");
    sessionStorage.setItem("guest_returning_to_lesson", "true");
    setTimeout(() => {
      base44.auth.redirectToLogin(window.location.origin);
    }, 100);
  };

  return (
    <div className={`min-h-screen flex items-center justify-center p-6 ${isDark ? 'bg-[#0a0a12]' : 'bg-gradient-to-br from-purple-50 via-yellow-50/30 to-purple-100/40'}`}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={`w-full max-w-md rounded-3xl shadow-2xl border overflow-hidden ${
          isDark ? 'bg-[#12121a] border-white/10' : 'bg-white border-slate-200'
        }`}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 via-purple-700 to-indigo-700 px-6 py-8 text-center">
          <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center mx-auto mb-4">
            <Icon className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-xl font-black text-white mb-1">
            {title || "Sign Up to Access This Feature"}
          </h2>
          <p className="text-purple-100 text-sm">
            {subtitle || "Create a free account to unlock all features"}
          </p>
        </div>

        <div className="p-6">
          {isSocialInApp ? (
            <InAppBrowserGate
              title="Open in your browser to sign up"
              subtitle="This app browser doesn't support sign in. Open in Safari or Chrome to continue!"
            />
          ) : (
            <div className="space-y-4">
              <button
                onClick={handleSignIn}
                disabled={isRedirecting}
                className={`w-full flex items-center justify-center gap-3 px-6 py-3.5 rounded-xl font-semibold text-sm transition-all border disabled:opacity-70 ${
                  isDark
                    ? "bg-white/5 hover:bg-white/10 text-white border-white/10"
                    : "bg-white hover:bg-slate-50 text-slate-900 border-slate-200 shadow-sm"
                }`}
              >
                {isRedirecting ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                  </svg>
                )}
                {isRedirecting ? 'Opening...' : 'Continue with Google'}
              </button>

              <button
                onClick={handleSignIn}
                disabled={isRedirecting}
                className={`w-full flex items-center justify-center gap-3 px-6 py-3.5 rounded-xl font-semibold text-sm transition-all border disabled:opacity-70 ${
                  isDark
                    ? "bg-white/5 hover:bg-white/10 text-white border-white/10"
                    : "bg-white hover:bg-slate-50 text-slate-900 border-slate-200 shadow-sm"
                }`}
              >
                {isRedirecting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Mail className="w-5 h-5" />}
                {isRedirecting ? 'Opening...' : 'Continue with Email'}
              </button>

              <p className={`text-center text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                100% free • No credit card required
              </p>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}