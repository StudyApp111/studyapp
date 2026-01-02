import { base44 } from "@/api/base44Client";

// Get today's date in YYYY-MM-DD format (user's local timezone)
export const getTodayDateString = () => {
  return new Date().toISOString().split('T')[0];
};

// Check if two date strings are the same day
export const isSameDay = (dateStr1, dateStr2) => {
  if (!dateStr1 || !dateStr2) return false;
  return dateStr1.split('T')[0] === dateStr2.split('T')[0];
};

// Check if a date string is from yesterday
export const isYesterday = (dateStr) => {
  if (!dateStr) return false;
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return dateStr.split('T')[0] === yesterday.toISOString().split('T')[0];
};

/**
 * Handles daily reset logic for all gamification features
 * Returns updated user data and whether a reset occurred
 */
export const handleDailyReset = async () => {
  try {
    const user = await base44.auth.me();
    if (!user) return { user: null, resetOccurred: false };
    
    const today = getTodayDateString();
    const lastResetDate = user.last_daily_reset_date;
    
    // If already reset today, return current data
    if (lastResetDate === today) {
      return { 
        user, 
        resetOccurred: false,
        dailyXP: user.daily_xp || 0,
        streak: user.current_streak || 0,
        studyMinutesToday: user.study_minutes_today || 0,
        questionsToday: user.questions_today || 0,
        flashcardsToday: user.flashcards_today || 0
      };
    }
    
    // Calculate new streak
    let newStreak = user.current_streak || 0;
    const lastActiveDate = user.last_active_date?.split('T')[0];
    
    if (isYesterday(user.last_active_date)) {
      // User was active yesterday, maintain/increment streak
      // Streak is incremented when they complete an activity today
    } else if (lastActiveDate !== today) {
      // User missed a day (or more), reset streak
      newStreak = 0;
    }
    
    // Reset daily counters
    const updateData = {
      last_daily_reset_date: today,
      daily_xp: 0,
      study_minutes_today: 0,
      questions_today: 0,
      flashcardsToday: 0,
      daily_challenges_completed: []
    };
    
    // Only update streak if it changed
    if (newStreak !== user.current_streak) {
      updateData.current_streak = newStreak;
    }
    
    await base44.auth.updateMe(updateData);
    
    return {
      user: { ...user, ...updateData },
      resetOccurred: true,
      dailyXP: 0,
      streak: newStreak,
      studyMinutesToday: 0,
      questionsToday: 0,
      flashcardsToday: 0
    };
  } catch (error) {
    console.error('Error handling daily reset:', error);
    return { user: null, resetOccurred: false };
  }
};

/**
 * Update daily activity and potentially increment streak
 */
export const recordDailyActivity = async (activityType, amount = 1) => {
  try {
    const user = await base44.auth.me();
    if (!user) return;
    
    const today = getTodayDateString();
    const updateData = {
      last_active_date: new Date().toISOString()
    };
    
    // If this is first activity of the day, increment streak
    const lastActiveDate = user.last_active_date?.split('T')[0];
    if (lastActiveDate !== today) {
      if (isYesterday(user.last_active_date) || !user.last_active_date) {
        // Coming back from yesterday or first time - increment streak
        updateData.current_streak = (user.current_streak || 0) + 1;
        
        // Update longest streak if needed
        if (updateData.current_streak > (user.longest_streak || 0)) {
          updateData.longest_streak = updateData.current_streak;
        }
      }
    }
    
    // Update specific activity counter
    switch (activityType) {
      case 'study_minutes':
        updateData.study_minutes_today = (user.study_minutes_today || 0) + amount;
        break;
      case 'questions':
        updateData.questions_today = (user.questions_today || 0) + amount;
        break;
      case 'flashcards':
        updateData.flashcards_today = (user.flashcards_today || 0) + amount;
        break;
    }
    
    await base44.auth.updateMe(updateData);
    return updateData;
  } catch (error) {
    console.error('Error recording daily activity:', error);
  }
};

/**
 * Award XP and update daily XP counter
 */
export const awardDailyXP = async (amount, reason = '') => {
  try {
    const user = await base44.auth.me();
    if (!user) return { success: false };
    
    const newDailyXP = (user.daily_xp || 0) + amount;
    const newTotalXP = (user.total_points || 0) + amount;
    
    await base44.auth.updateMe({
      daily_xp: newDailyXP,
      total_points: newTotalXP
    });
    
    return { 
      success: true, 
      dailyXP: newDailyXP, 
      totalXP: newTotalXP 
    };
  } catch (error) {
    console.error('Error awarding XP:', error);
    return { success: false };
  }
};