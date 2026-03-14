import React, { createContext, useContext, useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

const SubscriptionContext = createContext(null);

// Free tier limits — lifetime caps for free users
export const FREE_TIER_LIMITS = {
  lessons_total: 1,           // 1 lesson ever
  flashcard_sets_total: 1,    // 1 flashcard generation per lesson
  teachit_sets_total: 1,      // 1 teach-it generation per lesson
  practice_quizzes_total: 1,  // 1 practice quiz per lesson
  polly_messages_total: 10,   // 10 Polly chat messages ever
  diagnostic_exams_per_day: 3,  // diagnostics stay generous
  ai_messages_per_day: 10,    // kept for backward compat (not used for paywall)
  assignments_total: 1        // 1 assignment graded ever
};

export function SubscriptionProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [upgradeReason, setUpgradeReason] = useState('');
  const [upgradeCallback, setUpgradeCallback] = useState(null);

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const isAuthenticated = await base44.auth.isAuthenticated();
      if (!isAuthenticated) {
        // Not logged in — don't set user, just stop loading
        setLoading(false);
        return;
      }
      const currentUser = await base44.auth.me();
      setUser(currentUser);
    } catch (error) {
      console.error('Error loading user:', error);
    } finally {
      setLoading(false);
    }
  };

  const refreshUser = async () => {
    const currentUser = await base44.auth.me();
    setUser(currentUser);
    return currentUser;
  };

  // Helper to read user fields from either top-level or nested data object
  const getUserField = (field) => {
    if (!user) return undefined;
    return user[field] !== undefined ? user[field] : user.data?.[field];
  };

  // Check if user is on native iOS/Android app
  const isNativeApp = () => {
    if (typeof window === 'undefined') return false;
    const ua = navigator.userAgent || navigator.vendor || window.opera;
    
    // Check for common app wrappers
    if (window.ReactNativeWebView || window.Capacitor || window.cordova || window.PhoneGap || window.Android) {
      return true;
    }

    // iOS WebView (not Safari, Chrome, Firefox, Edge, etc.)
    const isIOS = /(iPhone|iPod|iPad)/i.test(ua);
    const isWebKit = /AppleWebKit/i.test(ua);
    const isSafari = /Safari/i.test(ua);
    const isOtherBrowser = /(CriOS|FxiOS|EdgiOS|OPiOS|mercury)/i.test(ua);
    const isIOSWebView = isIOS && isWebKit && !isSafari && !isOtherBrowser;

    // Android WebView
    const isAndroidWebView = /wv\)/i.test(ua);

    return isIOSWebView || isAndroidWebView;
  };

  // Check if user has pro subscription OR is in trial period
  const isPro = () => {
    if (isNativeApp()) return true; // Bypass paywalls for native app users
    if (!user) return false;
    
    const now = new Date();
    const tier = getUserField('subscription_tier');
    const status = getUserField('subscription_status');
    const endDate = getUserField('subscription_end_date');
    const trialEnd = getUserField('trial_end_date');
    const promoUntil = getUserField('promo_access_until');
    
    // Cancelled users immediately lose access (no grace period for trials)
    if (status === 'cancelled') {
      if (endDate) {
        const end = new Date(endDate);
        if (end > now && tier === 'pro') {
          return true; // Still in paid grace period
        }
      }
      return false;
    }
    
    // Check for active trial first
    if (status === 'trialing' && trialEnd) {
      if (new Date(trialEnd) > now) {
        return true;
      }
    }
    
    // Must have pro tier AND active status
    if (tier !== 'pro') return false;
    if (status !== 'active') return false;
    
    // Check promo access expiry first
    if (promoUntil) {
      if (new Date(promoUntil) < now) {
        return false;
      }
      return true;
    }
    
    // Check subscription end date for paid subscriptions
    if (endDate) {
      if (new Date(endDate) < now) {
        return false;
      }
    }
    
    return true;
  };
  
  // Check if user is in trial
  const isInTrial = () => {
    if (!user) return false;
    if (getUserField('subscription_status') !== 'trialing') return false;
    const trialEnd = getUserField('trial_end_date');
    if (!trialEnd) return false;
    return new Date(trialEnd) > new Date();
  };
  
  // Get trial remaining days
  const getTrialRemainingDays = () => {
    const trialEnd = getUserField('trial_end_date');
    if (!trialEnd) return null;
    if (getUserField('subscription_status') !== 'trialing') return null;
    
    const diffTime = new Date(trialEnd) - new Date();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
  };

  // Get remaining promo days
  const getPromoRemainingDays = () => {
    const promoUntil = getUserField('promo_access_until');
    if (!promoUntil) return null;
    const diffTime = new Date(promoUntil) - new Date();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
  };

  // Check and reset counters - 24h rolling window
  const checkAndResetCounters = async () => {
    let currentUser;
    try {
      currentUser = await base44.auth.me();
      setUser(currentUser);
    } catch {
      return null;
    }
    if (!currentUser) return null;
    
    const now = new Date();
    let updates = {};
    let needsUpdate = false;

    // Daily counter reset - 24h rolling window
    const resetTs = currentUser.daily_reset_timestamp || currentUser.data?.daily_reset_timestamp;
    const dailyResetTime = resetTs ? new Date(resetTs) : null;
    
    if (!dailyResetTime) {
      updates.daily_reset_timestamp = now.toISOString();
      updates.daily_ai_messages_count = 0;
      updates.daily_lessons_count = 0;
      updates.daily_diagnostic_exams_count = 0;
      needsUpdate = true;
    } else if ((now.getTime() - dailyResetTime.getTime()) >= 24 * 60 * 60 * 1000) {
      updates.daily_ai_messages_count = 0;
      updates.daily_lessons_count = 0;
      updates.daily_diagnostic_exams_count = 0;
      updates.daily_reset_timestamp = now.toISOString();
      needsUpdate = true;
    }

    if (needsUpdate) {
      await base44.auth.updateMe(updates);
      return await refreshUser();
    }
    return currentUser;
  };

  // Upload/Create Lesson - 1 ever for free, unlimited for pro
  const canUpload = async () => {
    if (isPro()) return { allowed: true };
    const currentUser = await checkAndResetCounters();
    if (!currentUser) return { allowed: true }; // Fail open: don't block if we can't load user
    
    const totalLessons = currentUser.total_lessons_created || currentUser.daily_lessons_count || 0;
    const allowed = totalLessons < FREE_TIER_LIMITS.lessons_total;
    
    return {
      allowed,
      current: totalLessons,
      limit: FREE_TIER_LIMITS.lessons_total,
      remaining: Math.max(0, FREE_TIER_LIMITS.lessons_total - totalLessons)
    };
  };

  // Tasks - unlimited for first lesson
  const canDoTask = async (taskType = null) => {
    return { allowed: true };
  };
  
  // Diagnostic Exams - unlimited for first lesson
  const canTakeDiagnostic = async () => {
    return { allowed: true };
  };

  // Polly chat: unlimited for first lesson
  const canSendAIMessage = async () => {
    return { allowed: true };
  };

  const canGradeAssignment = async () => {
    if (isPro()) return { allowed: true };
    const currentUser = await checkAndResetCounters();
    if (!currentUser) return { allowed: true };
    
    const count = currentUser.total_assignments_graded || 0;
    const limit = FREE_TIER_LIMITS.assignments_total;
    return { allowed: count < limit, current: count, limit, requiresPro: count >= limit };
  };

  // Increment counters
  const incrementUploadCount = async () => {
    // Track usage for all users (including native apps) so limits enforce on web
    const freshUser = await checkAndResetCounters();
    if (!freshUser) return;
    const newCount = (freshUser.total_lessons_created || freshUser.daily_lessons_count || 0) + 1;
    await base44.auth.updateMe({ total_lessons_created: newCount, daily_lessons_count: newCount });
    await refreshUser();
  };
  
  const incrementDiagnosticCount = async () => {
    const freshUser = await checkAndResetCounters();
    if (!freshUser) return;
    const newCount = (freshUser.daily_diagnostic_exams_count || 0) + 1;
    await base44.auth.updateMe({ daily_diagnostic_exams_count: newCount });
    await refreshUser();
  };

  const incrementTaskCount = async (taskType = null) => {
    const freshUser = await checkAndResetCounters();
    if (!freshUser) return;
    const updates = { total_tasks_used: (freshUser.total_tasks_used || 0) + 1 };
    if (taskType) {
      const fieldMap = {
        flashcards: 'total_flashcard_sets',
        teach_it: 'total_teachit_sets',
        practice_exam: 'total_practice_quizzes',
        review_notes: 'total_note_generations'
      };
      const field = fieldMap[taskType];
      if (field) updates[field] = (freshUser[field] || 0) + 1;
    }
    await base44.auth.updateMe(updates);
    await refreshUser();
  };
  
  const incrementAIMessageCount = async () => {
    const freshUser = await checkAndResetCounters();
    if (!freshUser) return;
    const newCount = (freshUser.total_polly_messages || freshUser.daily_ai_messages_count || 0) + 1;
    await base44.auth.updateMe({ total_polly_messages: newCount, daily_ai_messages_count: newCount });
    await refreshUser();
  };

  const incrementAssignmentCount = async () => {
    const freshUser = await checkAndResetCounters();
    if (!freshUser) return;
    const newCount = (freshUser.total_assignments_graded || 0) + 1;
    await base44.auth.updateMe({ total_assignments_graded: newCount });
    await refreshUser();
  };

  // Trigger upgrade modal with optional callback
  const triggerUpgradeModal = (reason, options = {}) => {
    setUpgradeReason(reason);
    setShowUpgradeModal(true);
    if (options.onSuccess) {
      setUpgradeCallback(() => options.onSuccess);
    }
  };

  const value = {
    user,
    loading,
    isPro,
    isInTrial,
    getTrialRemainingDays,
    refreshUser,
    canUpload,
    canDoTask,
    canTakeDiagnostic,
    canSendAIMessage,
    canGradeAssignment,
    incrementUploadCount,
    incrementDiagnosticCount,
    incrementTaskCount,
    incrementAIMessageCount,
    incrementAssignmentCount,
    triggerUpgradeModal,
    showUpgradeModal,
    setShowUpgradeModal,
    upgradeReason,
    upgradeCallback,
    setUpgradeCallback,
    FREE_TIER_LIMITS,
    getPromoRemainingDays
  };

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription() {
  const context = useContext(SubscriptionContext);
  if (!context) {
    throw new Error('useSubscription must be used within a SubscriptionProvider');
  }
  return context;
}