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

  // Check if user has pro subscription OR is in trial period
  const isPro = () => {
    if (!user) return false;
    
    const now = new Date();
    
    // Cancelled users immediately lose access (no grace period for trials)
    if (user.subscription_status === 'cancelled') {
      // Check if they still have time left (paid subscription grace period)
      if (user.subscription_end_date) {
        const endDate = new Date(user.subscription_end_date);
        if (endDate > now && user.subscription_tier === 'pro') {
          return true; // Still in paid grace period
        }
      }
      return false; // Cancelled, no access
    }
    
    // Check for active trial first
    if (user.subscription_status === 'trialing' && user.trial_end_date) {
      const trialEnd = new Date(user.trial_end_date);
      if (trialEnd > now) {
        return true; // Trial still active
      }
    }
    
    // Must have pro tier AND active status
    if (user.subscription_tier !== 'pro') return false;
    if (user.subscription_status !== 'active') return false;
    
    // Check promo access expiry first
    if (user.promo_access_until) {
      const promoExpiry = new Date(user.promo_access_until);
      if (promoExpiry < now) {
        return false; // Promo expired
      }
      return true; // Promo still valid
    }
    
    // Check subscription end date for paid subscriptions
    if (user.subscription_end_date) {
      const subExpiry = new Date(user.subscription_end_date);
      if (subExpiry < now) {
        return false; // Subscription expired
      }
    }
    
    return true;
  };
  
  // Check if user is in trial
  const isInTrial = () => {
    if (!user) return false;
    if (user.subscription_status !== 'trialing') return false;
    if (!user.trial_end_date) return false;
    
    const now = new Date();
    const trialEnd = new Date(user.trial_end_date);
    return trialEnd > now;
  };
  
  // Get trial remaining days
  const getTrialRemainingDays = () => {
    if (!user?.trial_end_date) return null;
    if (user.subscription_status !== 'trialing') return null;
    
    const now = new Date();
    const trialEnd = new Date(user.trial_end_date);
    const diffTime = trialEnd - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
  };

  // Get remaining promo days
  const getPromoRemainingDays = () => {
    if (!user?.promo_access_until) return null;
    const expiryDate = new Date(user.promo_access_until);
    const now = new Date();
    const diffTime = expiryDate - now;
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
    const dailyResetTime = currentUser.daily_reset_timestamp ? new Date(currentUser.daily_reset_timestamp) : null;
    
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