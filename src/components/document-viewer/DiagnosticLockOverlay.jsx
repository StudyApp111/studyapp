import React from "react";
import { Lock, Zap } from "lucide-react";
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
        Complete the Diagnostic First
      </h3>
      <p className={`text-sm max-w-sm mb-6 leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
        Finish the diagnostic exam in the <strong>Practice</strong> tab so StudyApp can create a custom lesson plan tailored to you.
      </p>
      <Button
        onClick={onGoToPractice}
        className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold px-6 py-3 rounded-xl shadow-lg"
      >
        <Zap className="w-4 h-4 mr-2" />
        Go to Practice Tab
      </Button>
    </div>
  );
}