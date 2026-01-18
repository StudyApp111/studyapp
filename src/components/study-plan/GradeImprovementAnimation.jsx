import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { TrendingUp, Sparkles } from "lucide-react";

export default function GradeImprovementAnimation({ show, improvement = 2.5, onComplete }) {
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
  }, [show]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none"
        >
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.5, opacity: 0 }}
            transition={{ type: "spring", damping: 15 }}
            className="bg-gradient-to-br from-emerald-500 to-teal-600 text-white px-8 py-6 rounded-3xl shadow-2xl flex flex-col items-center gap-3"
          >
            <motion.div
              animate={{ 
                rotate: [0, -10, 10, -10, 10, 0],
                scale: [1, 1.1, 1.1, 1.1, 1.1, 1]
              }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              <TrendingUp className="w-12 h-12 text-yellow-300" />
            </motion.div>
            
            <div className="text-center">
              <motion.p
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="text-sm font-medium text-emerald-100"
              >
                Predicted Grade Boost
              </motion.p>
              <motion.p
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.4, type: "spring" }}
                className="text-4xl font-black"
              >
                +{improvement}%
              </motion.p>
            </div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="flex items-center gap-2 bg-white/20 rounded-full px-4 py-2"
            >
              <Sparkles className="w-4 h-4 text-yellow-300" />
              <span className="text-xs font-semibold">Task Complete!</span>
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}