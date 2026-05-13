import React from "react";
import { motion } from "framer-motion";
import { Flame, Zap, Trophy } from "lucide-react";
import { getLevelProgress, getRank, DAILY_XP_GOAL } from "@/lib/gamification";
import { useTheme } from "@/components/theme/ThemeProvider";

/**
 * Compact gamification strip: Level + Rank, XP-to-next-level bar, streak flame, daily goal progress.
 * Designed to slot above lesson lists / inside the Home hero.
 */
export default function GamificationHeader({ user, dailyXP = 0, onBadgesClick }) {
  const { isDark } = useTheme();
  const totalXP = user?.total_xp || 0;
  const streak = user?.current_streak || 0;
  const badgeCount = (user?.badges_earned || []).length;

  const { level, percent, xpToNextLevel } = getLevelProgress(totalXP);
  const rank = getRank(level);
  const dailyPct = Math.min(100, (dailyXP / DAILY_XP_GOAL) * 100);
  const goalReached = dailyXP >= DAILY_XP_GOAL;

  return (
    <div className={`rounded-2xl border p-3 md:p-4 ${isDark ? 'bg-white/5 border-white/10' : 'bg-white/90 border-purple-200'} backdrop-blur-sm shadow-sm`}>
      {/* Top row: rank + streak + badges */}
      <div className="flex items-center justify-between gap-2 mb-2.5">
        <div className="flex items-center gap-2 min-w-0">
          <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${rank.color} flex items-center justify-center shadow-md flex-shrink-0 text-base`}>
            {rank.emoji}
          </div>
          <div className="min-w-0">
            <div className={`text-[10px] font-bold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Level {level} · {rank.title}
            </div>
            <div className={`text-xs font-medium truncate ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
              {xpToNextLevel.toLocaleString()} XP to next level
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          {badgeCount > 0 && (
            <button
              onClick={onBadgesClick}
              className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold ${isDark ? 'bg-amber-500/15 text-amber-300 hover:bg-amber-500/25' : 'bg-amber-100 text-amber-700 hover:bg-amber-200'} transition-colors`}
            >
              <Trophy className="w-3 h-3" />
              {badgeCount}
            </button>
          )}
          <div className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold ${streak > 0 ? (isDark ? 'bg-orange-500/15 text-orange-300' : 'bg-orange-100 text-orange-700') : (isDark ? 'bg-white/5 text-slate-400' : 'bg-slate-100 text-slate-500')}`}>
            <Flame className={`w-3 h-3 ${streak > 0 ? 'fill-current' : ''}`} />
            {streak}
          </div>
        </div>
      </div>

      {/* Level progress bar */}
      <div className={`h-1.5 rounded-full overflow-hidden mb-2.5 ${isDark ? 'bg-white/10' : 'bg-slate-200'}`}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${percent}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="h-full bg-gradient-to-r from-purple-500 via-indigo-500 to-pink-500"
        />
      </div>

      {/* Daily goal */}
      <div className="flex items-center gap-2">
        <Zap className={`w-3.5 h-3.5 flex-shrink-0 ${goalReached ? 'text-emerald-500 fill-emerald-500' : 'text-yellow-500 fill-yellow-500'}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-0.5">
            <span className={`text-[10px] font-bold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              {goalReached ? 'Daily goal complete!' : 'Daily goal'}
            </span>
            <span className={`text-[11px] font-bold ${goalReached ? 'text-emerald-500' : (isDark ? 'text-yellow-300' : 'text-yellow-600')}`}>
              {dailyXP} / {DAILY_XP_GOAL} XP
            </span>
          </div>
          <div className={`h-1 rounded-full overflow-hidden ${isDark ? 'bg-white/10' : 'bg-slate-200'}`}>
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${dailyPct}%` }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              className={`h-full ${goalReached ? 'bg-gradient-to-r from-emerald-400 to-teal-500' : 'bg-gradient-to-r from-yellow-400 to-amber-500'}`}
            />
          </div>
        </div>
      </div>
    </div>
  );
}