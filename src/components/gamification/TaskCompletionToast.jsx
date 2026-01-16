import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { TrendingUp, Sparkles } from "lucide-react";

export default function TaskCompletionToast({ show, onComplete, taskType }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (show) {
      setVisible(true);
      const timer = setTimeout(() => {
        setVisible(false);
        onComplete?.();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [show, onComplete]);

  const getTaskLabel = () => {
    switch (taskType) {
      case 'flashcards': return 'Flashcard Task';
      case 'teach_it': return 'Teach It Task';
      case 'practice_exam': return 'Practice Quiz';
      case 'review_notes': return 'Notes Review';
      default: return 'Study Task';
    }
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: -50, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -30, scale: 0.9 }}
          transition={{ type: "spring", damping: 20, stiffness: 300 }}
          className="fixed top-20 left-1/2 -translate-x-1/2 z-[100]"
        >
          <div className="bg-gradient-to-r from-emerald-500 to-teal-600 rounded-2xl shadow-2xl px-6 py-4 flex items-center gap-4">
            {/* Icon */}
            <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-white" />
            </div>
            
            {/* Content */}
            <div className="text-left">
              <div className="flex items-center gap-2 mb-1">
                <Sparkles className="w-4 h-4 text-yellow-300" />
                <span className="text-white/80 text-xs font-semibold uppercase tracking-wide">
                  {getTaskLabel()} Complete!
                </span>
              </div>
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", delay: 0.2, damping: 15 }}
                className="flex items-baseline gap-1"
              >
                <span className="text-3xl font-black text-white">+2.5%</span>
                <span className="text-white/70 text-sm font-medium">predicted grade</span>
              </motion.div>
            </div>
            
            {/* Floating particles */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-2xl">
              {[...Array(6)].map((_, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ 
                    opacity: [0, 1, 0], 
                    y: [-10, -40],
                    x: [0, (i % 2 === 0 ? 1 : -1) * (10 + i * 5)]
                  }}
                  transition={{ 
                    duration: 1.5, 
                    delay: 0.3 + i * 0.1,
                    ease: "easeOut"
                  }}
                  className="absolute bottom-4"
                  style={{ left: `${15 + i * 15}%` }}
                >
                  <Sparkles className="w-3 h-3 text-yellow-300" />
                </motion.div>
              ))}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}