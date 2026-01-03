import React, { useState, useEffect } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Coffee, Zap, Trophy, Brain, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import { base44 } from "@/api/base44Client";
import XPGainToast from "@/components/gamification/XPGainToast";

export default function PomodoroTimer({ elapsedSeconds, onBreakComplete }) {
  const [showBreakPrompt, setShowBreakPrompt] = useState(false);
  const [isOnBreak, setIsOnBreak] = useState(false);
  const [breakTimeLeft, setBreakTimeLeft] = useState(300); // 5 minutes in seconds
  const [hasPromptedAt20, setHasPromptedAt20] = useState(false);
  const [pomodoroCount, setPomodoroCount] = useState(0);
  const [xpToast, setXpToast] = useState({ show: false, xp: 0, reason: '' });
  const [xpAwarded, setXpAwarded] = useState(false);

  useEffect(() => {
    // Show break prompt every 20 minutes
    if (elapsedSeconds > 0 && elapsedSeconds % 1200 === 0) {
      const currentInterval = Math.floor(elapsedSeconds / 1200);
      if (!hasPromptedAt20 || currentInterval !== Math.floor((elapsedSeconds - 1) / 1200)) {
        setShowBreakPrompt(true);
        setHasPromptedAt20(true);
        setXpAwarded(false);
        // Award XP for completing 20 min focus session
        awardXP(25, "20 min focus session! 🎯");
        setPomodoroCount(prev => prev + 1);
      }
    }
  }, [elapsedSeconds]);

  useEffect(() => {
    let interval;
    if (isOnBreak) {
      interval = setInterval(() => {
        setBreakTimeLeft(prev => {
          if (prev <= 1) {
            // Award bonus XP for completing full break
            awardXP(25, "Full break completed! 🧘");
            setIsOnBreak(false);
            setShowBreakPrompt(false);
            onBreakComplete?.();
            return 300;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isOnBreak]);

  const awardXP = async (amount, reason) => {
    try {
      const user = await base44.auth.me();
      await base44.auth.updateMe({
        daily_xp: (user.daily_xp || 0) + amount,
        total_points: (user.total_points || 0) + amount
      });
      setXpToast({ show: true, xp: amount, reason });
    } catch (error) {
      console.error("Error awarding XP:", error);
    }
  };

  const handleStartBreak = () => {
    setIsOnBreak(true);
    setBreakTimeLeft(300);
  };

  const handleSkipBreak = () => {
    setShowBreakPrompt(false);
    setIsOnBreak(false);
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const breakProgress = ((300 - breakTimeLeft) / 300) * 100;

  return (
    <>
      <Dialog open={showBreakPrompt || isOnBreak} onOpenChange={(open) => !open && handleSkipBreak()}>
        <DialogContent className="max-w-[320px] w-[calc(100%-2rem)] mx-auto rounded-2xl p-5">
          {isOnBreak ? (
            <div className="space-y-4">
              {/* Break header */}
              <div className="text-center">
                <motion.div
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ repeat: Infinity, duration: 2 }}
                  className="w-14 h-14 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-full flex items-center justify-center mx-auto mb-3"
                >
                  <Coffee className="w-7 h-7 text-white" />
                </motion.div>
                <h2 className="text-lg font-bold text-slate-900">Recharging Your Brain</h2>
                <p className="text-xs text-slate-500 mt-1">Stay away from screens for best results</p>
              </div>

              {/* Timer with progress ring */}
              <div className="relative flex items-center justify-center py-4">
                <svg className="w-32 h-32 transform -rotate-90">
                  <circle
                    cx="64"
                    cy="64"
                    r="56"
                    fill="none"
                    stroke="#e2e8f0"
                    strokeWidth="8"
                  />
                  <motion.circle
                    cx="64"
                    cy="64"
                    r="56"
                    fill="none"
                    stroke="url(#breakGradient)"
                    strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray={352}
                    strokeDashoffset={352 - (352 * breakProgress / 100)}
                  />
                  <defs>
                    <linearGradient id="breakGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#10b981" />
                      <stop offset="100%" stopColor="#14b8a6" />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-3xl font-bold text-emerald-600 font-mono">
                    {formatTime(breakTimeLeft)}
                  </span>
                  <span className="text-[10px] text-slate-400 mt-1">remaining</span>
                </div>
              </div>

              {/* XP reward preview */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-gradient-to-r from-yellow-50 to-amber-50 border border-yellow-200 rounded-xl p-3 text-center"
              >
                <div className="flex items-center justify-center gap-2">
                  <Sparkles className="w-4 h-4 text-yellow-600" />
                  <span className="text-xs text-yellow-800">
                    Complete break for <span className="font-bold">+25 XP</span> bonus!
                  </span>
                </div>
              </motion.div>

              {/* Tips */}
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                <p className="text-[11px] text-slate-600 text-center">
                  💡 <span className="font-medium">Stand up, stretch, hydrate, or look outside!</span>
                </p>
              </div>

              <Button
                onClick={handleSkipBreak}
                variant="ghost"
                className="w-full h-8 text-xs text-slate-400 hover:text-slate-600"
              >
                Skip break (no bonus XP)
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Celebration header */}
              <div className="text-center">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1, rotate: [0, 10, -10, 0] }}
                  transition={{ duration: 0.5 }}
                  className="w-14 h-14 bg-gradient-to-br from-yellow-400 to-amber-500 rounded-full flex items-center justify-center mx-auto mb-3 shadow-lg shadow-yellow-500/30"
                >
                  <Trophy className="w-7 h-7 text-white" />
                </motion.div>
                <h2 className="text-lg font-bold text-slate-900">Pomodoro Complete! 🎉</h2>
                <p className="text-xs text-slate-500 mt-1">20 minutes of focused studying</p>
              </div>

              {/* XP Earned */}
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="bg-gradient-to-r from-purple-600 to-indigo-600 rounded-xl p-4 text-center text-white"
              >
                <div className="flex items-center justify-center gap-2 mb-1">
                  <Zap className="w-5 h-5 text-yellow-300" />
                  <span className="text-2xl font-bold">+25 XP</span>
                </div>
                <p className="text-xs opacity-90">Focus session reward</p>
              </motion.div>

              {/* Pomodoro explanation */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                <div className="flex gap-2">
                  <Brain className="w-4 h-4 text-purple-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-semibold text-slate-800 mb-1">Why take a break?</p>
                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      The <span className="font-medium">Pomodoro Technique</span> uses timed intervals to boost focus. 
                      Short breaks help your brain consolidate what you learned and prevent burnout. 
                      Studies show this improves retention by up to 40%!
                    </p>
                  </div>
                </div>
              </div>

              {/* Bonus XP incentive */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-xl p-3 text-center"
              >
                <div className="flex items-center justify-center gap-2 mb-1">
                  <Coffee className="w-4 h-4 text-emerald-600" />
                  <span className="text-xs font-bold text-emerald-800">Take a 5 min break</span>
                </div>
                <p className="text-[11px] text-emerald-700">
                  Complete the full break for <span className="font-bold">+25 bonus XP</span>!
                </p>
              </motion.div>

              <div className="flex flex-col gap-2">
                <Button
                  onClick={handleStartBreak}
                  className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 h-11 text-sm font-semibold shadow-lg shadow-emerald-500/30"
                >
                  <Coffee className="w-4 h-4 mr-2" />
                  Start 5 min Break (+25 XP)
                </Button>
                <Button
                  onClick={handleSkipBreak}
                  variant="ghost"
                  className="w-full h-8 text-xs text-slate-400 hover:text-slate-600"
                >
                  Skip break
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* XP Toast */}
      <XPGainToast 
        xpGained={xpToast.xp}
        reason={xpToast.reason}
        show={xpToast.show}
        onComplete={() => setXpToast({ show: false, xp: 0, reason: '' })}
      />
    </>
  );
}