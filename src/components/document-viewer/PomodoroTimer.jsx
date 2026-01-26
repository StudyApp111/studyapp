import React, { useState, useEffect } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Coffee, Zap, Trophy, Brain, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import { base44 } from "@/api/base44Client";
import XPGainToast from "@/components/gamification/XPGainToast";
import { useTheme } from "@/components/theme/ThemeProvider";

export default function PomodoroTimer({ elapsedSeconds, onBreakComplete, enabled = false }) {
  const { isDark } = useTheme();
  const [showBreakPrompt, setShowBreakPrompt] = useState(false);
  const [isOnBreak, setIsOnBreak] = useState(false);
  const [breakTimeLeft, setBreakTimeLeft] = useState(300); // 5 minutes in seconds
  const [hasPromptedAt20, setHasPromptedAt20] = useState(false);
  const [pomodoroCount, setPomodoroCount] = useState(0);
  const [xpToast, setXpToast] = useState({ show: false, xp: 0, reason: '' });
  const [xpAwarded, setXpAwarded] = useState(false);

  useEffect(() => {
    // Show break prompt every 20 minutes (only if enabled)
    if (!enabled) return;
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
  }, [elapsedSeconds, enabled]);

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
        <DialogContent className={`max-w-[300px] w-[calc(100%-2rem)] mx-auto rounded-2xl p-4 border-0 overflow-hidden ${isDark ? 'bg-[#1a1a2e]' : 'bg-white'}`}>
          {isOnBreak ? (
            <div className="space-y-3">
              {/* Break header */}
              <div className="text-center">
                <motion.div
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ repeat: Infinity, duration: 2 }}
                  className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-full flex items-center justify-center mx-auto mb-2"
                >
                  <Coffee className="w-5 h-5 text-white" />
                </motion.div>
                <h2 className={`text-base font-bold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>Break Time</h2>
              </div>

              {/* Timer with progress ring */}
              <div className="relative flex items-center justify-center py-2">
                <svg className="w-28 h-28 transform -rotate-90">
                  <circle
                    cx="56"
                    cy="56"
                    r="48"
                    fill="none"
                    stroke={isDark ? '#374151' : '#e2e8f0'}
                    strokeWidth="6"
                  />
                  <motion.circle
                    cx="56"
                    cy="56"
                    r="48"
                    fill="none"
                    stroke="url(#breakGradient)"
                    strokeWidth="6"
                    strokeLinecap="round"
                    strokeDasharray={302}
                    strokeDashoffset={302 - (302 * breakProgress / 100)}
                  />
                  <defs>
                    <linearGradient id="breakGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#10b981" />
                      <stop offset="100%" stopColor="#14b8a6" />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-2xl font-bold text-emerald-500 font-mono">
                    {formatTime(breakTimeLeft)}
                  </span>
                  <span className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>remaining</span>
                </div>
              </div>

              {/* XP reward preview */}
              <div className={`rounded-lg p-2 text-center ${isDark ? 'bg-yellow-500/20 border border-yellow-500/30' : 'bg-yellow-50 border border-yellow-200'}`}>
                <span className={`text-[10px] ${isDark ? 'text-yellow-300' : 'text-yellow-800'}`}>
                  Complete for <span className="font-bold">+25 XP</span>
                </span>
              </div>

              <Button
                onClick={handleSkipBreak}
                variant="ghost"
                className={`w-full h-8 text-xs ${isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-400 hover:text-slate-600'}`}
              >
                Skip break (no bonus XP)
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Celebration header */}
              <div className="text-center">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1, rotate: [0, 10, -10, 0] }}
                  transition={{ duration: 0.5 }}
                  className="w-10 h-10 bg-gradient-to-br from-yellow-400 to-amber-500 rounded-full flex items-center justify-center mx-auto mb-2 shadow-lg shadow-yellow-500/30"
                >
                  <Trophy className="w-5 h-5 text-white" />
                </motion.div>
                <h2 className={`text-base font-bold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>Pomodoro Complete! 🎉</h2>
                <p className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>20 min focused studying</p>
              </div>

              {/* XP Earned */}
              <div className="bg-gradient-to-r from-purple-600 to-indigo-600 rounded-lg p-3 text-center text-white">
                <div className="flex items-center justify-center gap-2">
                  <Zap className="w-4 h-4 text-yellow-300" />
                  <span className="text-xl font-bold">+25 XP</span>
                </div>
              </div>

              {/* Break incentive */}
              <div className={`rounded-lg p-2 text-center ${isDark ? 'bg-emerald-500/20 border border-emerald-500/30' : 'bg-emerald-50 border border-emerald-200'}`}>
                <p className={`text-[10px] ${isDark ? 'text-emerald-300' : 'text-emerald-800'}`}>
                  <Coffee className="w-3 h-3 inline mr-1" />
                  5 min break = <span className="font-bold">+25 bonus XP</span>
                </p>
              </div>

              <div className="flex flex-col gap-1.5">
                <Button
                  onClick={handleStartBreak}
                  className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 h-9 text-xs font-semibold"
                >
                  <Coffee className="w-3.5 h-3.5 mr-1.5" />
                  Start Break
                </Button>
                <Button
                  onClick={handleSkipBreak}
                  variant="ghost"
                  className={`w-full h-7 text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-400'}`}
                >
                  Skip
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