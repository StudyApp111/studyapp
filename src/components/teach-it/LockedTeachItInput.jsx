import React from "react";
import { Lock, Zap, Monitor } from "lucide-react";
import { useTheme } from "@/components/theme/ThemeProvider";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { useSubscription } from "@/components/subscription/SubscriptionContext";

/**
 * LockedTeachItInput — the locked-state replacement for the explanation input.
 *
 * Mobile vs desktop branching matches the rest of the app (see UpgradeBadge,
 * FlashcardUpgradeBanner): on mobile we open the soft UpgradeModal (which
 * shows "Continue on Desktop"), never navigate to /PricingPlans. Inside the
 * native app shell, linking to /PricingPlans either bounces to Home (iOS/Android
 * detection in PricingPlans.jsx) or triggers an auth round-trip in the
 * in-app webview that lands the user on the login page — both broken UX
 * and out of App/Play Store compliance.
 */
export default function LockedTeachItInput() {
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { triggerUpgradeModal } = useSubscription();

  const handleClick = () => {
    if (isMobile) {
      triggerUpgradeModal('teach_it');
    } else {
      navigate(createPageUrl("PricingPlans"));
    }
  };

  return (
    <div className="space-y-3">
      {/* Locked textarea replacement */}
      <div 
        className={`relative min-h-[140px] md:min-h-[200px] rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-3 px-4 ${
          isDark 
            ? 'bg-white/5 border-purple-500/30' 
            : 'bg-slate-50 border-purple-300'
        }`}
      >
        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isDark ? 'bg-purple-600/20' : 'bg-purple-100'}`}>
          <Lock className={`w-5 h-5 ${isDark ? 'text-purple-400' : 'text-purple-600'}`} />
        </div>
        <p className={`text-sm font-semibold text-center ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
          {isMobile
            ? 'Continue on a computer to submit your explanation'
            : 'Upgrade to submit your explanation and get AI feedback'}
        </p>
        <p className={`text-xs text-center ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
          {isMobile
            ? 'The Feynman workspace and AI feedback are built for desktop.'
            : 'Free users can fully interact with 1 card per set'}
        </p>
      </div>

      {/* CTA — mobile opens soft modal, desktop navigates to pricing. */}
      <button
        type="button"
        onClick={handleClick}
        className="w-full h-11 md:h-14 bg-gradient-to-r from-purple-600 via-purple-700 to-purple-800 hover:from-purple-700 hover:via-purple-800 hover:to-purple-900 text-white font-semibold rounded-xl shadow-lg text-sm md:text-lg flex items-center justify-center gap-2"
      >
        {isMobile ? (
          <>
            <Monitor className="w-4 h-4" />
            Continue on Web
          </>
        ) : (
          <>
            <Zap className="w-4 h-4" />
            Upgrade to Unlock
          </>
        )}
      </button>
    </div>
  );
}