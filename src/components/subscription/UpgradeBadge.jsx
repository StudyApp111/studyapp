import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Zap, Crown, Gift, Monitor } from 'lucide-react';
import { useSubscription } from './SubscriptionContext';
import { useTheme } from '@/components/theme/ThemeProvider';
import { useIsMobile } from '@/hooks/use-mobile';

// =============================================================================
// UPGRADE BADGES — sidebar / header CTAs for non-Pro users.
//
// IMPORTANT: On mobile we never link to /PricingPlans and never use the word
// "Upgrade". Instead we open the soft UpgradeModal (which on mobile shows the
// "Continue on Desktop" experience) so app users never see subscription
// purchase mechanics inside the native app shell. This keeps us aligned with
// App Store / Play Store review guidelines.
// =============================================================================

// Compact badge for the desktop sidebar.
// (Mobile users don't see the desktop sidebar — see Layout.jsx — so this stays
// as the original "Upgrade" CTA for the laptop/desktop product surface.)
export function UpgradeNavBadge() {
  const { isDark } = useTheme();
  const { isPro, getPromoRemainingDays, triggerUpgradeModal } = useSubscription();
  const isMobile = useIsMobile();

  const promoDaysLeft = getPromoRemainingDays?.();
  const hasActivePromo = promoDaysLeft !== null && promoDaysLeft >= 0;

  // Active promo countdown — same UX on every device.
  if (hasActivePromo) {
    return (
      <Link
        to={createPageUrl("Settings")}
        className={`relative w-full min-h-[44px] py-3 rounded-xl flex flex-col items-center justify-center gap-1 transition-all bg-gradient-to-br from-purple-600/30 to-pink-600/30 border border-purple-500/50 hover:border-purple-500 group ${isDark ? 'text-purple-300' : 'text-purple-600'}`}
        title={`Promo: ${promoDaysLeft} days left`}
      >
        <Gift className="w-5 h-5 flex-shrink-0" />
        <span className="text-[9px] font-bold text-center leading-tight px-1 truncate">{promoDaysLeft}d</span>
      </Link>
    );
  }

  if (isPro()) {
    return (
      <div
        className="w-full min-h-[44px] py-3 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex flex-col items-center justify-center gap-1"
        title="Locked In"
      >
        <Crown className="w-5 h-5 text-white flex-shrink-0" />
        <span className="text-[9px] font-bold text-white text-center leading-tight px-1 truncate">Pro</span>
      </div>
    );
  }

  // Mobile path — opens the soft modal (Continue on Desktop), no navigation,
  // no "Upgrade" / "Pro" language.
  if (isMobile) {
    return (
      <button
        type="button"
        onClick={() => triggerUpgradeModal('default')}
        className="relative w-full min-h-[44px] py-3 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex flex-col items-center justify-center gap-1 shadow-lg shadow-purple-500/30 active:scale-95 transition-transform group"
        title="Continue on a computer"
        aria-label="Continue on a computer"
      >
        <Monitor className="w-5 h-5 text-white flex-shrink-0" />
        <span className="text-[9px] font-bold text-white text-center leading-tight px-1 truncate">On Web</span>
      </button>
    );
  }

  // Desktop path — full pricing page experience.
  return (
    <Link
      to={createPageUrl("PricingPlans")}
      className="relative w-full min-h-[44px] py-3 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex flex-col items-center justify-center gap-1 shadow-lg shadow-purple-500/30 hover:scale-105 transition-transform group"
      title="Upgrade to Locked In"
    >
      <Zap className="w-5 h-5 text-white group-hover:animate-pulse flex-shrink-0" />
      <span className="text-[9px] font-bold text-white text-center leading-tight px-1 truncate">Upgrade</span>
      <span className="absolute top-1 right-1 w-2 h-2 bg-amber-400 rounded-full animate-pulse" />
    </Link>
  );
}

// Pill button used inline on Home / headers.
export function UpgradeButton({ compact = false }) {
  const { isPro, triggerUpgradeModal } = useSubscription();
  const isMobile = useIsMobile();

  if (isPro()) {
    return (
      <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-amber-400 to-orange-500 text-white ${compact ? 'text-xs' : 'text-sm'}`}>
        <Crown className={compact ? 'w-3 h-3' : 'w-4 h-4'} />
        <span className="font-bold">Locked In</span>
      </div>
    );
  }

  // Mobile — soft "Continue on Web" pill, opens the desktop-link modal.
  if (isMobile) {
    return (
      <button
        type="button"
        onClick={() => triggerUpgradeModal('default')}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-purple-500 to-indigo-600 active:scale-95 text-white shadow-lg shadow-purple-500/20 transition-transform ${compact ? 'text-xs' : 'text-sm'}`}
        aria-label="Continue on a computer"
      >
        <Monitor className={compact ? 'w-3 h-3' : 'w-4 h-4'} />
        <span className="font-bold">Continue on Web</span>
      </button>
    );
  }

  // Desktop — keep the original Upgrade pill linking to pricing.
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