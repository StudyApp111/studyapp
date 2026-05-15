import React from "react";
import { Lock, Zap, Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/components/theme/ThemeProvider";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { useSubscription } from "@/components/subscription/SubscriptionContext";

export default function FlashcardUpgradeBanner({ totalCards, freeLimit }) {
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { triggerUpgradeModal } = useSubscription();
  const lockedCount = totalCards - freeLimit;

  // On mobile: route through the soft "Continue on Desktop" modal — never
  // push the user to PricingPlans or use "Upgrade to Pro" language inside
  // the native app shell (App Store / Play Store compliance).
  const handleClick = () => {
    if (isMobile) {
      triggerUpgradeModal('flashcards');
    } else {
      navigate(createPageUrl("PricingPlans"));
    }
  };

  return (
    <div className={`rounded-2xl p-4 border-2 border-dashed text-center space-y-3 ${
      isDark 
        ? 'bg-purple-500/10 border-purple-500/30' 
        : 'bg-purple-50 border-purple-200'
    }`}>
      <div className="flex items-center justify-center gap-2">
        <Lock className={`w-4 h-4 ${isDark ? 'text-purple-400' : 'text-purple-600'}`} />
        <span className={`text-sm font-bold ${isDark ? 'text-purple-300' : 'text-purple-700'}`}>
          {isMobile ? 'Continue on desktop' : 'Free limit reached'}
        </span>
      </div>
      <p className={`text-xs leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
        {isMobile
          ? `${lockedCount} more cards are ready for you in your full study workspace on a computer.`
          : `You've used your free flashcards. Upgrade to unlock all ${totalCards} cards and master every concept.`}
      </p>
      <Button
        onClick={handleClick}
        className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold text-sm px-6"
        size="sm"
      >
        {isMobile ? (
          <>
            <Monitor className="w-4 h-4 mr-1.5" />
            Continue on Web
          </>
        ) : (
          <>
            <Zap className="w-4 h-4 mr-1.5" />
            Upgrade to Pro
          </>
        )}
      </Button>
    </div>
  );
}