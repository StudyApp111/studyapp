import React, { createContext, useContext, useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

const SubscriptionContext = createContext(null);

// Only AI messages remain limited for non-pro users (hard paywall for everything else)
export const FREE_TIER_LIMITS = {
  ai_messages_per_day: 10  // 10 AI messages per 24h rolling window - ONLY limit kept
};

export function SubscriptionProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [upgradeReason, setUpgradeReason] = useState('');

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

  // Check and reset AI message counter (only counter kept)
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

    // Daily AI message counter - 24h rolling window
    const dailyResetTime = currentUser.daily_reset_timestamp ? new Date(currentUser.daily_reset_timestamp) : null;
    
    if (!dailyResetTime) {
      updates.daily_reset_timestamp = now.toISOString();
      updates.daily_ai_messages_count = 0;
      needsUpdate = true;
    } else if ((now.getTime() - dailyResetTime.getTime()) >= 24 * 60 * 60 * 1000) {
      updates.daily_ai_messages_count = 0;
      updates.daily_reset_timestamp = now.toISOString();
      needsUpdate = true;
    }

    if (needsUpdate) {
      await base44.auth.updateMe(updates);
      return await refreshUser();
    }
    return currentUser;
  };

  // HARD PAYWALL: Everything requires Pro except AI messages (which have a limit)
  const canUpload = async () => {
    if (isPro()) return { allowed: true };
    // Hard paywall - must be pro to upload
    return { allowed: false, requiresPro: true };
  };

  const canDoTask = async () => {
    if (isPro()) return { allowed: true };
    // Hard paywall - must be pro to do tasks
    return { allowed: false, requiresPro: true };
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

  // Keep increment functions but they only matter for AI messages now
  const incrementUploadCount = async () => { /* No-op - hard paywall */ };
  const incrementTaskCount = async () => { /* No-op - hard paywall */ };
  
  const incrementAIMessageCount = async () => {
    if (isPro()) return;
    const freshUser = await checkAndResetCounters();
    if (!freshUser) return;
    const newCount = (freshUser.daily_ai_messages_count || 0) + 1;
    await base44.auth.updateMe({ daily_ai_messages_count: newCount });
    await refreshUser();
  };

  const incrementAssignmentCount = async () => { /* No-op - hard paywall */ };

  // Trigger upgrade modal
  const triggerUpgradeModal = (reason) => {
    setUpgradeReason(reason);
    setShowUpgradeModal(true);
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
    canSendAIMessage,
    canGradeAssignment,
    incrementUploadCount,
    incrementTaskCount,
    incrementAIMessageCount,
    incrementAssignmentCount,
    triggerUpgradeModal,
    showUpgradeModal,
    setShowUpgradeModal,
    upgradeReason,
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