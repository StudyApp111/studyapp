import React from "react";
import { Lock } from "lucide-react";
import { useTheme } from "@/components/theme/ThemeProvider";
import { useIsMobile } from "@/hooks/use-mobile";

/**
 * Locked-state visual overlay shown ON TOP of locked flashcards. This is a
 * pure visual indicator — the actionable upgrade CTA lives in
 * FlashcardUpgradeBanner directly below the card, which is already
 * mobile-aware (routes through the soft "Continue on Desktop" modal).
 *
 * We only adjust the label here so the language matches what the user sees
 * on the CTA: "Continue on desktop" on phone, "Upgrade to unlock" on desktop.
 */
export default function LockedFlashcardOverlay() {
  const { isDark } = useTheme();
  const isMobile = useIsMobile();

  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl overflow-hidden">
      {/* Blur backdrop */}
      <div className={`absolute inset-0 backdrop-blur-md ${isDark ? 'bg-slate-900/60' : 'bg-white/60'}`} />
      {/* Lock content */}
      <div className="relative flex flex-col items-center gap-1.5">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isDark ? 'bg-purple-500/20' : 'bg-purple-100'}`}>
          <Lock className={`w-5 h-5 ${isDark ? 'text-purple-400' : 'text-purple-600'}`} />
        </div>
        <span className={`text-xs font-semibold ${isDark ? 'text-purple-300' : 'text-purple-700'}`}>
          {isMobile ? 'Continue on desktop' : 'Upgrade to unlock'}
        </span>
      </div>
    </div>
  );
}