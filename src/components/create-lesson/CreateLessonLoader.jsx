import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { FileText, ListChecks, Sparkles, CheckCircle, Loader2 } from "lucide-react";

const steps = [
  {
    id: "analyzing",
    title: "Analyzing your material",
    icon: FileText,
    color: "purple"
  },
  {
    id: "curriculum",
    title: "Creating curriculum map",
    icon: ListChecks,
    color: "indigo"
  },
  {
    id: "generating",
    title: "Generating study tools",
    icon: Sparkles,
    color: "amber"
  }
];

export default function CreateLessonLoader({ fileName, isComplete, onAnimationComplete }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState([]);

  useEffect(() => {
    if (isComplete) {
      // Mark all steps as complete
      setCompletedSteps([0, 1, 2]);
      setTimeout(() => {
        onAnimationComplete?.();
      }, 1000);
      return;
    }

    // Animate through steps
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

  const colorClasses = {
    purple: "from-purple-500 to-purple-600",
    indigo: "from-indigo-500 to-indigo-600",
    amber: "from-amber-500 to-amber-600"
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-600 via-indigo-600 to-purple-700 flex items-center justify-center p-4">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-white/5 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-400/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
      </div>

      <div className="relative z-10 w-full max-w-lg">
        {/* Main content */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">
            Preparing your material...
          </h1>
          <p className="text-white/70">
            This usually takes about 30 seconds
          </p>
        </motion.div>

        {/* Cards container */}
        <div className="grid grid-cols-3 gap-3 mb-8">
          {steps.map((step, idx) => {
            const isActive = currentStep === idx;
            const isCompleted = completedSteps.includes(idx);
            const Icon = step.icon;

            return (
              <motion.div
                key={step.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
                className={`bg-white rounded-xl p-4 shadow-xl transition-all duration-300 ${
                  isActive ? 'ring-2 ring-white/50 scale-105' : ''
                } ${isCompleted ? 'bg-opacity-100' : 'bg-opacity-95'}`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${colorClasses[step.color]} flex items-center justify-center`}>
                    <Icon className="w-4 h-4 text-white" />
                  </div>
                  {isCompleted ? (
                    <CheckCircle className="w-5 h-5 text-emerald-500" />
                  ) : isActive ? (
                    <Loader2 className="w-5 h-5 text-purple-500 animate-spin" />
                  ) : (
                    <div className="w-5 h-5 rounded-full border-2 border-slate-200" />
                  )}
                </div>
                <p className="text-xs font-medium text-slate-700 leading-tight">
                  {step.title}
                </p>
                
                {/* Animated progress lines */}
                <div className="mt-3 space-y-1.5">
                  {[0, 1, 2].map((lineIdx) => (
                    <motion.div
                      key={lineIdx}
                      className={`h-1.5 rounded-full ${
                        isCompleted || (isActive && lineIdx <= currentStep)
                          ? 'bg-slate-200'
                          : 'bg-slate-100'
                      }`}
                      initial={{ width: '30%' }}
                      animate={{ 
                        width: isCompleted ? '100%' : isActive ? `${40 + lineIdx * 20}%` : '30%' 
                      }}
                      transition={{ 
                        duration: 0.5, 
                        delay: isActive ? lineIdx * 0.2 : 0 
                      }}
                    />
                  ))}
                </div>
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
            className="bg-white/10 backdrop-blur-sm rounded-xl p-4 flex items-center gap-3"
          >
            <div className="w-10 h-10 rounded-lg bg-amber-500 flex items-center justify-center">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-medium truncate">{fileName}</p>
              <p className="text-white/60 text-sm">Processing...</p>
            </div>
          </motion.div>
        )}

        {/* Powered by */}
        <p className="text-center text-white/40 text-xs mt-8">
          Powered by StudyApp.AI
        </p>
      </div>
    </div>
  );
}