import React, { useState, useEffect } from 'react';
import { Sparkles, Zap, BookOpen, Target } from 'lucide-react';

const loadingMessages = [
  { icon: Sparkles, text: "Crafting your personalized quiz..." },
  { icon: BookOpen, text: "Analyzing your profile..." },
  { icon: Target, text: "Selecting key concepts..." },
  { icon: Zap, text: "Almost ready..." }
];

const gradingMessages = [
  { icon: Sparkles, text: "Analyzing your answers..." },
  { icon: Target, text: "Calculating predicted grade..." },
  { icon: BookOpen, text: "Identifying weak topics..." },
  { icon: Zap, text: "Almost ready..." }
];

export default function DiagnosticLoader({ mode = 'generating' }) {
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0);
  const [progress, setProgress] = useState(0);

  const messages = mode === 'grading' ? gradingMessages : loadingMessages;

  useEffect(() => {
    // Cycle through messages every 3 seconds
    const messageInterval = setInterval(() => {
      setCurrentMessageIndex((prev) => (prev + 1) % messages.length);
    }, 3000);

    // Progress bar animation
    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 95) return 95; // Cap at 95% until actual completion
        return prev + 1;
      });
    }, 150);

    return () => {
      clearInterval(messageInterval);
      clearInterval(progressInterval);
    };
  }, [messages.length]);

  const CurrentIcon = messages[currentMessageIndex].icon;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md text-center">
        {/* StudyApp Branding - Larger and Higher */}
        <div className="mb-12 -mt-20">
          <h1 className="text-4xl md:text-5xl font-black">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">Study</span>
            <span className="text-white">App</span>
          </h1>
        </div>

        {/* Animated Icon */}
        <div className="relative mb-8">
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-32 h-32 bg-purple-500/20 rounded-full animate-pulse" />
          </div>
          <div className="relative flex items-center justify-center">
            <CurrentIcon className="w-16 h-16 text-purple-400 animate-bounce" />
          </div>
        </div>

        {/* Message */}
        <h2 className="text-2xl md:text-3xl font-bold text-white mb-2 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {messages[currentMessageIndex].text}
        </h2>

        {/* Progress Bar */}
        <div className="mt-8 mx-auto max-w-sm">
          <div className="h-2 bg-slate-700/50 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-purple-300 text-sm mt-3">{Math.round(progress)}%</p>
        </div>

        {/* Sparkle effects */}
        <div className="mt-8 flex justify-center gap-2">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="w-2 h-2 bg-purple-400 rounded-full animate-pulse"
              style={{ animationDelay: `${i * 200}ms` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}