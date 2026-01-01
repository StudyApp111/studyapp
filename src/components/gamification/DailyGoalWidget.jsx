import React from "react";
import { motion } from "framer-motion";
import { Zap, Flame, Trophy, Star, Target } from "lucide-react";
import MiniProgressRing from "./MiniProgressRing";

export default function DailyGoalWidget({ dailyXP = 0, streak = 0, level = 1 }) {
  const dailyGoal = 50;
  const progress = Math.min((dailyXP / dailyGoal) * 100, 100);
  const isGoalMet = dailyXP >= dailyGoal;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-2xl p-4 shadow-lg border border-purple-100"
    >
      <div className="flex items-center gap-4">
        {/* Progress Ring */}
        <MiniProgressRing 
          progress={progress} 
          size={56} 
          strokeWidth={5}
          color={isGoalMet ? "#10b981" : "#8b5cf6"}
        >
          {isGoalMet ? (
            <Star className="w-5 h-5 text-emerald-500" />
          ) : (
            <Zap className="w-5 h-5 text-purple-500" />
          )}
        </MiniProgressRing>

        {/* Info */}
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-bold text-slate-900">
              {isGoalMet ? "Goal Complete! 🎉" : "Daily Goal"}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-lg font-bold text-purple-600">{dailyXP}</span>
            <span className="text-sm text-slate-500">/ {dailyGoal} XP</span>
          </div>
        </div>

        {/* Stats */}
        <div className="flex flex-col gap-1.5">
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg ${streak > 0 ? 'bg-orange-50' : 'bg-slate-50'}`}>
            <Flame className={`w-3.5 h-3.5 ${streak > 0 ? 'text-orange-500' : 'text-slate-400'}`} />
            <span className={`text-xs font-bold ${streak > 0 ? 'text-orange-700' : 'text-slate-500'}`}>{streak}</span>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-yellow-50">
            <Trophy className="w-3.5 h-3.5 text-yellow-500" />
            <span className="text-xs font-bold text-yellow-700">Lv{level}</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}