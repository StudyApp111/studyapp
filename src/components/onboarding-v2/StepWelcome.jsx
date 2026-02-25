import React from "react";
import { motion } from "framer-motion";
import { useTheme } from "@/components/theme/ThemeProvider";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";

export default function StepWelcome({ displayName, onNext, onBack }) {
  const { isDark } = useTheme();

  return (
    <motion.div
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -30 }}
      transition={{ duration: 0.25 }}
      className="text-center space-y-6 py-6"
    >
      <div className="space-y-3">
        <h2
          className={`text-2xl md:text-3xl font-black ${
            isDark ? "text-white" : "text-slate-900"
          }`}
        >
          {displayName ? `Hi ${displayName}` : 'Hi There'} 👋
        </h2>
        <p
          className={`text-base ${
            isDark ? "text-slate-400" : "text-slate-600"
          }`}
        >
          We predict your grade, then help you improve it.
        </p>
      </div>

      {/* Navigation */}
      <div className="flex items-center gap-3 pt-2">
        <Button
          variant="ghost"
          onClick={onBack}
          className={`${
            isDark
              ? "text-slate-400 hover:text-white"
              : "text-slate-500 hover:text-slate-900"
          }`}
        >
          <ChevronLeft className="w-4 h-4 mr-1" />
          Back
        </Button>
        <Button
          onClick={onNext}
          className="flex-1 h-12 text-base font-bold bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl shadow-lg shadow-purple-500/20"
        >
          Continue
        </Button>
      </div>
    </motion.div>
  );
}