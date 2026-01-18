import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TrendingUp } from 'lucide-react';

export default function TaskCompletionToast({ show, gradeIncrease = 2.5, onComplete }) {
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

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none"
        >
          <div className="relative bg-gradient-to-r from-emerald-500 to-teal-600 rounded-2xl shadow-2xl px-6 py-4 flex items-center gap-4">
            <motion.div
              initial={{ rotate: 0, scale: 1 }}
              animate={{ rotate: [0, -10, 10, 0], scale: [1, 1.2, 1] }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center"
            >
              <TrendingUp className="w-6 h-6 text-white" />
            </motion.div>
            
            <div className="text-white">
              <p className="text-sm font-medium opacity-90">Task Complete!</p>
              <div className="flex items-baseline gap-1">
                <motion.span
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="text-2xl font-black"
                >
                  +{gradeIncrease}%
                </motion.span>
                <span className="text-sm opacity-80">predicted grade</span>
              </div>
            </div>
            
            {/* Floating particles */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 1, 0] }}
              transition={{ duration: 1.5, delay: 0.2 }}
              className="absolute inset-0 pointer-events-none overflow-hidden rounded-2xl"
            >
              {[...Array(6)].map((_, i) => (
                <motion.div
                  key={i}
                  initial={{ 
                    x: Math.random() * 100, 
                    y: 50,
                    opacity: 0 
                  }}
                  animate={{ 
                    y: -30,
                    opacity: [0, 1, 0],
                    x: Math.random() * 200 - 50
                  }}
                  transition={{ 
                    duration: 1.2, 
                    delay: 0.3 + i * 0.1,
                    ease: "easeOut"
                  }}
                  className="absolute w-2 h-2 bg-yellow-300 rounded-full"
                />
              ))}
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}