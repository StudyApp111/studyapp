import React from "react";
import { Lock, Zap, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/components/theme/ThemeProvider";

export default function DiagnosticLockOverlay({ onGoToPractice }) {
  const { isDark } = useTheme();

  return (
    <div className={`flex flex-col items-center justify-center py-16 px-6 text-center ${isDark ? 'bg-[#0a0a12]' : 'bg-slate-50'}`}>
      <div className={`w-20 h-20 rounded-3xl flex items-center justify-center mb-5 ${isDark ? 'bg-purple-600/20' : 'bg-purple-100'}`}>
        <Lock className={`w-10 h-10 ${isDark ? 'text-purple-400' : 'text-purple-600'}`} />
      </div>
      <h3 className={`text-xl font-bold mb-2 ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
        Take the Diagnostic First
      </h3>
      <p className={`text-sm max-w-sm mb-6 leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
        Complete the 5-question diagnostic so we can predict your grade, find your weak spots, and build your personalized study plan.
      </p>
      <Button
        onClick={onGoToPractice}
        className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-bold px-6 py-3 rounded-xl shadow-lg"
      >
        <Target className="w-4 h-4 mr-2" />
        Start 5-Question Diagnostic
      </Button>
    </div>
  );
}