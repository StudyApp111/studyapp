import React from "react";
import { Lock } from "lucide-react";
import { useTheme } from "@/components/theme/ThemeProvider";

export default function LockedFlashcardOverlay({ totalCards }) {
  const { isDark } = useTheme();

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
          Upgrade to unlock
        </span>
      </div>
    </div>
  );
}