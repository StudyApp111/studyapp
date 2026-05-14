import React, { createContext, useContext, useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

const SubscriptionContext = createContext(null);

// =============================================================================
// FREE TIER — Per-feature DAILY caps (Duolingo-style). Resets every 24h.
// =============================================================================
// Single source of truth. If you want to tune limits, edit this object.
export const FREE_DAILY_LIMITS = {
  lessons: 1,          // 1 new lesson per day
  flashcards: 1,       // 1 flashcard generation per day
  practice_quiz: 1,    // 1 practice quiz per day
  notes: 1,            // 1 note generation per day
  teach_it: 1,         // 1 teach-it set per day
  learn_lectures: 1,   // 1 lecture generation per day
  ai_messages: 5,      // 5 Polly chat messages per day
  diagnostic: 3,       // diagnostics stay generous (they're the "aha" moment)
  assignments: 1       // 1 graded assignment per day
};

// User-friendly labels — used by the upgrade modal to explain what was hit.
export const FEATURE_LABELS = {
  lessons: 'Lesson uploads',
  flashcards: 'Flashcard generations',
  practice_quiz: 'Practice quizzes',
  notes: 'AI notes',
  teach_it: 'Teach-It sets',
  learn_lectures: 'AI lectures',
  ai_messages: 'AI tutor messages',
  diagnostic: 'Diagnostic exams',
  assignments: 'Graded assignments'
};

// Map each feature → the user counter field on the User entity.
const FEATURE_COUNTER_FIELDS = {
  lessons: 'daily_lessons_count',
  flashcards: 'daily_flashcards_count',
  practice_quiz: 'daily_practice_quiz_count',
  notes: 'daily_notes_count',
  teach_it: 'daily_teachit_count',
  learn_lectures: 'daily_learn_lectures_count',
  ai_messages: 'daily_ai_messages_count',
  diagnostic: 'daily_diagnostic_exams_count',
  assignments: 'daily_assignments_count'
};

// Backward-compat: legacy lifetime limits referenced by older code.
export const FREE_TIER_LIMITS = {
  lessons_total: FREE_DAILY_LIMITS.lessons,
  flashcard_sets_total: FREE_DAILY_LIMITS.flashcards,
  teachit_sets_total: FREE_DAILY_LIMITS.teach_it,
  practice_quizzes_total: FREE_DAILY_LIMITS.practice_quiz,
  polly_messages_total: FREE_DAILY_LIMITS.ai_messages,
  diagnostic_exams_per_day: FREE_DAILY_LIMITS.diagnostic,
  ai_messages_per_day: FREE_DAILY_LIMITS.ai_messages,
  assignments_total: FREE_DAILY_LIMITS.assignments
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
    if (window.ReactNativeWebView || window.Capacitor || window.cordova || window.PhoneGap || window.Android) {
      return true;
    }
    const isIOS = /(iPhone|iPod|iPad)/i.test(ua);
    const isWebKit = /AppleWebKit/i.test(ua);
    const isSafari = /Safari/i.test(ua);
    const isOtherBrowser = /(CriOS|FxiOS|EdgiOS|OPiOS|mercury)/i.test(ua);
    const isIOSWebView = isIOS && isWebKit && !isSafari && !isOtherBrowser;
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
    
    if (status === 'cancelled') {
      if (endDate) {
        const end = new Date(endDate);
        if (end > now && tier === 'pro') return true;
      }
      return false;
    }
    
    if (status === 'trialing' && trialEnd) {
      if (new Date(trialEnd) > now) return true;
    }
    
    if (tier !== 'pro') return false;
    if (status !== 'active') return false;
    
    if (promoUntil) {
      if (new Date(promoUntil) < now) return false;
      return true;
    }
    
    if (endDate && new Date(endDate) < now) return false;
    
    return true;
  };
  
  const isInTrial = () => {
    if (!user) return false;
    if (getUserField('subscription_status') !== 'trialing') return false;
    const trialEnd = getUserField('trial_end_date');
    if (!trialEnd) return false;
    return new Date(trialEnd) > new Date();
  };
  
  const getTrialRemainingDays = () => {
    const trialEnd = getUserField('trial_end_date');
    if (!trialEnd) return null;
    if (getUserField('subscription_status') !== 'trialing') return null;
    const diffTime = new Date(trialEnd) - new Date();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
  };

  const getPromoRemainingDays = () => {
    const promoUntil = getUserField('promo_access_until');
    if (!promoUntil) return null;
    const diffTime = new Date(promoUntil) - new Date();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
  };

  // =============================================================================
  // DAILY COUNTER RESET — 24h rolling window. Idempotent + cheap.
  // =============================================================================
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
    const resetTs = currentUser.daily_reset_timestamp || currentUser.data?.daily_reset_timestamp;
    const dailyResetTime = resetTs ? new Date(resetTs) : null;

    const needsReset = !dailyResetTime ||
      (now.getTime() - dailyResetTime.getTime()) >= 24 * 60 * 60 * 1000;

    if (!needsReset) return currentUser;

    // Reset ALL per-feature daily counters at once.
    const updates = { daily_reset_timestamp: now.toISOString() };
    Object.values(FEATURE_COUNTER_FIELDS).forEach((field) => { updates[field] = 0; });
    await base44.auth.updateMe(updates);
    return await refreshUser();
  };

  // =============================================================================
  // UNIFIED FEATURE GATE — single API for all paywalled features.
  // =============================================================================
  // Returns { allowed, current, limit, remaining, feature }.
  // Pro users always allowed. Free users checked against FREE_DAILY_LIMITS.
  const canUseFeature = async (feature) => {
    if (isPro()) return { allowed: true, feature };

    const limit = FREE_DAILY_LIMITS[feature];
    const field = FEATURE_COUNTER_FIELDS[feature];
    if (limit === undefined || !field) {
      // Unknown feature → fail-open (never block on misconfiguration).
      return { allowed: true, feature };
    }

    const currentUser = await checkAndResetCounters();
    if (!currentUser) return { allowed: true, feature };

    const current = currentUser[field] || currentUser.data?.[field] || 0;
    const allowed = current < limit;

    return {
      allowed,
      current,
      limit,
      remaining: Math.max(0, limit - current),
      feature
    };
  };

  // Bump a feature's daily counter. Safe for pro users (also tracks usage stats).
  const incrementFeatureUsage = async (feature) => {
    const field = FEATURE_COUNTER_FIELDS[feature];
    if (!field) return;

    const freshUser = await checkAndResetCounters();
    if (!freshUser) return;

    const newCount = (freshUser[field] || 0) + 1;
    const updates = { [field]: newCount };

    // Maintain legacy lifetime counters so historical analytics still work.
    const legacyMap = {
      lessons: 'total_lessons_created',
      flashcards: 'total_flashcard_sets',
      practice_quiz: 'total_practice_quizzes',
      notes: 'total_note_generations',
      teach_it: 'total_teachit_sets',
      ai_messages: 'total_polly_messages',
      assignments: 'total_assignments_graded'
    };
    const legacyField = legacyMap[feature];
    if (legacyField) updates[legacyField] = (freshUser[legacyField] || 0) + 1;

    await base44.auth.updateMe(updates);
    await refreshUser();
  };

  // =============================================================================
  // LEGACY API — preserved so existing callers don't break.
  // =============================================================================
  const canUpload = async () => {
    const r = await canUseFeature('lessons');
    return { ...r, requiresPro: !r.allowed };
  };

  // taskType: 'flashcards' | 'teach_it' | 'practice_exam' | 'review_notes'
  const canDoTask = async (taskType = null) => {
    const map = {
      flashcards: 'flashcards',
      teach_it: 'teach_it',
      practice_exam: 'practice_quiz',
      review_notes: 'notes'
    };
    const feature = map[taskType];
    if (!feature) return { allowed: true };
    return await canUseFeature(feature);
  };

  const canTakeDiagnostic = async () => canUseFeature('diagnostic');
  const canSendAIMessage = async () => canUseFeature('ai_messages');
  const canGradeAssignment = async () => {
    const r = await canUseFeature('assignments');
    return { ...r, requiresPro: !r.allowed };
  };

  const incrementUploadCount      = async () => incrementFeatureUsage('lessons');
  const incrementDiagnosticCount  = async () => incrementFeatureUsage('diagnostic');
  const incrementAIMessageCount   = async () => incrementFeatureUsage('ai_messages');
  const incrementAssignmentCount  = async () => incrementFeatureUsage('assignments');
  const incrementTaskCount = async (taskType = null) => {
    const map = {
      flashcards: 'flashcards',
      teach_it: 'teach_it',
      practice_exam: 'practice_quiz',
      review_notes: 'notes'
    };
    const feature = map[taskType];
    if (feature) await incrementFeatureUsage(feature);
  };

  // Trigger upgrade modal with optional callback + reason context.
  const triggerUpgradeModal = (reason, options = {}) => {
    setUpgradeReason(reason || 'default');
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
    // New unified API
    canUseFeature,
    incrementFeatureUsage,
    // Legacy API (kept working)
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
    // Modal control
    triggerUpgradeModal,
    showUpgradeModal,
    setShowUpgradeModal,
    upgradeReason,
    upgradeCallback,
    setUpgradeCallback,
    // Constants
    FREE_TIER_LIMITS,
    FREE_DAILY_LIMITS,
    FEATURE_LABELS,
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