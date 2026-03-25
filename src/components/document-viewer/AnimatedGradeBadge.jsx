import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { TrendingUp } from "lucide-react";

export default function AnimatedGradeBadge({ grade }) {
  const [bounceKey, setBounceKey] = useState(0);
  const [showArrow, setShowArrow] = useState(false);

  useEffect(() => {
    const handleActivity = () => {
      setBounceKey((k) => k + 1);
      setShowArrow(true);
      const timer = setTimeout(() => setShowArrow(false), 2000);
      return () => clearTimeout(timer);
    };

    window.addEventListener("studyActivityCompleted", handleActivity);
    return () => window.removeEventListener("studyActivityCompleted", handleActivity);
  }, []);

  return (
    <div className="flex items-center gap-2 relative">
      <span className="text-white/70 text-xs font-medium">Grade:</span>
      <motion.span
        key={bounceKey}
        initial={bounceKey > 0 ? { y: 0, scale: 1 } : false}
        animate={
          bounceKey > 0
            ? {
                y: [0, -6, 0, -3, 0],
                scale: [1, 1.15, 1, 1.08, 1],
              }
            : {}
        }
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="text-white text-xl font-bold tracking-tight"
      >
        {grade || "—"}
      </motion.span>

      <AnimatePresence>
        {showArrow && grade && grade !== "—" && (
          <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.5 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.5 }}
            transition={{ duration: 0.3 }}
            className="absolute -right-5 -top-1"
          >
            <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}