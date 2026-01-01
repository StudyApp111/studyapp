import React from "react";
import { motion } from "framer-motion";
import { Flame, Zap, Trophy, Star } from "lucide-react";

export default function XPProgressBar({ dailyXP = 0, dailyGoal = 50, streak = 0, level = 1, totalXP = 0, compact = false }) {
  const progress = Math.min((dailyXP / dailyGoal) * 100, 100);
  const goalReached = dailyXP >= dailyGoal;
  
  // Calculate XP to next level (100 XP per level)
  const xpForCurrentLevel = (level - 1) * 100;
  const xpForNextLevel = level * 100;
  const levelProgress = ((totalXP - xpForCurrentLevel) / (xpForNextLevel - xpForCurrentLevel)) * 100;

  if (compact) {
    return (
      <div className="flex items-center gap-3">
        {/* Streak */}
        <div className="flex items-center gap-1 bg-orange-100 px-2 py-1 rounded-lg">
          <Flame className={`w-4 h-4 ${streak > 0 ? 'text-orange-500' : 'text-slate-400'}`} />
          <span className="text-xs font-bold text-orange-700">{streak}</span>
        </div>
        
        {/* Daily XP */}
        <div className="flex items-center gap-1.5">
          <Zap className="w-4 h-4 text-yellow-500" />
          <div className="w-16 h-2 bg-slate-200 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              className={`h-full rounded-full ${goalReached ? 'bg-green-500' : 'bg-yellow-500'}`}
            />
          </div>
          <span className="text-[10px] font-medium text-slate-600">{dailyXP}/{dailyGoal}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl p-4 shadow-lg border border-purple-100">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl flex items-center justify-center">
            <span className="text-white font-bold text-sm">Lv{level}</span>
          </div>
          <div>
            <p className="text-xs text-slate-500">Total XP</p>
            <p className="text-lg font-bold text-slate-900">{totalXP.toLocaleString()}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Streak */}
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl ${streak > 0 ? 'bg-gradient-to-r from-orange-100 to-red-100' : 'bg-slate-100'}`}>
            <Flame className={`w-5 h-5 ${streak > 0 ? 'text-orange-500' : 'text-slate-400'}`} />
            <span className={`font-bold ${streak > 0 ? 'text-orange-700' : 'text-slate-500'}`}>{streak} day{streak !== 1 ? 's' : ''}</span>
          </div>
        </div>
      </div>

      {/* Daily Goal Progress */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Zap className="w-4 h-4 text-yellow-500" />
            <span className="text-sm font-medium text-slate-700">Daily Goal</span>
          </div>
          <span className={`text-sm font-bold ${goalReached ? 'text-green-600' : 'text-slate-600'}`}>
            {dailyXP} / {dailyGoal} XP
          </span>
        </div>
        
        <div className="relative h-3 bg-slate-100 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className={`absolute h-full rounded-full ${goalReached 
              ? 'bg-gradient-to-r from-green-400 to-emerald-500' 
              : 'bg-gradient-to-r from-yellow-400 to-amber-500'
            }`}
          />
          {goalReached && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="absolute right-1 top-1/2 -translate-y-1/2"
            >
              <Star className="w-4 h-4 text-white fill-white" />
            </motion.div>
          )}
        </div>
        
        {goalReached && (
          <motion.p
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-xs text-green-600 font-medium text-center"
          >
            🎉 Daily goal reached! Keep going for bonus XP!
          </motion.p>
        )}
      </div>
    </div>
  );
}