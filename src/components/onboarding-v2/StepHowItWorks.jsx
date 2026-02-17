import React from "react";
import { motion } from "framer-motion";
import { useTheme } from "@/components/theme/ThemeProvider";
import { Button } from "@/components/ui/button";
import { ChevronLeft, Brain } from "lucide-react";

export default function StepHowItWorks({ onNext, onBack }) {
  const { isDark } = useTheme();

  return (
    <motion.div
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -30 }}
      transition={{ duration: 0.25 }}
      className="space-y-6 py-4"
    >
      {/* Section 1 */}
      <div className="text-center space-y-3">
        <h2
          className={`text-xl md:text-2xl font-black ${
            isDark ? "text-white" : "text-slate-900"
          }`}
        >
          StudyApp learns from you as you study
        </h2>
        <p
          className={`text-sm ${
            isDark ? "text-slate-400" : "text-slate-600"
          }`}
        >
          Every practice question, wrong answer, and hesitation helps us predict
          your grade more accurately.
        </p>
      </div>

      {/* Brain visual */}
      <div className="flex justify-center">
        <motion.div
          animate={{ scale: [1, 1.05, 1] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          className={`w-20 h-20 rounded-2xl flex items-center justify-center ${
            isDark
              ? "bg-gradient-to-br from-purple-600/30 to-pink-600/30 border border-purple-500/20"
              : "bg-gradient-to-br from-purple-100 to-pink-100 border border-purple-200"
          }`}
        >
          <Brain
            className={`w-10 h-10 ${
              isDark ? "text-purple-400" : "text-purple-600"
            }`}
          />
        </motion.div>
      </div>

      <p
        className={`text-center text-sm font-medium ${
          isDark ? "text-slate-300" : "text-slate-700"
        }`}
      >
        The more you study, the smarter your plan gets.
      </p>

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