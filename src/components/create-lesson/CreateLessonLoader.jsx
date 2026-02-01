import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FileText, ListChecks, Sparkles, Loader2 } from "lucide-react";

const loadingMessages = [
  { icon: Sparkles, text: "Analyzing your material...", subtext: "Processing content" },
  { icon: ListChecks, text: "Mapping curriculum...", subtext: "Building knowledge structure" },
  { icon: Sparkles, text: "Creating your diagnostic...", subtext: "Generating questions" }
];

export default function CreateLessonLoader({ fileName, isComplete, onAnimationComplete, stepStatuses }) {
  const [messageIndex, setMessageIndex] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const messageInterval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % loadingMessages.length);
    }, 3000);

    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 90) return Math.min(Math.round(prev + 0.5), 95);
        if (prev >= 70) return Math.round(prev + 1);
        return Math.round(prev + 2);
      });
    }, 200);

    return () => {
      clearInterval(messageInterval);
      clearInterval(progressInterval);
    };
  }, []);

  useEffect(() => {
    if (isComplete) {
      setProgress(100);
      setTimeout(() => {
        onAnimationComplete?.();
      }, 800);
    }
  }, [isComplete, onAnimationComplete]);

  const currentMessage = loadingMessages[messageIndex];

  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center dark:bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 bg-gradient-to-br from-slate-50 via-purple-50 to-slate-100 p-4 z-50">
      <div className="text-center space-y-8 max-w-md">
        {/* Brand logo */}
        <div className="mb-8">
          <h1 className="text-5xl md:text-6xl font-black mb-4">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">Study</span>
            <span className="dark:text-white text-slate-900">App</span>
          </h1>
        </div>

        {/* Animated icon */}
        <motion.div
          animate={{ scale: [1, 1.05, 1] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          className="relative inline-block"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full blur-3xl opacity-30 animate-pulse" />
          <div className="relative w-24 h-24 mx-auto">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
              className="absolute inset-0 bg-gradient-to-br from-purple-600 to-pink-600 rounded-full opacity-20"
            />
            <currentMessage.icon 
              className="relative w-full h-full dark:text-white text-slate-800 p-5" 
              strokeWidth={1.5} 
            />
          </div>
        </motion.div>

        {/* Dynamic message */}
        <AnimatePresence mode="wait">
          <motion.div
            key={messageIndex}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.4 }}
            className="space-y-2"
          >
            <p className="text-xl md:text-2xl font-bold dark:text-white text-slate-900">{currentMessage.text}</p>
            <p className="dark:text-slate-400 text-slate-600 text-sm">{currentMessage.subtext}</p>
          </motion.div>
        </AnimatePresence>

        {/* Progress bar */}
        <div className="w-full max-w-xs mx-auto space-y-2">
          <div className="h-2 dark:bg-slate-800/50 bg-slate-300/50 rounded-full overflow-hidden backdrop-blur-sm">
            <motion.div
              className="h-full bg-gradient-to-r from-purple-500 via-purple-400 to-pink-500 rounded-full shadow-lg shadow-purple-500/50"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
          <p className="dark:text-slate-500 text-slate-600 text-xs font-medium">{progress}% complete</p>
        </div>

        {/* File name */}
        {fileName && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="dark:bg-slate-800/50 bg-white/80 border dark:border-slate-700/50 border-slate-300/50 rounded-xl p-4 flex items-center gap-3 max-w-full overflow-hidden backdrop-blur-sm"
          >
            <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center flex-shrink-0">
              <FileText className="w-5 h-5 text-purple-400" />
            </div>
            <div className="flex-1 min-w-0 overflow-hidden">
              <p className="dark:text-white text-slate-900 font-medium text-sm break-words" style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}>{fileName}</p>
              <p className="dark:text-slate-400 text-slate-600 text-sm">Processing...</p>
            </div>
          </motion.div>
        )}

        {/* Sparkle animations */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {[...Array(6)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-1.5 h-1.5 bg-gradient-to-br from-purple-400 to-pink-400 rounded-full"
              style={{
                left: `${20 + i * 15}%`,
                top: `${30 + (i % 3) * 20}%`,
              }}
              animate={{
                opacity: [0, 1, 0],
                scale: [0, 1.5, 0],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                delay: i * 0.3,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}