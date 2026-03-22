import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Zap, Crown, Gift } from 'lucide-react';
import { useSubscription } from './SubscriptionContext';

// Compact badge for sidebar/nav
export function UpgradeNavBadge() {
  const { isPro, getPromoRemainingDays } = useSubscription();
  
  const promoDaysLeft = getPromoRemainingDays?.();
  const hasActivePromo = promoDaysLeft !== null && promoDaysLeft >= 0;
  
  // Show promo countdown if active promo
  if (hasActivePromo) {
    return (
      <Link
        to={createPageUrl("Settings")}
        className={`relative w-full min-h-[44px] py-3 rounded-xl flex flex-col lg:flex-row items-center lg:justify-start justify-center gap-1 lg:gap-3 lg:px-4 transition-all bg-gradient-to-br from-purple-600/30 to-pink-600/30 border border-purple-500/50 hover:border-purple-500 group ${isDark ? 'text-purple-300' : 'text-purple-600'}`}
        title={`Promo: ${promoDaysLeft} days left`}
      >
        <Gift className="w-5 h-5 flex-shrink-0" />
        <span className="text-[9px] lg:text-xs font-bold text-center lg:text-left leading-tight px-1 truncate">{promoDaysLeft}d</span>
      </Link>
    );
  }
  
  if (isPro()) {
    return (
      <div
        className="w-full min-h-[44px] py-3 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex flex-col lg:flex-row items-center lg:justify-start justify-center gap-1 lg:gap-3 lg:px-4"
        title="Locked In"
      >
        <Crown className="w-5 h-5 text-white flex-shrink-0" />
        <span className="text-[9px] lg:text-xs font-bold text-white text-center lg:text-left leading-tight px-1 truncate">Pro</span>
      </div>
    );
  }

  return (
    <Link
      to={createPageUrl("PricingPlans")}
      className="relative w-full min-h-[44px] py-3 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex flex-col lg:flex-row items-center lg:justify-start justify-center gap-1 lg:gap-3 lg:px-4 shadow-lg shadow-purple-500/30 hover:scale-105 transition-transform group"
      title="Upgrade to Locked In"
    >
      <Zap className="w-5 h-5 text-white group-hover:animate-pulse flex-shrink-0" />
      <span className="text-[9px] lg:text-xs font-bold text-white text-center lg:text-left leading-tight px-1 truncate">Upgrade</span>
      <span className="absolute top-1 right-1 w-2 h-2 bg-amber-400 rounded-full animate-pulse" />
    </Link>
  );
}

// Button for header/home
export function UpgradeButton({ compact = false }) {
  const { isPro } = useSubscription();
  
  if (isPro()) {
    return (
      <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-amber-400 to-orange-500 text-white ${compact ? 'text-xs' : 'text-sm'}`}>
        <Crown className={compact ? 'w-3 h-3' : 'w-4 h-4'} />
        <span className="font-bold">Locked In</span>
      </div>
    );
  }

  return (
    <Link
      to={createPageUrl("PricingPlans")}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 text-white shadow-lg shadow-purple-500/20 transition-all hover:scale-105 ${compact ? 'text-xs' : 'text-sm'}`}
    >
      <Zap className={compact ? 'w-3 h-3' : 'w-4 h-4'} />
      <span className="font-bold">Upgrade</span>
    </Link>
  );
}