import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, Sparkles } from "lucide-react";
import { useTheme } from "@/components/theme/ThemeProvider";

// Fun facts to show during loading
const FUN_FACTS = [
  { text: "Honey never spoils. Archaeologists found 3,000-year-old honey still edible.", icon: "🍯" },
  { text: "Octopuses have three hearts and blue blood.", icon: "🐙" },
  { text: "A day on Venus is longer than a year on Venus.", icon: "🪐" },
  { text: "There are more possible chess games than atoms in the universe.", icon: "♟️" },
  { text: "Sharks existed before trees.", icon: "🦈" },
  { text: "A bolt of lightning is 5x hotter than the sun's surface.", icon: "⚡" },
  { text: "The moon is slowly drifting away from Earth.", icon: "🌙" },
  { text: "Dolphins sleep with one eye open.", icon: "🐬" },
  { text: "Your brain uses 20% of your body's total energy.", icon: "🧠" },
  { text: "A cloud can weigh more than a million pounds.", icon: "☁️" },
];

export default function ProgressLoader({ 
  title = "Processing...",
  steps = [], // Array of { label: string, durationMs: number }
  onComplete,
  showFact = true
}) {
  const { isDark } = useTheme();
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [stepProgress, setStepProgress] = useState(0);
  const [completedSteps, setCompletedSteps] = useState([]);
  const [isComplete, setIsComplete] = useState(false);
  const [currentFact, setCurrentFact] = useState(FUN_FACTS[Math.floor(Math.random() * FUN_FACTS.length)]);
  const startTimeRef = useRef(Date.now());
  const intervalRef = useRef(null);

  // Calculate total estimated time
  const totalDuration = steps.reduce((sum, step) => sum + (step.durationMs || 3000), 0);
  
  useEffect(() => {
    if (steps.length === 0) return;
    
    const currentStep = steps[currentStepIndex];
    const stepDuration = currentStep?.durationMs || 3000;
    const stepStartTime = Date.now();
    
    // Clear any existing interval
    if (intervalRef.current) clearInterval(intervalRef.current);
    
    // Update progress smoothly
    intervalRef.current = setInterval(() => {
      const elapsed = Date.now() - stepStartTime;
      const progress = Math.min((elapsed / stepDuration) * 100, 100);
      setStepProgress(progress);
      
      // Move to next step when current completes
      if (progress >= 100) {
        setCompletedSteps(prev => [...prev, currentStepIndex]);
        
        if (currentStepIndex < steps.length - 1) {
          setCurrentStepIndex(prev => prev + 1);
          setStepProgress(0);
        } else {
          // All steps complete
          clearInterval(intervalRef.current);
          setIsComplete(true);
          setTimeout(() => onComplete?.(), 500);
        }
      }
    }, 50);
    
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [currentStepIndex, steps, onComplete]);

  // Rotate fun facts
  useEffect(() => {
    const factTimer = setInterval(() => {
      setCurrentFact(FUN_FACTS[Math.floor(Math.random() * FUN_FACTS.length)]);
    }, 5000);
    return () => clearInterval(factTimer);
  }, []);

  // Calculate overall progress
  const overallProgress = steps.length > 0 
    ? ((completedSteps.length + (stepProgress / 100)) / steps.length) * 100
    : 0;

  return (
    <div className="flex flex-col items-center justify-center py-6 px-4 w-full max-w-sm mx-auto">
      {/* Title */}
      <h2 className={`text-lg font-bold mb-4 text-center ${isDark ? 'text-white' : 'text-slate-900'}`}>
        {title}
      </h2>

      {/* Overall Progress Ring */}
      <div className="relative w-24 h-24 mb-6">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
          {/* Background circle */}
          <circle
            cx="50"
            cy="50"
            r="42"
            fill="none"
            strokeWidth="8"
            className={isDark ? 'stroke-slate-700' : 'stroke-slate-200'}
          />
          {/* Progress circle */}
          <circle
            cx="50"
            cy="50"
            r="42"
            fill="none"
            strokeWidth="8"
            strokeLinecap="round"
            className="stroke-purple-500 transition-all duration-300"
            style={{
              strokeDasharray: `${2 * Math.PI * 42}`,
              strokeDashoffset: `${2 * Math.PI * 42 * (1 - overallProgress / 100)}`
            }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          {isComplete ? (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 200 }}
            >
              <CheckCircle2 className="w-10 h-10 text-emerald-500" />
            </motion.div>
          ) : (
            <span className={`text-xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {Math.round(overallProgress)}%
            </span>
          )}
        </div>
      </div>

      {/* Steps List */}
      <div className="w-full space-y-2 mb-6">
        {steps.map((step, index) => {
          const isCurrentStep = index === currentStepIndex;
          const isCompleted = completedSteps.includes(index);
          const isPending = index > currentStepIndex;
          
          return (
            <motion.div
              key={index}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className={`flex items-center gap-3 p-2.5 rounded-lg transition-all ${
                isCompleted 
                  ? (isDark ? 'bg-emerald-500/10' : 'bg-emerald-50')
                  : isCurrentStep 
                    ? (isDark ? 'bg-purple-500/10' : 'bg-purple-50')
                    : (isDark ? 'bg-slate-800/50' : 'bg-slate-50')
              }`}
            >
              {/* Step indicator */}
              <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                isCompleted 
                  ? 'bg-emerald-500' 
                  : isCurrentStep 
                    ? 'bg-purple-500' 
                    : (isDark ? 'bg-slate-700' : 'bg-slate-200')
              }`}>
                {isCompleted ? (
                  <CheckCircle2 className="w-4 h-4 text-white" />
                ) : isCurrentStep ? (
                  <Sparkles className="w-3 h-3 text-white animate-pulse" />
                ) : (
                  <span className={`text-xs font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    {index + 1}
                  </span>
                )}
              </div>

              {/* Step label and progress */}
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium truncate ${
                  isCompleted 
                    ? (isDark ? 'text-emerald-300' : 'text-emerald-700')
                    : isCurrentStep 
                      ? (isDark ? 'text-white' : 'text-slate-900')
                      : (isDark ? 'text-slate-400' : 'text-slate-500')
                }`}>
                  {step.label}
                </p>
                
                {/* Progress bar for current step */}
                {isCurrentStep && !isCompleted && (
                  <div className={`h-1 mt-1 rounded-full overflow-hidden ${isDark ? 'bg-slate-700' : 'bg-slate-200'}`}>
                    <motion.div
                      className="h-full bg-purple-500 rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${stepProgress}%` }}
                      transition={{ duration: 0.1 }}
                    />
                  </div>
                )}
              </div>

              {/* Time indicator */}
              {isCurrentStep && !isCompleted && (
                <span className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                  ~{Math.ceil((step.durationMs || 3000) / 1000)}s
                </span>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* Fun fact */}
      {showFact && !isComplete && (
        <AnimatePresence mode="wait">
          <motion.div
            key={currentFact.text}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={`text-center p-3 rounded-xl ${isDark ? 'bg-slate-800/50' : 'bg-slate-50'}`}
          >
            <span className="text-2xl mb-1 block">{currentFact.icon}</span>
            <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
              {currentFact.text}
            </p>
          </motion.div>
        </AnimatePresence>
      )}

      {/* Success message */}
      {isComplete && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <p className={`text-sm font-medium ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
            ✨ All done!
          </p>
        </motion.div>
      )}
    </div>
  );
}