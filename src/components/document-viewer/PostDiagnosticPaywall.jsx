import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Trophy, Sparkles, ArrowRight, X, TrendingUp, Target } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useTheme } from "@/components/theme/ThemeProvider";
import { useSubscription } from "@/components/subscription/SubscriptionContext";

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
          <div className="bg-gradient-to-br from-[#1a1040] via-[#2a1560] to-indigo-900 p-6 text-center">
            {/* Grade reveal */}
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2, type: "spring" }}
              className="mb-4"
            >
              <div className="w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-xl shadow-amber-500/30 mb-3">
                <span className="text-3xl font-black text-white">{gradeData.predicted_grade || '?'}</span>
              </div>
              <p className="text-white/60 text-xs">Your Predicted Grade</p>
            </motion.div>

            <h2 className="text-xl font-black text-white mb-2 leading-tight">
              Your study plan is ready!
            </h2>
            
            {gradeData.mastery_gap && (
              <div className="flex items-center justify-center gap-2 mb-3">
                <Target className="w-3.5 h-3.5 text-red-400" />
                <span className="text-purple-200 text-xs">
                  Focus area: <span className="font-bold text-white">{gradeData.mastery_gap}</span>
                </span>
              </div>
            )}

            <p className="text-purple-200/80 text-xs leading-relaxed max-w-xs mx-auto">
              Unlock your <span className="font-bold text-white">full personalized study plan</span>, unlimited lessons, and advanced AI feedback to improve your grade.
            </p>
          </div>

          {/* CTA area */}
          <div className="bg-[#1a1040] p-5 space-y-3">
            <div className="flex items-center gap-2 text-[11px] text-white/70">
              <Sparkles className="w-3.5 h-3.5 text-purple-400 flex-shrink-0" />
              <span>Try free for 7 days · Cancel anytime</span>
            </div>
            
            <Button
              onClick={handleUpgrade}
              className="w-full bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 text-white font-bold py-3.5 text-sm rounded-xl shadow-lg shadow-purple-500/30"
            >
              <TrendingUp className="w-4 h-4 mr-2" />
              Start Free Trial — Improve Your Grade
            </Button>

            <button
              onClick={() => setShow(false)}
              className="w-full text-center text-[10px] text-purple-300/50 hover:text-purple-200 transition-colors py-1"
            >
              I'll explore for free first
            </button>
          </div>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
}