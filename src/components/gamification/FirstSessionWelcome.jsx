import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Dialog, 
  DialogContent 
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { 
  Sparkles, 
  Target, 
  Flame, 
  Trophy,
  Zap,
  ChevronRight,
  BookOpen
} from "lucide-react";

const STEPS = [
  {
    icon: BookOpen,
    title: "Upload Your Notes",
    description: "Drop your lecture slides, textbook pages, or study guides. The more specific, the better your quizzes!",
    color: "from-purple-500 to-indigo-600",
    emoji: "📚"
  },
  {
    icon: Target,
    title: "Practice with AI Quizzes",
    description: "Take AI-generated exams based on YOUR content. Get instant feedback and see what you know!",
    color: "from-emerald-500 to-teal-600",
    emoji: "🎯"
  },
  {
    icon: Flame,
    title: "Build Your Streak",
    description: "Study for 20 minutes daily to earn XP and keep your streak! Small daily wins lead to big results.",
    color: "from-orange-500 to-red-500",
    emoji: "🔥"
  },
  {
    icon: Trophy,
    title: "Track Your Progress",
    description: "Watch your predicted grade improve as you study more. Aim for that A+!",
    color: "from-yellow-500 to-amber-500",
    emoji: "🏆"
  }
];

export default function FirstSessionWelcome({ open, onOpenChange, userName }) {
  const [currentStep, setCurrentStep] = useState(0);

  const handleNext = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onOpenChange(false);
      localStorage.setItem('hasSeenWelcomeGuide', 'true');
    }
  };

  const step = STEPS[currentStep];
  const Icon = step.icon;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm w-[calc(100%-2rem)] p-0 gap-0 rounded-2xl overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            transition={{ duration: 0.3 }}
          >
            {/* Header */}
            <div className={`bg-gradient-to-r ${step.color} px-6 py-8 text-white text-center`}>
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1, rotate: [0, 10, -10, 0] }}
                transition={{ delay: 0.2, duration: 0.5 }}
                className="text-6xl mb-3"
              >
                {step.emoji}
              </motion.div>
              <h2 className="text-2xl font-bold mb-1">{step.title}</h2>
              <p className="text-white/80 text-sm">{step.description}</p>
            </div>

            {/* Progress dots */}
            <div className="flex justify-center gap-2 py-4 bg-slate-50">
              {STEPS.map((_, idx) => (
                <div
                  key={idx}
                  className={`w-2 h-2 rounded-full transition-all ${
                    idx === currentStep 
                      ? 'bg-purple-600 w-6' 
                      : idx < currentStep 
                      ? 'bg-purple-400' 
                      : 'bg-slate-300'
                  }`}
                />
              ))}
            </div>

            {/* Footer */}
            <div className="px-6 pb-6">
              <Button
                onClick={handleNext}
                className="w-full h-12 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-semibold"
              >
                {currentStep < STEPS.length - 1 ? (
                  <>
                    Next
                    <ChevronRight className="w-5 h-5 ml-2" />
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5 mr-2" />
                    Let's Go!
                  </>
                )}
              </Button>
            </div>
          </motion.div>
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}