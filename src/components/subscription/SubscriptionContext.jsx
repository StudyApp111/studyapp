import React, { createContext, useContext, useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

const SubscriptionContext = createContext(null);

// Free tier limits - daily rolling window
export const FREE_TIER_LIMITS = {
  lessons_per_day: 3,  // 3 lesson uploads/creations per day
  diagnostic_exams_per_day: 3,  // 3 diagnostic exams per day
  ai_messages_per_day: 10  // 10 AI messages per day
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

  // Check if user has pro subscription OR is in trial period
  const isPro = () => {
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

  // Upload/Create Lesson - 3 per day for free, unlimited for pro
  const canUpload = async () => {
    if (isPro()) return { allowed: true };
    const currentUser = await checkAndResetCounters();
    if (!currentUser) return { allowed: false, current: 0, limit: FREE_TIER_LIMITS.lessons_per_day, remaining: 0 };
    
    const count = currentUser.daily_lessons_count || 0;
    const allowed = count < FREE_TIER_LIMITS.lessons_per_day;
    
    return {
      allowed,
      current: count,
      limit: FREE_TIER_LIMITS.lessons_per_day,
      remaining: Math.max(0, FREE_TIER_LIMITS.lessons_per_day - count)
    };
  };

  // Tasks - NO access for free users (Notes, Teach It, Flashcards, Practice Exams)
  const canDoTask = async () => {
    if (isPro()) return { allowed: true };
    // Free users cannot do tasks at all
    return { allowed: false, requiresPro: true };
  };
  
  // Diagnostic Exams - 3 per day for free, unlimited for pro
  const canTakeDiagnostic = async () => {
    if (isPro()) return { allowed: true };
    const currentUser = await checkAndResetCounters();
    if (!currentUser) return { allowed: false, current: 0, limit: FREE_TIER_LIMITS.diagnostic_exams_per_day, remaining: 0 };
    
    const count = currentUser.daily_diagnostic_exams_count || 0;
    const allowed = count < FREE_TIER_LIMITS.diagnostic_exams_per_day;
    
    return {
      allowed,
      current: count,
      limit: FREE_TIER_LIMITS.diagnostic_exams_per_day,
      remaining: Math.max(0, FREE_TIER_LIMITS.diagnostic_exams_per_day - count)
    };
  };

  const canSendAIMessage = async () => {
    if (isPro()) return { allowed: true };
    const currentUser = await checkAndResetCounters();
    if (!currentUser) return { allowed: false, current: 0, limit: FREE_TIER_LIMITS.ai_messages_per_day, remaining: 0 };
    
    const count = currentUser.daily_ai_messages_count || 0;
    const allowed = count < FREE_TIER_LIMITS.ai_messages_per_day;
    
    return {
      allowed,
      current: count,
      limit: FREE_TIER_LIMITS.ai_messages_per_day,
      remaining: Math.max(0, FREE_TIER_LIMITS.ai_messages_per_day - count)
    };
  };

  const canGradeAssignment = async () => {
    if (isPro()) return { allowed: true };
    // Hard paywall - must be pro to grade
    return { allowed: false, requiresPro: true };
  };

  // Increment counters
  const incrementUploadCount = async () => {
    if (isPro()) return;
    const freshUser = await checkAndResetCounters();
    if (!freshUser) return;
    const newCount = (freshUser.daily_lessons_count || 0) + 1;
    await base44.auth.updateMe({ daily_lessons_count: newCount });
    await refreshUser();
  };
  
  const incrementDiagnosticCount = async () => {
    if (isPro()) return;
    const freshUser = await checkAndResetCounters();
    if (!freshUser) return;
    const newCount = (freshUser.daily_diagnostic_exams_count || 0) + 1;
    await base44.auth.updateMe({ daily_diagnostic_exams_count: newCount });
    await refreshUser();
  };

  const incrementTaskCount = async () => { /* No-op - tasks blocked for free users */ };
  
  const incrementAIMessageCount = async () => {
    if (isPro()) return;
    const freshUser = await checkAndResetCounters();
    if (!freshUser) return;
    const newCount = (freshUser.daily_ai_messages_count || 0) + 1;
    await base44.auth.updateMe({ daily_ai_messages_count: newCount });
    await refreshUser();
  };

  const incrementAssignmentCount = async () => { /* No-op - hard paywall */ };

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