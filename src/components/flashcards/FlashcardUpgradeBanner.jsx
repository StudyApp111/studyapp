import React from "react";
import { Lock, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/components/theme/ThemeProvider";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function FlashcardUpgradeBanner({ totalCards, freeLimit }) {
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const lockedCount = totalCards - freeLimit;

  return (
    <div className={`rounded-2xl p-4 border-2 border-dashed text-center space-y-3 ${
      isDark 
        ? 'bg-purple-500/10 border-purple-500/30' 
        : 'bg-purple-50 border-purple-200'
    }`}>
      <div className="flex items-center justify-center gap-2">
        <Lock className={`w-4 h-4 ${isDark ? 'text-purple-400' : 'text-purple-600'}`} />
        <span className={`text-sm font-bold ${isDark ? 'text-purple-300' : 'text-purple-700'}`}>
          Free limit reached
        </span>
      </div>
      <p className={`text-xs leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
        You've used your free flashcards. Upgrade to unlock all {totalCards} cards and master every concept.
      </p>
      <Button
        onClick={() => navigate(createPageUrl("PricingPlans"))}
        className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold text-sm px-6"
        size="sm"
      >
        <Zap className="w-4 h-4 mr-1.5" />
        Upgrade to Pro
      </Button>
    </div>
  );
}