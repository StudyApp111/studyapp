// Single source of truth for the gamification system.
// Pure functions — no I/O — so they're easy to unit test and call from anywhere.

// ─── LEVELS & RANKS ──────────────────────────────────────────────────────────
// Quadratic curve: level N requires 100 * N^2 total XP.
// L1 → 0, L2 → 100, L3 → 400, L4 → 900, L5 → 1600, L6 → 2500, L7 → 3600…
export const xpForLevel = (level) => 100 * Math.pow(Math.max(1, level) - 1, 2);

export const levelFromXP = (totalXP) => {
  if (!totalXP || totalXP < 100) return 1;
  return Math.floor(Math.sqrt(totalXP / 100)) + 1;
};

export const getLevelProgress = (totalXP) => {
  const level = levelFromXP(totalXP);
  const currentLevelXP = xpForLevel(level);
  const nextLevelXP = xpForLevel(level + 1);
  const into = totalXP - currentLevelXP;
  const span = nextLevelXP - currentLevelXP;
  return {
    level,
    currentLevelXP,
    nextLevelXP,
    xpIntoLevel: into,
    xpToNextLevel: span - into,
    percent: Math.min(100, (into / span) * 100),
  };
};

// Rank titles every few levels — keeps it aspirational without being noisy.
export const RANKS = [
  { minLevel: 1,  title: 'Novice Learner',   emoji: '🌱', color: 'from-slate-400 to-slate-500' },
  { minLevel: 3,  title: 'Curious Mind',     emoji: '🔍', color: 'from-sky-400 to-blue-500' },
  { minLevel: 5,  title: 'Adept Scholar',    emoji: '📚', color: 'from-blue-500 to-indigo-600' },
  { minLevel: 8,  title: 'Sharp Thinker',    emoji: '⚡', color: 'from-indigo-500 to-purple-600' },
  { minLevel: 12, title: 'Master Student',   emoji: '🎓', color: 'from-purple-500 to-pink-600' },
  { minLevel: 18, title: 'Knowledge Seeker', emoji: '🧠', color: 'from-pink-500 to-rose-600' },
  { minLevel: 25, title: 'Grand Sage',       emoji: '👑', color: 'from-amber-400 to-orange-600' },
];

export const getRank = (level) => {
  let rank = RANKS[0];
  for (const r of RANKS) {
    if (level >= r.minLevel) rank = r;
  }
  return rank;
};

// ─── DAILY XP GOAL (ADAPTIVE LADDER) ─────────────────────────────────────────
// Goal scales with streak so it never feels trivial for power users and never
// feels punishing for newcomers. Recomputed on the daily reset.
export const DAILY_XP_GOAL = 50; // legacy export — kept so existing imports compile

export const getAdaptiveDailyGoal = (currentStreak = 0) => {
  if (currentStreak >= 30) return 75;
  if (currentStreak >= 7) return 50;
  return 30;
};

// ─── STREAK FREEZES ──────────────────────────────────────────────────────────
export const STREAK_FREEZE_MAX = 2;
// Grant a freeze every N-day milestone (1 freeze per milestone, capped at MAX).
export const STREAK_FREEZE_GRANT_EVERY = 7;

// ─── BADGES ──────────────────────────────────────────────────────────────────
// Each badge has an id (stable), label, description, emoji, and a check(user, ctx) fn.
// ctx carries optional event-specific data so we can detect streak-7, exam-100, etc.
export const BADGES = [
  // Streak badges
  { id: 'streak_3',  label: 'On Fire',          emoji: '🔥', description: '3-day study streak',  check: (u) => (u.current_streak || 0) >= 3 },
  { id: 'streak_7',  label: 'Week Warrior',     emoji: '🔥', description: '7-day study streak',  check: (u) => (u.current_streak || 0) >= 7 },
  { id: 'streak_30', label: 'Unstoppable',      emoji: '⚡', description: '30-day study streak', check: (u) => (u.current_streak || 0) >= 30 },
  { id: 'streak_100',label: 'Legendary',        emoji: '🏆', description: '100-day study streak',check: (u) => (u.current_streak || 0) >= 100 },

  // XP / level badges
  { id: 'xp_500',   label: 'Quick Study',       emoji: '⚡', description: '500 lifetime XP',  check: (u) => (u.total_xp || 0) >= 500 },
  { id: 'xp_5000',  label: 'XP Hoarder',        emoji: '💎', description: '5,000 lifetime XP',check: (u) => (u.total_xp || 0) >= 5000 },
  { id: 'level_5',  label: 'Adept Scholar',     emoji: '📚', description: 'Reached Level 5',  check: (u) => levelFromXP(u.total_xp || 0) >= 5 },
  { id: 'level_10', label: 'Sharp Mind',        emoji: '🧠', description: 'Reached Level 10', check: (u) => levelFromXP(u.total_xp || 0) >= 10 },

  // Activity badges (ctx-driven)
  { id: 'first_flashcard', label: 'Card Carrier',    emoji: '🃏', description: 'Reviewed your first flashcard',  check: (_, ctx) => ctx?.event === 'flashcard_reviewed' },
  { id: 'first_teachit',   label: 'The Professor',   emoji: '🎙️', description: 'Completed your first Feynman card',check: (_, ctx) => ctx?.event === 'teachit_completed' },
  { id: 'first_diagnostic',label: 'Self-Aware',      emoji: '🎯', description: 'Took your first diagnostic',      check: (_, ctx) => ctx?.event === 'diagnostic_completed' },
  { id: 'perfect_quiz',    label: 'Flawless',        emoji: '💯', description: 'Scored 100% on a practice quiz',  check: (_, ctx) => ctx?.event === 'quiz_completed' && ctx?.score === 100 },
  { id: 'plan_complete',   label: 'Plan Crusher',    emoji: '✅', description: 'Completed an entire study plan',  check: (_, ctx) => ctx?.event === 'study_plan_completed' },
  { id: 'grade_a',         label: 'A+ Student',      emoji: '🌟', description: 'Predicted grade of A or A+',      check: (_, ctx) => ctx?.event === 'grade_updated' && ['A','A+'].includes(ctx?.grade) },
];

// Compute newly-unlocked badges given the user state + optional event context.
// Returns the list of badge objects that should be unlocked now.
export const computeNewBadges = (user, ctx = {}) => {
  if (!user) return [];
  const already = new Set(user.badges_earned || []);
  return BADGES.filter(b => !already.has(b.id) && b.check(user, ctx));
};

// ─── XP RULES ────────────────────────────────────────────────────────────────
// Centralized so we can tune in one place.
export const XP_REWARDS = {
  flashcard_good:        5,
  flashcard_excellent:  10,
  teachit_pass:         15,   // score >= 75
  teachit_excellent:    25,   // score >= 90
  quiz_correct:          8,
  quiz_perfect_bonus:   30,   // bonus on top, when score==100
  diagnostic_complete:  40,
  study_plan_task:      20,
  daily_goal_bonus:     25,
  streak_milestone:     50,   // every 7-day milestone
};