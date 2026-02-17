import React from "react";
import { motion } from "framer-motion";
import { useTheme } from "@/components/theme/ThemeProvider";
import { Button } from "@/components/ui/button";
import { ChevronLeft, Target, MessageSquare, Copy, Zap } from "lucide-react";

const features = [
  {
    icon: Target,
    name: "Custom Study Plans",
    description: "Based on your understanding of your courses",
    gradient: "from-purple-500 to-indigo-600",
  },
  {
    icon: MessageSquare,
    name: "AI Professor",
    description: "Ask questions anytime",
    gradient: "from-blue-500 to-indigo-600",
  },
  {
    icon: Copy,
    name: "Teach-it Cards & Flashcards",
    description: "Active recall that adapts to you",
    gradient: "from-pink-500 to-rose-600",
  },
  {
    icon: Zap,
    name: "Practice Exams",
    description: "Mirrors your course's actual exam",
    gradient: "from-amber-500 to-orange-600",
  },
];

export default function StepFeatures({ onNext, onBack }) {
  const { isDark } = useTheme();

  return (
    <motion.div
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -30 }}
      transition={{ duration: 0.25 }}
      className="space-y-5 py-4"
    >
      <div className="text-center space-y-1">
        <h2
          className={`text-xl md:text-2xl font-black ${
            isDark ? "text-white" : "text-slate-900"
          }`}
        >
          Create AI-powered study materials
        </h2>
      </div>

      {/* Feature grid 2x2 */}
      <div className="grid grid-cols-2 gap-3">
        {features.map((feat, idx) => (
          <motion.div
            key={idx}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 * idx, duration: 0.25 }}
            className={`p-4 rounded-2xl border space-y-3 ${
              isDark
                ? "bg-white/5 border-white/10"
                : "bg-slate-50 border-slate-200"
            }`}
          >
            <div
              className={`w-10 h-10 rounded-xl bg-gradient-to-br ${feat.gradient} flex items-center justify-center shadow-lg`}
            >
              <feat.icon className="w-5 h-5 text-white" />
            </div>
            <div>
              <p
                className={`text-sm font-bold ${
                  isDark ? "text-white" : "text-slate-900"
                }`}
              >
                {feat.name}
              </p>
              <p
                className={`text-xs mt-0.5 ${
                  isDark ? "text-slate-400" : "text-slate-500"
                }`}
              >
                {feat.description}
              </p>
            </div>
          </motion.div>
        ))}
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