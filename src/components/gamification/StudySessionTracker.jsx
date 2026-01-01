import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Clock, Zap, Trophy, Target, Coffee, Sparkles, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import ConfettiEffect from "@/components/gamification/ConfettiEffect";

const MILESTONES = [
  { minutes: 5, xp: 10, message: "Great start! 🚀", icon: "🚀" },
  { minutes: 10, xp: 20, message: "You're on fire! 🔥", icon: "🔥" },
  { minutes: 15, xp: 30, message: "Halfway to mastery! 💪", icon: "💪" },
  { minutes: 20, xp: 50, message: "Study champion! 🏆", icon: "🏆" },
  { minutes: 30, xp: 75, message: "Incredible focus! ⭐", icon: "⭐" },
  { minutes: 45, xp: 100, message: "Study legend! 👑", icon: "👑" },
];

export default function StudySessionTracker({ 
  elapsedSeconds, 
  onMilestoneReached,
  minimized = false 
}) {
  const [reachedMilestones, setReachedMilestones] = useState([]);
  const [showCelebration, setShowCelebration] = useState(false);
  const [currentCelebration, setCurrentCelebration] = useState(null);
  const lastMilestoneRef = useRef(0);

  const elapsedMinutes = Math.floor(elapsedSeconds / 60);
  const nextMilestone = MILESTONES.find(m => !reachedMilestones.includes(m.minutes));
  const progress = nextMilestone 
    ? (elapsedMinutes / nextMilestone.minutes) * 100 
    : 100;

  useEffect(() => {
    const newMilestones = MILESTONES.filter(
      m => elapsedMinutes >= m.minutes && !reachedMilestones.includes(m.minutes)
    );

    if (newMilestones.length > 0) {
      const latestMilestone = newMilestones[newMilestones.length - 1];
      
      if (latestMilestone.minutes > lastMilestoneRef.current) {
        setReachedMilestones(prev => [...prev, ...newMilestones.map(m => m.minutes)]);
        setCurrentCelebration(latestMilestone);
        setShowCelebration(true);
        lastMilestoneRef.current = latestMilestone.minutes;
        
        onMilestoneReached?.(latestMilestone);
        
        setTimeout(() => {
          setShowCelebration(false);
          setCurrentCelebration(null);
        }, 3000);
      }
    }
  }, [elapsedMinutes]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (minimized) {
    return (
      <div className="flex items-center gap-2 bg-purple-50 rounded-lg px-3 py-1.5 border border-purple-200">
        <Clock className="w-3.5 h-3.5 text-purple-600" />
        <span className="text-sm font-mono font-semibold text-purple-700">
          {formatTime(elapsedSeconds)}
        </span>
        {nextMilestone && (
          <div className="flex items-center gap-1">
            <div className="w-12 h-1.5 bg-purple-200 rounded-full overflow-hidden">
              <div 
                className="h-full bg-purple-500 rounded-full transition-all"
                style={{ width: `${Math.min(progress, 100)}%` }}
              />
            </div>
            <span className="text-[10px] text-purple-600">{nextMilestone.icon}</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      <ConfettiEffect show={showCelebration} onComplete={() => {}} />
      
      {/* Celebration Modal */}
      <AnimatePresence>
        {showCelebration && currentCelebration && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm"
          >
            <motion.div
              initial={{ y: 50 }}
              animate={{ y: 0 }}
              className="bg-white rounded-3xl p-8 mx-4 max-w-sm text-center shadow-2xl"
            >
              <motion.div
                animate={{ scale: [1, 1.2, 1], rotate: [0, 10, -10, 0] }}
                transition={{ duration: 0.5 }}
                className="text-6xl mb-4"
              >
                {currentCelebration.icon}
              </motion.div>
              <h3 className="text-2xl font-bold text-slate-900 mb-2">
                {currentCelebration.minutes} Minutes!
              </h3>
              <p className="text-slate-600 mb-4">{currentCelebration.message}</p>
              <div className="bg-gradient-to-r from-yellow-400 to-amber-500 text-slate-900 rounded-xl px-6 py-3 inline-flex items-center gap-2">
                <Zap className="w-5 h-5" />
                <span className="font-bold text-lg">+{currentCelebration.xp} XP</span>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Tracker Card */}
      <div className="bg-white rounded-2xl p-4 shadow-lg border border-purple-100">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl flex items-center justify-center">
              <Clock className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Study Session</p>
              <p className="text-xl font-bold font-mono text-slate-900">{formatTime(elapsedSeconds)}</p>
            </div>
          </div>
          
          {/* Milestone badges */}
          <div className="flex gap-1">
            {MILESTONES.slice(0, 4).map(m => (
              <div
                key={m.minutes}
                className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm transition-all ${
                  reachedMilestones.includes(m.minutes)
                    ? 'bg-gradient-to-br from-yellow-400 to-amber-500 shadow-md'
                    : 'bg-slate-100 text-slate-400'
                }`}
              >
                {m.icon}
              </div>
            ))}
          </div>
        </div>

        {/* Progress to next milestone */}
        {nextMilestone && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500">Next: {nextMilestone.minutes}min</span>
              <span className="text-purple-600 font-medium">+{nextMilestone.xp} XP</span>
            </div>
            <div className="relative h-2 bg-slate-100 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(progress, 100)}%` }}
                transition={{ duration: 0.3 }}
                className="absolute h-full bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full"
              />
            </div>
          </div>
        )}

        {!nextMilestone && (
          <div className="bg-gradient-to-r from-yellow-50 to-amber-50 rounded-xl p-3 border border-yellow-200 text-center">
            <p className="text-sm font-medium text-amber-800">
              👑 All milestones reached! You're unstoppable!
            </p>
          </div>
        )}
      </div>
    </>
  );
}