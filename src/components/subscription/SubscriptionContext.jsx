import React, { createContext, useContext, useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

const SubscriptionContext = createContext(null);

// Limits for free tier
export const FREE_TIER_LIMITS = {
  uploads_per_week: 2,
  tasks_per_day: 1,
  ai_messages_per_day: 10
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

  const isPro = () => {
    if (user?.subscription_tier !== 'pro' || user?.subscription_status !== 'active') {
      return false;
    }
    // Check if promo access has expired
    if (user?.promo_access_until) {
      const expiryDate = new Date(user.promo_access_until);
      if (expiryDate < new Date()) {
        // Promo expired - will be updated on next server call
        return false;
      }
    }
    return true;
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

  const getToday = () => new Date().toISOString().split('T')[0];
  const getWeekStart = () => {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const diff = now.getDate() - dayOfWeek;
    return new Date(now.setDate(diff)).toISOString().split('T')[0];
  };

  // Check and reset daily/weekly counters
  const checkAndResetCounters = async () => {
    if (!user) return user;
    
    const today = getToday();
    const weekStart = getWeekStart();
    let updates = {};

    // Reset daily counters
    if (user.daily_tasks_reset_date !== today) {
      updates.daily_tasks_count = 0;
      updates.daily_tasks_reset_date = today;
    }
    if (user.daily_ai_messages_reset_date !== today) {
      updates.daily_ai_messages_count = 0;
      updates.daily_ai_messages_reset_date = today;
    }

    // Reset weekly counters
    if (user.weekly_uploads_reset_date !== weekStart) {
      updates.weekly_uploads_count = 0;
      updates.weekly_uploads_reset_date = weekStart;
    }

    if (Object.keys(updates).length > 0) {
      await base44.auth.updateMe(updates);
      return await refreshUser();
    }
    return user;
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
    console.log(`📦 Subscription check - isPro: ${pro}, tier: ${user?.subscription_tier}, status: ${user?.subscription_status}`);
    if (pro) return { allowed: true };
    const currentUser = await checkAndResetCounters();
    const count = currentUser?.daily_tasks_count || 0;
    console.log(`📦 Task limit check - count: ${count}, limit: ${FREE_TIER_LIMITS.tasks_per_day}`);
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
    const count = currentUser?.daily_ai_messages_count || 0;
    return {
      allowed: count < FREE_TIER_LIMITS.ai_messages_per_day,
      current: count,
      limit: FREE_TIER_LIMITS.ai_messages_per_day,
      remaining: Math.max(0, FREE_TIER_LIMITS.ai_messages_per_day - count)
    };
  };

  // Increment counters
  const incrementUploadCount = async () => {
    if (isPro()) return;
    await checkAndResetCounters();
    await base44.auth.updateMe({
      weekly_uploads_count: (user?.weekly_uploads_count || 0) + 1
    });
    await refreshUser();
  };

  const incrementTaskCount = async () => {
    if (isPro()) return;
    await checkAndResetCounters();
    await base44.auth.updateMe({
      daily_tasks_count: (user?.daily_tasks_count || 0) + 1
    });
    await refreshUser();
  };

  const incrementAIMessageCount = async () => {
    if (isPro()) return;
    await checkAndResetCounters();
    await base44.auth.updateMe({
      daily_ai_messages_count: (user?.daily_ai_messages_count || 0) + 1
    });
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