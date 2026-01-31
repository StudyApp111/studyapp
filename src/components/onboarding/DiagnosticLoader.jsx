import React, { useState, useEffect } from 'react';
import { Sparkles, Zap, BookOpen, Target } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const loadingMessages = [
  { icon: Sparkles, text: "Crafting your personalized quiz...", subtext: "Analyzing course requirements" },
  { icon: BookOpen, text: "Analyzing your profile...", subtext: "Matching questions to your level" },
  { icon: Target, text: "Selecting key concepts...", subtext: "Finding high-impact topics" },
  { icon: Zap, text: "Almost ready...", subtext: "Finalizing your diagnostic" }
];

const gradingMessages = [
  { icon: Sparkles, text: "Analyzing your answers...", subtext: "Evaluating your responses" },
  { icon: Target, text: "Calculating predicted grade...", subtext: "Using advanced AI algorithms" },
  { icon: BookOpen, text: "Identifying weak topics...", subtext: "Building your study plan" },
  { icon: Zap, text: "Almost ready...", subtext: "Preparing your report" }
];

export default function DiagnosticLoader({ mode = 'generating' }) {
  const [messageIndex, setMessageIndex] = useState(0);
  const [progress, setProgress] = useState(0);

  const messages = mode === 'grading' ? gradingMessages : loadingMessages;

  useEffect(() => {
    const messageInterval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % messages.length);
    }, 3000);

    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 95) return 95;
        return prev + 2;
      });
    }, 200);

    return () => {
      clearInterval(messageInterval);
      clearInterval(progressInterval);
    };
  }, [messages.length]);

  const currentMessage = messages[messageIndex];

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4">
      <div className="text-center space-y-8 max-w-md">
        {/* Brand logo - HIGHER UP */}
        <div className="mb-8">
          <h1 className="text-5xl md:text-6xl font-black mb-4">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">Study</span>
            <span className="text-white">App</span>
          </h1>
        </div>

        {/* Sleek animated icon with modern gradient orb */}
        <motion.div
          animate={{
            scale: [1, 1.05, 1],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          className="relative inline-block"
        >
          {/* Gradient orb background */}
          <div className="absolute inset-0 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full blur-3xl opacity-30 animate-pulse" />
          
          {/* Icon container */}
          <div className="relative w-24 h-24 mx-auto">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
              className="absolute inset-0 bg-gradient-to-br from-purple-600 to-pink-600 rounded-full opacity-20"
            />
            <currentMessage.icon 
              className="relative w-full h-full text-white p-5" 
              strokeWidth={1.5} 
            />
          </div>
        </motion.div>

        {/* Dynamic message with fade animation */}
        <AnimatePresence mode="wait">
          <motion.div
            key={messageIndex}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.4 }}
            className="space-y-2"
          >
            <p className="text-xl md:text-2xl font-bold text-white">{currentMessage.text}</p>
            <p className="text-slate-400 text-sm">{currentMessage.subtext}</p>
          </motion.div>
        </AnimatePresence>

        {/* Sleek progress bar */}
        <div className="w-full max-w-xs mx-auto space-y-2">
          <div className="h-2 bg-slate-800/50 rounded-full overflow-hidden backdrop-blur-sm">
            <motion.div
              className="h-full bg-gradient-to-r from-purple-500 via-purple-400 to-pink-500 rounded-full shadow-lg shadow-purple-500/50"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
          <p className="text-slate-500 text-xs font-medium">{progress}% complete</p>
        </div>

        {/* Subtle sparkle animations */}
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