import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Zap, Star, Trophy, Flame } from "lucide-react";

export default function XPGainToast({ xpGained, reason, show, onComplete }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (show && xpGained > 0) {
      setVisible(true);
      const timer = setTimeout(() => {
        setVisible(false);
        onComplete?.();
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [show, xpGained]);

  const getIcon = () => {
    if (reason?.includes('streak')) return <Flame className="w-5 h-5 text-orange-500" />;
    if (reason?.includes('exam')) return <Trophy className="w-5 h-5 text-yellow-500" />;
    if (reason?.includes('perfect')) return <Star className="w-5 h-5 text-yellow-400 fill-yellow-400" />;
    return <Zap className="w-5 h-5 text-yellow-500" />;
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.9 }}
          className="fixed bottom-24 md:bottom-8 left-1/2 -translate-x-1/2 z-[100]"
        >
          <div className="bg-gradient-to-r from-yellow-400 to-amber-500 text-slate-900 px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3">
            <motion.div
              animate={{ rotate: [0, -10, 10, -10, 0], scale: [1, 1.2, 1] }}
              transition={{ duration: 0.5 }}
            >
              {getIcon()}
            </motion.div>
            <div>
              <motion.p
                initial={{ scale: 0.8 }}
                animate={{ scale: 1 }}
                className="text-lg font-bold"
              >
                +{xpGained} XP
              </motion.p>
              {reason && <p className="text-xs text-slate-700">{reason}</p>}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}