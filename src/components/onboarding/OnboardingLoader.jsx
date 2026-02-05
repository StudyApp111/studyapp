import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { FileText, ListChecks, Sparkles, CheckCircle, Loader2 } from "lucide-react";

const steps = [
  {
    id: "analyzing",
    title: "Analyzing your material",
    icon: FileText,
    emoji: "📄"
  },
  {
    id: "curriculum",
    title: "Creating curriculum map",
    icon: ListChecks,
    emoji: "🗺️"
  },
  {
    id: "generating",
    title: "Generating study tools",
    icon: Sparkles,
    emoji: "✨"
  }
];

export default function OnboardingLoader({ fileName, isComplete, onAnimationComplete }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState([]);

  useEffect(() => {
    if (isComplete) {
      setCompletedSteps([0, 1, 2]);
      setTimeout(() => {
        onAnimationComplete?.();
      }, 1000);
      return;
    }

    const timers = [];
    
    timers.push(setTimeout(() => {
      setCompletedSteps([0]);
      setCurrentStep(1);
    }, 2000));

    timers.push(setTimeout(() => {
      setCompletedSteps([0, 1]);
      setCurrentStep(2);
    }, 4000));

    return () => timers.forEach(t => clearTimeout(t));
  }, [isComplete, onAnimationComplete]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
      </div>

      <div className="relative z-10 w-full max-w-lg">
        {/* StudyApp Branding */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-center gap-3 mb-8"
        >
          <img 
            src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68ffadbdd9532e7e7691129d/e6f13a569_LogoOnly.png"
            alt="StudyApp Logo"
            className="w-10 h-10"
          />
          <h1 className="text-3xl md:text-4xl font-black">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">Study</span>
            <span className="text-white">App</span>
          </h1>
        </motion.div>

        {/* Main content */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <h2 className="text-xl md:text-2xl font-bold text-white mb-2">
            Preparing your lesson...
          </h2>
          <p className="text-purple-200/70">
            This usually takes about 30 seconds
          </p>
        </motion.div>

        {/* Steps */}
        <div className="space-y-3 mb-8">
          {steps.map((step, idx) => {
            const isActive = currentStep === idx;
            const isCompleted = completedSteps.includes(idx);

            return (
              <motion.div
                key={step.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.1 }}
                className={`flex items-center gap-4 p-4 rounded-xl border transition-all ${
                  isCompleted 
                    ? 'bg-emerald-500/10 border-emerald-500/30' 
                    : isActive 
                      ? 'bg-purple-500/10 border-purple-500/30' 
                      : 'bg-slate-800/30 border-slate-700/30'
                }`}
              >
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl ${
                  isCompleted 
                    ? 'bg-emerald-500/20' 
                    : isActive 
                      ? 'bg-purple-500/20' 
                      : 'bg-slate-700/30'
                }`}>
                  {isCompleted ? (
                    <CheckCircle className="w-6 h-6 text-emerald-400" />
                  ) : (
                    step.emoji
                  )}
                </div>
                <div className="flex-1">
                  <p className={`font-medium ${
                    isCompleted ? 'text-emerald-300' : isActive ? 'text-white' : 'text-slate-400'
                  }`}>
                    {step.title}
                  </p>
                </div>
                {isActive && !isCompleted && (
                  <Loader2 className="w-5 h-5 text-purple-400 animate-spin" />
                )}
              </motion.div>
            );
          })}
        </div>

        {/* File indicator */}
        {fileName && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 flex items-center gap-3"
          >
            <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
              <FileText className="w-5 h-5 text-purple-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-medium truncate">{fileName}</p>
              <p className="text-slate-400 text-sm">Processing...</p>
            </div>
          </motion.div>
        )}

        {/* Footer */}
        <p className="text-center text-slate-500 text-xs mt-8">
          Powered by StudyApp.AI
        </p>
      </div>
    </div>
  );
}