import React from "react";
import { motion } from "framer-motion";
import { useTheme } from "@/components/theme/ThemeProvider";
import { Clock, ExternalLink, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useGuestSession } from "./GuestSessionContext";
import { base44 } from "@/api/base44Client";

export default function GuestTimerLockout() {
  const { isDark } = useTheme();
  const { isTimerExpired, isGuest } = useGuestSession();

  if (!isGuest || !isTimerExpired) return null;

  const handleOpenInBrowser = () => {
    // For in-app browsers, try to trigger "open in browser"
    const url = window.location.href;
    // Try intent-based opening for Android
    window.open(url, '_system');
  };

  const handleSignIn = () => {
    // Clear guest state and redirect to login
    const returnUrl = window.location.pathname + window.location.search;
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
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 via-purple-700 to-indigo-700 px-6 py-8 text-center">
          <Clock className="w-14 h-14 text-white/80 mx-auto mb-3" />
          <h2 className="text-2xl font-black text-white mb-1">
            Guest Preview Ended
          </h2>
          <p className="text-purple-100 text-sm">
            Your 5-minute preview has expired
          </p>
        </div>

        <div className="p-6 space-y-4">
          <p className={`text-center text-sm ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
            Sign up for free to continue studying. Your lesson and progress will be saved!
          </p>

          {/* Instructions for in-app browser */}
          <div className={`rounded-2xl p-4 border space-y-3 ${isDark ? 'bg-white/5 border-white/10' : 'bg-purple-50 border-purple-200'}`}>
            <p className={`text-sm font-semibold text-center ${isDark ? 'text-white' : 'text-slate-900'}`}>
              To sign up, open in your browser:
            </p>
            <div className="space-y-2 text-left">
              <div className="flex items-start gap-3">
                <span className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${isDark ? 'bg-purple-600/30 text-purple-300' : 'bg-purple-200 text-purple-700'}`}>1</span>
                <p className={`text-sm ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                  Tap the <strong>⋮</strong> or <strong>⋯</strong> menu at the top
                </p>
              </div>
              <div className="flex items-start gap-3">
                <span className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${isDark ? 'bg-purple-600/30 text-purple-300' : 'bg-purple-200 text-purple-700'}`}>2</span>
                <p className={`text-sm ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                  Select <strong>"Open in browser"</strong>
                </p>
              </div>
              <div className="flex items-start gap-3">
                <span className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${isDark ? 'bg-purple-600/30 text-purple-300' : 'bg-purple-200 text-purple-700'}`}>3</span>
                <p className={`text-sm ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                  Sign up for free — your lesson will be waiting!
                </p>
              </div>
            </div>
          </div>

          <Button
            onClick={handleSignIn}
            className="w-full h-12 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold rounded-xl"
          >
            <ExternalLink className="w-4 h-4 mr-2" />
            Sign Up Free
          </Button>

          <p className={`text-center text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
            100% free • No credit card required
          </p>
        </div>
      </motion.div>
    </div>
  );
}