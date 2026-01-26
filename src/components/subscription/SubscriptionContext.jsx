import React, { createContext, useContext, useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

const SubscriptionContext = createContext(null);

// Limits for free tier - resets based on rolling windows
export const FREE_TIER_LIMITS = {
  uploads_per_week: 2,  // 2 uploads per 7-day rolling window
  tasks_per_day: 1,     // 1 task per 24h rolling window  
  ai_messages_per_day: 10  // 10 AI messages per 24h rolling window
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

  // Check if user has pro subscription - must have BOTH tier=pro AND status=active
  const isPro = () => {
    if (!user) return false;
    
    // Check for active subscription
    if (user.subscription_tier === 'pro' && user.subscription_status === 'active') {
      // Check if promo access has expired
      if (user.promo_access_until) {
        const expiryDate = new Date(user.promo_access_until);
        if (expiryDate < new Date()) {
          return false; // Promo expired
        }
      }
      return true;
    }
    return false;
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

  // Get rolling window dates based on account creation
  const getRollingWindowStart = (hours) => {
    const now = new Date();
    return new Date(now.getTime() - hours * 60 * 60 * 1000);
  };

  // Check and reset counters based on rolling windows
  // IMPORTANT: Always fetches fresh user data to avoid stale counter values
  const checkAndResetCounters = async () => {
    // ALWAYS fetch fresh user data from server to get accurate counters
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

    // Daily counters - 24h rolling window
    const dailyResetTime = currentUser.daily_reset_timestamp ? new Date(currentUser.daily_reset_timestamp) : null;
    
    if (!dailyResetTime) {
      // First time - initialize timestamp AND reset counters to 0 (fresh start)
      updates.daily_reset_timestamp = now.toISOString();
      updates.daily_tasks_count = 0;
      updates.daily_ai_messages_count = 0;
      needsUpdate = true;
    } else if ((now.getTime() - dailyResetTime.getTime()) >= 24 * 60 * 60 * 1000) {
      // 24h window expired - reset counters
      updates.daily_tasks_count = 0;
      updates.daily_ai_messages_count = 0;
      updates.daily_reset_timestamp = now.toISOString();
      needsUpdate = true;
    }

    // Weekly counters - 7 day rolling window
    const weeklyResetTime = currentUser.weekly_reset_timestamp ? new Date(currentUser.weekly_reset_timestamp) : null;
    
    if (!weeklyResetTime) {
      // First time - initialize timestamp AND reset counters to 0 (fresh start)
      updates.weekly_reset_timestamp = now.toISOString();
      updates.weekly_uploads_count = 0;
      needsUpdate = true;
    } else if ((now.getTime() - weeklyResetTime.getTime()) >= 7 * 24 * 60 * 60 * 1000) {
      // 7-day window expired - reset counters
      updates.weekly_uploads_count = 0;
      updates.weekly_reset_timestamp = now.toISOString();
      needsUpdate = true;
    }

    if (needsUpdate) {
      await base44.auth.updateMe(updates);
      return await refreshUser();
    }
    return currentUser;
  };

  // Check if user can perform action
  const canUpload = async () => {
    if (isPro()) return { allowed: true };
    const currentUser = await checkAndResetCounters();
    const count = currentUser?.weekly_uploads_count || 0;
    return {
      allowed: count < FREE_TIER_LIMITS.uploads_per_week,
      current: count,
      limit: FREE_TIER_LIMITS.uploads_per_week,
      remaining: Math.max(0, FREE_TIER_LIMITS.uploads_per_week - count)
    };
  };

  const canDoTask = async () => {
    const pro = isPro();
    if (pro) return { allowed: true };
    const currentUser = await checkAndResetCounters();
    const count = currentUser?.daily_tasks_count || 0;
    return {
      allowed: count < FREE_TIER_LIMITS.tasks_per_day,
      current: count,
      limit: FREE_TIER_LIMITS.tasks_per_day,
      remaining: Math.max(0, FREE_TIER_LIMITS.tasks_per_day - count)
    };
  };

  const canSendAIMessage = async () => {
    if (isPro()) return { allowed: true };
    const currentUser = await checkAndResetCounters();
    if (!currentUser) return { allowed: false, current: 0, limit: FREE_TIER_LIMITS.ai_messages_per_day, remaining: 0 };
    
    const count = currentUser.daily_ai_messages_count || 0;
    const allowed = count < FREE_TIER_LIMITS.ai_messages_per_day;
    
    console.log(`🔒 AI Message Check: ${count}/${FREE_TIER_LIMITS.ai_messages_per_day}, allowed=${allowed}`);
    
    return {
      allowed,
      current: count,
      limit: FREE_TIER_LIMITS.ai_messages_per_day,
      remaining: Math.max(0, FREE_TIER_LIMITS.ai_messages_per_day - count)
    };
  };

  // Increment counters - always fetch fresh data to avoid race conditions
  const incrementUploadCount = async () => {
    if (isPro()) return;
    const freshUser = await checkAndResetCounters();
    if (!freshUser) return;
    const newCount = (freshUser.weekly_uploads_count || 0) + 1;
    await base44.auth.updateMe({ weekly_uploads_count: newCount });
    await refreshUser();
  };

  const incrementTaskCount = async () => {
    if (isPro()) return;
    const freshUser = await checkAndResetCounters();
    if (!freshUser) return;
    const newCount = (freshUser.daily_tasks_count || 0) + 1;
    await base44.auth.updateMe({ daily_tasks_count: newCount });
    await refreshUser();
  };

  const incrementAIMessageCount = async () => {
    if (isPro()) return;
    const freshUser = await checkAndResetCounters();
    if (!freshUser) return;
    const newCount = (freshUser.daily_ai_messages_count || 0) + 1;
    console.log(`🔒 Incrementing AI message count: ${freshUser.daily_ai_messages_count || 0} -> ${newCount}`);
    await base44.auth.updateMe({ daily_ai_messages_count: newCount });
    await refreshUser();
  };

  // Trigger upgrade modal
  const triggerUpgradeModal = (reason) => {
    setUpgradeReason(reason);
    setShowUpgradeModal(true);
  };

  const value = {
    user,
    loading,
    isPro,
    refreshUser,
    canUpload,
    canDoTask,
    canSendAIMessage,
    incrementUploadCount,
    incrementTaskCount,
    incrementAIMessageCount,
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