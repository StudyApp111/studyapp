import React from "react";
import { motion } from "framer-motion";
import { useTheme } from "@/components/theme/ThemeProvider";
import { CheckCircle2, Clock, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useGuestSession } from "./GuestSessionContext";
import { base44 } from "@/api/base44Client";

export default function GuestLessonCreatedModal({ onDismiss }) {
  const { isDark } = useTheme();
  const { timeRemaining } = useGuestSession();

  const minutes = Math.floor(timeRemaining / 60);
  const seconds = timeRemaining % 60;

  return (
    <div className="fixed inset-0 z-[99998] bg-black/60 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className={`w-full max-w-md rounded-3xl shadow-2xl border overflow-hidden ${
          isDark ? 'bg-[#12121a] border-white/10' : 'bg-white border-slate-200'
        }`}
      >
        <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-6 text-center">
          <CheckCircle2 className="w-12 h-12 text-white/90 mx-auto mb-2" />
          <h2 className="text-xl font-black text-white">Lesson Created!</h2>
        </div>

        <div className="p-6 space-y-4">
          <p className={`text-center text-sm ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
            You're exploring as a guest. You have <strong>{minutes}:{seconds.toString().padStart(2, '0')}</strong> left to preview.
          </p>

          <div className={`rounded-xl p-4 border text-center ${isDark ? 'bg-amber-500/10 border-amber-500/30' : 'bg-amber-50 border-amber-200'}`}>
            <div className="flex items-center justify-center gap-2 mb-1">
              <Clock className={`w-4 h-4 ${isDark ? 'text-amber-400' : 'text-amber-600'}`} />
              <span className={`text-sm font-bold ${isDark ? 'text-amber-300' : 'text-amber-700'}`}>
                Guest Preview Limits
              </span>
            </div>
            <p className={`text-xs ${isDark ? 'text-amber-200/70' : 'text-amber-600'}`}>
              1 lesson only • 5-minute preview • Sign up to keep everything
            </p>
          </div>

          <Button
            onClick={onDismiss}
            className="w-full h-12 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold rounded-xl"
          >
            Explore My Lesson
          </Button>

          <button
            onClick={() => {
              const returnUrl = window.location.pathname + window.location.search;
              base44.auth.redirectToLogin(returnUrl);
            }}
            className={`w-full text-sm font-medium ${isDark ? 'text-purple-400 hover:text-purple-300' : 'text-purple-600 hover:text-purple-700'} transition-colors`}
          >
            <ExternalLink className="w-3 h-3 inline mr-1" />
            Sign up now to save everything
          </button>
        </div>
      </motion.div>
    </div>
  );
}