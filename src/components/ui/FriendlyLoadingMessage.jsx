import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Bot, Brain, Coffee, Search } from "lucide-react";

const messages = [
  { text: "Robots are reading your content... beep boop...", icon: Bot },
  { text: "Searching the entire internet... it's a big place!", icon: Search },
  { text: "Brewing some fresh knowledge just for you...", icon: Coffee },
  { text: "Untangling the web of wisdom...", icon: Sparkles },
  { text: "Convincing the AI to share its secrets...", icon: Brain },
  { text: "Generating genius takes a moment...", icon: Sparkles },
  { text: "Calculating the meaning of life... and your grades...", icon: Bot },
  { text: "Still working... this must be a tough one!", icon: Coffee },
  { text: "Almost there! Just polishing the pixels...", icon: Sparkles },
];

export default function FriendlyLoadingMessage({ showAfter = 30000 }) {
  const [isVisible, setIsVisible] = useState(false);
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0);

  useEffect(() => {
    const showTimer = setTimeout(() => {
      setIsVisible(true);
    }, showAfter);

    return () => clearTimeout(showTimer);
  }, [showAfter]);

  useEffect(() => {
    if (!isVisible) return;

    const rotateTimer = setInterval(() => {
      setCurrentMessageIndex((prev) => (prev + 1) % messages.length);
    }, 6000);

    return () => clearInterval(rotateTimer);
  }, [isVisible]);

  if (!isVisible) return null;

  const CurrentIcon = messages[currentMessageIndex].icon;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={currentMessageIndex}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.5 }}
        className="mt-6 flex flex-col items-center text-center space-y-2 p-4 rounded-xl bg-white/50 backdrop-blur-sm border border-purple-100 shadow-sm max-w-md mx-auto"
      >
        <div className="p-2 bg-purple-100 rounded-full text-purple-600">
          <CurrentIcon className="w-5 h-5 animate-bounce" />
        </div>
        <p className="text-sm font-medium text-slate-600">
          {messages[currentMessageIndex].text}
        </p>
      </motion.div>
    </AnimatePresence>
  );
}