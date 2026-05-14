// Gamification state machine: daily reset, streaks, freezes, XP awards.
// Single source of truth. All UI surfaces should call these helpers — never
// poke daily_xp / current_streak / badges_earned directly.
//
// Design principles:
//  • Local-timezone date keys (not UTC) — a "day" is the user's calendar day.
//  • Idempotent XP awards — every awardDailyXP call accepts a dedupKey.
//  • Level + total_points always reconciled from total_xp.
//  • Streak freezes auto-consumed: missing a day costs a freeze before the streak resets.

import { base44 } from "@/api/base44Client";
import {
  levelFromXP,
  computeNewBadges,
  getAdaptiveDailyGoal,
  STREAK_FREEZE_MAX,
  STREAK_FREEZE_GRANT_EVERY,
} from "@/lib/gamification";

// ─── LOCAL-DATE HELPERS (TIMEZONE-CORRECT) ──────────────────────────────────
// toISOString() returns UTC, which silently breaks "today" / "yesterday" for
// users west of UTC. These helpers operate in the user's local calendar.

const pad = (n) => String(n).padStart(2, "0");

export const getTodayDateString = (d = new Date()) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const localDateOf = (input) => {
  if (!input) return null;
  // Accept either "YYYY-MM-DD" or an ISO timestamp. Always reduce to local Y-M-D.
  if (typeof input === "string" && /^\d{4}-\d{2}-\d{2}$/.test(input)) return input;
  const d = new Date(input);
  if (isNaN(d.getTime())) return null;
  return getTodayDateString(d);
};

export const isSameDay = (a, b) => {
  const da = localDateOf(a);
  const db = localDateOf(b);
  return !!da && da === db;
};

export const isYesterday = (input) => {
  const target = localDateOf(input);
  if (!target) return false;
  const y = new Date();
  y.setDate(y.getDate() - 1);
  return target === getTodayDateString(y);
};

// Whole-day delta between two date strings (positive = past). Null if invalid.
const daysBetween = (fromStr, toStr) => {
  if (!fromStr || !toStr) return null;
  const from = new Date(`${fromStr}T00:00:00`);
  const to = new Date(`${toStr}T00:00:00`);
  if (isNaN(from.getTime()) || isNaN(to.getTime())) return null;
  return Math.round((to - from) / 86400000);
};

// ─── DAILY RESET ────────────────────────────────────────────────────────────
// Called on Home mount + at session start. Idempotent within a day.
// On a new day: zero daily counters, apply streak freeze logic, set adaptive goal.
export const handleDailyReset = async () => {
  try {
    const isAuth = await base44.auth.isAuthenticated();
    if (!isAuth) return { user: null, resetOccurred: false, error: "Not authenticated" };

    const user = await base44.auth.me();
    if (!user) return { user: null, resetOccurred: false };

    const today = getTodayDateString();
    const lastReset = user.last_daily_reset_date;

    // Already reset today — return current snapshot.
    if (lastReset === today) {
      return {
        user,
        resetOccurred: false,
        dailyXP: user.daily_xp || 0,
        streak: user.current_streak || 0,
        streakFreezes: user.streak_freezes || 0,
        dailyGoalTarget: user.daily_goal_target || getAdaptiveDailyGoal(user.current_streak || 0),
        studyMinutesToday: user.study_minutes_today || 0,
        questionsToday: user.questions_today || 0,
        flashcardsToday: user.flashcards_today || 0,
      };
    }

    // ── Streak resolution ──
    // Look at the last day the user was actually active (last_active_date).
    // Gap of 1 day → streak preserved as-is (today's activity will increment it).
    // Gap of 2+ days → consume 1 freeze per missed day (capped at freezes available).
    //   If freezes cover the gap, streak preserved. Otherwise streak resets to 0.
    const lastActive = localDateOf(user.last_active_date);
    const currentStreak = user.current_streak || 0;
    let nextStreak = currentStreak;
    let nextFreezes = user.streak_freezes || 0;

    if (lastActive) {
      const gap = daysBetween(lastActive, today); // 0=today, 1=yesterday, 2+=missed
      if (gap !== null && gap >= 2) {
        const missedDays = gap - 1; // days we need freezes for
        if (nextFreezes >= missedDays) {
          nextFreezes -= missedDays;
          // streak preserved
        } else {
          nextStreak = 0;
          nextFreezes = 0;
        }
      }
    }

    const adaptiveGoal = getAdaptiveDailyGoal(nextStreak);

    const updateData = {
      last_daily_reset_date: today,
      daily_xp: 0,
      study_minutes_today: 0,
      questions_today: 0,
      flashcards_today: 0,
      daily_challenges_completed: [],
      study_sessions_today: 0,
      daily_goal_target: adaptiveGoal,
    };
    if (nextStreak !== currentStreak) updateData.current_streak = nextStreak;
    if (nextFreezes !== (user.streak_freezes || 0)) updateData.streak_freezes = nextFreezes;

    await base44.auth.updateMe(updateData);

    return {
      user: { ...user, ...updateData },
      resetOccurred: true,
      dailyXP: 0,
      streak: nextStreak,
      streakFreezes: nextFreezes,
      dailyGoalTarget: adaptiveGoal,
      studyMinutesToday: 0,
      questionsToday: 0,
      flashcardsToday: 0,
    };
  } catch (error) {
    console.error("Error handling daily reset:", error);
    return { user: null, resetOccurred: false };
  }
};

// ─── RECORD ACTIVITY (counters + streak increment + freeze grant) ──────────
// Called by feature surfaces (flashcards, exams, etc.) to bump counters and
// keep the streak alive. First activity of a new local day increments streak.
// Crossing a freeze milestone grants 1 freeze (capped at STREAK_FREEZE_MAX).
export const recordDailyActivity = async (activityType, amount = 1) => {
  try {
    const isAuth = await base44.auth.isAuthenticated();
    if (!isAuth) return;

    const user = await base44.auth.me();
    if (!user) return;

    const today = getTodayDateString();
    const lastActive = localDateOf(user.last_active_date);

    const updateData = {
      last_active_date: new Date().toISOString(),
    };

    // First activity of the day → advance streak & maybe grant a freeze.
    if (lastActive !== today) {
      const previousStreak = user.current_streak || 0;
      const newStreak = previousStreak + 1;
      updateData.current_streak = newStreak;

      if (newStreak > (user.longest_streak || 0)) {
        updateData.longest_streak = newStreak;
      }

      // Freeze grant: every STREAK_FREEZE_GRANT_EVERY days, +1 freeze (capped).
      if (newStreak % STREAK_FREEZE_GRANT_EVERY === 0) {
        const currentFreezes = user.streak_freezes || 0;
        if (currentFreezes < STREAK_FREEZE_MAX) {
          updateData.streak_freezes = currentFreezes + 1;
          if (typeof window !== "undefined") {
            window.dispatchEvent(new CustomEvent("streakFreezeGranted", {
              detail: { freezes: updateData.streak_freezes, streak: newStreak },
            }));
          }
        }
      }
    }

    switch (activityType) {
      case "study_minutes":
        updateData.study_minutes_today = (user.study_minutes_today || 0) + amount;
        break;
      case "questions":
        updateData.questions_today = (user.questions_today || 0) + amount;
        break;
      case "flashcards":
        updateData.flashcards_today = (user.flashcards_today || 0) + amount;
        break;
      case "session":
        updateData.study_sessions_today = (user.study_sessions_today || 0) + amount;
        break;
    }

    await base44.auth.updateMe(updateData);
    return updateData;
  } catch (error) {
    console.error("Error recording daily activity:", error);
  }
};

// ─── AWARD XP (idempotent, reconciled level, badge checks) ──────────────────
// Every award accepts an optional dedupKey. If the user has already received
// XP under that key, this is a no-op. Use stable keys per event:
//   flashcard:{cardId}:{reviewCount}, quiz:{examId}:{questionIdx},
//   daily_challenge:{challengeId}:{YYYY-MM-DD}, plan_task:{taskId}, etc.
const XP_EVENT_HISTORY_LIMIT = 50;

export const awardDailyXP = async (amount, reason = "", ctx = {}) => {
  try {
    const isAuth = await base44.auth.isAuthenticated();
    if (!isAuth) return { success: false };

    const user = await base44.auth.me();
    if (!user) return { success: false };

    // Idempotency check. If dedupKey already in history, bail without writing.
    const dedupKey = ctx?.dedupKey;
    const history = Array.isArray(user.xp_event_keys) ? user.xp_event_keys : [];
    if (dedupKey && history.includes(dedupKey)) {
      return {
        success: true,
        deduped: true,
        dailyXP: user.daily_xp || 0,
        totalXP: user.total_xp || user.total_points || 0,
        level: user.level || levelFromXP(user.total_xp || 0),
      };
    }

    const newDailyXP = (user.daily_xp || 0) + amount;
    const oldTotalXP = user.total_xp || user.total_points || 0;
    const newTotalXP = oldTotalXP + amount;
    const oldLevel = levelFromXP(oldTotalXP);
    const newLevel = levelFromXP(newTotalXP);
    const leveledUp = newLevel > oldLevel;

    // Project the post-update user for badge checks (must include freshly-earned XP).
    const projectedUser = {
      ...user,
      total_xp: newTotalXP,
      daily_xp: newDailyXP,
      level: newLevel,
    };
    const newBadges = computeNewBadges(projectedUser, ctx);
    const allBadgeIds = [
      ...(user.badges_earned || []),
      ...newBadges.map((b) => b.id),
    ];

    // Rolling dedup window — keep last N keys.
    const nextHistory = dedupKey
      ? [...history, dedupKey].slice(-XP_EVENT_HISTORY_LIMIT)
      : history;

    const updatePayload = {
      daily_xp: newDailyXP,
      total_xp: newTotalXP,
      total_points: newTotalXP, // keep legacy field in sync
      level: newLevel,
    };
    if (newBadges.length > 0) updatePayload.badges_earned = allBadgeIds;
    if (dedupKey) updatePayload.xp_event_keys = nextHistory;

    await base44.auth.updateMe(updatePayload);

    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("xpAwarded", {
        detail: { amount, reason, totalXP: newTotalXP, dailyXP: newDailyXP, level: newLevel },
      }));
      if (leveledUp) {
        window.dispatchEvent(new CustomEvent("levelUp", { detail: { level: newLevel } }));
      }
      newBadges.forEach((badge) => {
        window.dispatchEvent(new CustomEvent("badgeUnlocked", { detail: { badge } }));
      });
    }

    return {
      success: true,
      dailyXP: newDailyXP,
      totalXP: newTotalXP,
      level: newLevel,
      leveledUp,
      newBadges,
    };
  } catch (error) {
    console.error("Error awarding XP:", error);
    return { success: false };
  }
};

// ─── BADGE CHECK ONLY (no XP) ──────────────────────────────────────────────
export const checkBadges = async (ctx = {}) => {
  try {
    const isAuth = await base44.auth.isAuthenticated();
    if (!isAuth) return [];
    const user = await base44.auth.me();
    if (!user) return [];

    const newBadges = computeNewBadges(user, ctx);
    if (newBadges.length === 0) return [];

    const allBadgeIds = [...(user.badges_earned || []), ...newBadges.map((b) => b.id)];
    await base44.auth.updateMe({ badges_earned: allBadgeIds });

    if (typeof window !== "undefined") {
      newBadges.forEach((badge) => {
        window.dispatchEvent(new CustomEvent("badgeUnlocked", { detail: { badge } }));
      });
    }
    return newBadges;
  } catch (error) {
    console.error("Error checking badges:", error);
    return [];
  }
};