import React from "react";
import { motion } from "framer-motion";
import { Flame, Zap, Shield, Trophy, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { getLevelProgress, getRank } from "@/lib/gamification";
import { useTheme } from "@/components/theme/ThemeProvider";

/**
 * Today's Quest — the retention strip.
 *
 * Sits between hero and courses. Four chips, scanable in <2 seconds:
 *   1. Streak status (with urgency state if no activity yet today)
 *   2. Streak freezes (loss-aversion safety net)
 *   3. Daily XP goal (adaptive target)
 *   4. Level + rank progress
 *
 * Designed after Duolingo's home strip:
 *  - Show what's at risk (streak) and what protects it (freezes)
 *  - Make the daily target small enough to feel doable (adaptive ladder handles this)
 *  - One-tap CTA that resolves "what do I do next?"
 */
export default function TodaysQuestStrip({ user, dailyXP, dailyGoalTarget, activeToday }) {
  const { isDark } = useTheme();
  const navigate = useNavigate();

  const streak = user?.current_streak || 0;
  const freezes = user?.streak_freezes || 0;
  const totalXP = user?.total_xp || user?.total_points || 0;
  const { level, percent, xpToNextLevel } = getLevelProgress(totalXP);
  const rank = getRank(level);

  const target = dailyGoalTarget || 30;
  const dailyPct = Math.min(100, (dailyXP / target) * 100);
  const goalReached = dailyXP >= target;

  // Streak urgency: user has a streak but hasn't done anything today yet.
  const streakAtRisk = streak > 0 && !activeToday && !goalReached;

  const cardBase = isDark
    ? "bg-[#12121a] border-white/10"
    : "bg-white border-slate-200";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`rounded-2xl border shadow-sm ${cardBase}`}
    >
      <div className="grid grid-cols-2 md:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-slate-200 dark:divide-white/10">
        {/* 1 — Streak */}
        <div className={`p-4 ${streakAtRisk ? (isDark ? 'bg-orange-500/5' : 'bg-orange-50/60') : ''}`}>
          <div className="flex items-center gap-2 mb-1">
            <Flame className={`w-4 h-4 ${streak > 0 ? 'text-orange-500 fill-orange-500' : (isDark ? 'text-slate-500' : 'text-slate-400')}`} />
            <span className={`text-[10px] font-bold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Streak
            </span>
          </div>
          <div className={`text-2xl font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>
            {streak} <span className={`text-xs font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{streak === 1 ? 'day' : 'days'}</span>
          </div>
          <p className={`text-[11px] mt-0.5 font-medium ${streakAtRisk ? 'text-orange-500' : (isDark ? 'text-slate-500' : 'text-slate-500')}`}>
            {streak === 0 ? 'Start one today' : streakAtRisk ? 'Keep it alive today!' : goalReached ? 'Locked in for today ✓' : 'Going strong'}
          </p>
        </div>

        {/* 2 — Freezes */}
        <div className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <Shield className={`w-4 h-4 ${freezes > 0 ? 'text-sky-500 fill-sky-500/30' : (isDark ? 'text-slate-500' : 'text-slate-400')}`} />
            <span className={`text-[10px] font-bold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Freezes
            </span>
          </div>
          <div className={`text-2xl font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>
            {freezes}<span className={`text-xs font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}> / 2</span>
          </div>
          <p className={`text-[11px] mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
            {freezes > 0 ? 'Protects your streak' : 'Earned every 7 days'}
          </p>
        </div>

        {/* 3 — Daily XP */}
        <div className={`p-4 ${goalReached ? (isDark ? 'bg-emerald-500/5' : 'bg-emerald-50/60') : ''}`}>
          <div className="flex items-center gap-2 mb-1">
            <Zap className={`w-4 h-4 ${goalReached ? 'text-emerald-500 fill-emerald-500' : 'text-yellow-500 fill-yellow-500'}`} />
            <span className={`text-[10px] font-bold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Today
            </span>
          </div>
          <div className={`text-2xl font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>
            {dailyXP}<span className={`text-xs font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}> / {target} XP</span>
          </div>
          <div className={`h-1.5 rounded-full overflow-hidden mt-1.5 ${isDark ? 'bg-white/10' : 'bg-slate-200'}`}>
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${dailyPct}%` }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
              className={`h-full ${goalReached ? 'bg-gradient-to-r from-emerald-400 to-teal-500' : 'bg-gradient-to-r from-yellow-400 to-amber-500'}`}
            />
          </div>
        </div>

        {/* 4 — Level + rank */}
        <button
          onClick={() => navigate(createPageUrl('CreateLesson'))}
          className={`p-4 text-left transition-colors ${isDark ? 'hover:bg-white/[0.03]' : 'hover:bg-slate-50'}`}
        >
          <div className="flex items-center gap-2 mb-1">
            <span className="text-base leading-none">{rank.emoji}</span>
            <span className={`text-[10px] font-bold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Level {level}
            </span>
          </div>
          <div className={`text-sm font-bold truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>
            {rank.title}
          </div>
          <div className={`h-1.5 rounded-full overflow-hidden mt-1.5 ${isDark ? 'bg-white/10' : 'bg-slate-200'}`}>
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${percent}%` }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
              className="h-full bg-gradient-to-r from-purple-500 via-indigo-500 to-pink-500"
            />
          </div>
          <p className={`text-[10px] mt-1 font-medium flex items-center gap-1 ${isDark ? 'text-purple-300' : 'text-purple-600'}`}>
            {xpToNextLevel.toLocaleString()} XP to next <ArrowRight className="w-2.5 h-2.5" />
          </p>
        </button>
      </div>
    </motion.div>
  );
}