import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Trophy, Sparkles, ArrowRight, X, TrendingUp, Target } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useTheme } from "@/components/theme/ThemeProvider";
import { useSubscription } from "@/components/subscription/SubscriptionContext";
import posthog from "posthog-js";

export default function PostDiagnosticPaywall({ lessonId }) {
  const { isDark } = useTheme();
  const { isPro, triggerUpgradeModal } = useSubscription();
  const [show, setShow] = useState(false);
  const [gradeData, setGradeData] = useState(null);

  useEffect(() => {
    const handleDiagnosticComplete = (e) => {
      // Only show for free users
      if (isPro()) return;
      
      const key = `post_diagnostic_paywall_${lessonId}`;
      if (sessionStorage.getItem(key)) return;

      const { predicted_grade, total_score, mastery_gap } = e.detail;
      setGradeData({ predicted_grade, total_score, mastery_gap });
      
      // Show after a brief delay so user sees their results first
      setTimeout(() => {
        sessionStorage.setItem(key, 'true');
        setShow(true);
        try {
          posthog.capture('paywall_shown', {
            reason: 'post_diagnostic',
            predicted_grade: predicted_grade,
            predicted_score: total_score,
            device_type: window.innerWidth >= 768 ? 'desktop' : 'mobile',
            page: window.location.pathname,
          });
        } catch {}
      }, 2500);
    };

    window.addEventListener('pollyDiagnosticComplete', handleDiagnosticComplete);
    return () => window.removeEventListener('pollyDiagnosticComplete', handleDiagnosticComplete);
  }, [lessonId, isPro]);

  const handleUpgrade = () => {
    setShow(false);
    triggerUpgradeModal('diagnostic_complete');
  };

  if (!show || !gradeData) return null;

  return (
    <Dialog open={show} onOpenChange={setShow}>
      <DialogContent className="max-w-[calc(100vw-24px)] sm:max-w-sm p-0 overflow-hidden border-0 bg-transparent [&>button]:hidden">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative overflow-hidden rounded-2xl border border-purple-500/30 shadow-2xl"
        >
          {/* Close */}
          <button 
            onClick={() => setShow(false)}
            className="absolute top-3 right-3 z-20 w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/70 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Gradient hero */}
          <div className="bg-gradient-to-br from-[#1a1040] via-[#2a1560] to-indigo-900 px-5 pt-6 pb-4 text-center">
            {/* Grade reveal with glow */}
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2, type: "spring" }}
              className="mb-4 relative"
            >
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-28 h-28 bg-amber-500/20 rounded-full blur-2xl" />
              </div>
              <div className="relative w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-xl shadow-amber-500/30 mb-2">
                <span className="text-3xl font-black text-white">{gradeData.predicted_grade || '?'}</span>
              </div>
              <p className="text-white/50 text-[10px] uppercase tracking-widest font-bold">Predicted Grade</p>
            </motion.div>

            <h2 className="text-lg font-black text-white mb-1.5 leading-tight">
              You're one study plan away from knowing your grade.
            </h2>
            
            <p className="text-purple-200/80 text-sm leading-relaxed max-w-[300px] mx-auto">
              Try everything free for 7 days — no credit card needed.
            </p>
          </div>

          {/* CTA area */}
          <div className="bg-[#1a1040] px-5 pb-5 pt-3 space-y-3">
            {/* Price display */}
            <div className="text-center mb-1">
              <p className="text-purple-200/90 text-xs font-medium">
                $4.99/mo after trial · Only $0.16/day · Cancel anytime
              </p>
            </div>

            {/* Feature bullets */}
            <div className="space-y-1.5 mb-1">
              {[
                'Know your predicted grade before you study',
                'A study plan built around your exact gaps',
                'Unlimited courses and diagnostics',
                'AI tutor that knows your material'
              ].map((f, i) => (
                <div key={i} className="flex items-center gap-2 text-[11px] text-white/80">
                  <span className="text-emerald-400 flex-shrink-0">✓</span>
                  <span>{f}</span>
                </div>
              ))}
            </div>
            
            <Button
              onClick={handleUpgrade}
              className="w-full bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 text-white font-bold py-3.5 text-sm rounded-xl shadow-lg shadow-purple-500/30"
            >
              Start My Free 7 Days →
            </Button>
            <p className="text-center text-[9px] text-purple-300/40">No credit card required. We'll remind you before your trial ends.</p>

            <button
              onClick={() => setShow(false)}
              className="w-full text-center text-[10px] text-purple-300/40 hover:text-purple-200 transition-colors py-0.5"
            >
              I'll explore for free first
            </button>
          </div>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
}