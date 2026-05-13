import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy } from "lucide-react";

/**
 * Dramatic badge unlock celebration. Shows for ~3.5s then auto-dismisses.
 * Pass a badge object: { id, label, description, emoji }
 */
export default function BadgeUnlockToast({ badge, onComplete }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (badge) {
      setVisible(true);
      const t = setTimeout(() => {
        setVisible(false);
        onComplete?.();
      }, 3500);
      return () => clearTimeout(t);
    }
  }, [badge?.id]);

  if (!badge) return null;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="fixed inset-x-0 top-20 z-[300] flex items-start justify-center pointer-events-none px-4"
          initial={{ opacity: 0, y: -40 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -40 }}
          transition={{ type: "spring", stiffness: 400, damping: 24 }}
        >
          <motion.div
            className="relative bg-gradient-to-br from-amber-400 via-yellow-400 to-orange-500 rounded-2xl shadow-2xl border-2 border-white/60 px-5 py-4 flex items-center gap-3 max-w-sm w-full pointer-events-auto"
            animate={{ rotate: [-1, 1, -1, 0] }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            {/* Sparkle ring */}
            {[...Array(8)].map((_, i) => {
              const angle = (i / 8) * Math.PI * 2;
              return (
                <motion.div
                  key={i}
                  className="absolute text-yellow-200"
                  style={{ left: "50%", top: "50%", fontSize: 14 }}
                  initial={{ scale: 0, x: 0, y: 0, opacity: 0 }}
                  animate={{
                    scale: [0, 1, 0],
                    x: Math.cos(angle) * 80,
                    y: Math.sin(angle) * 50,
                    opacity: [0, 1, 0],
                  }}
                  transition={{ duration: 1.2, delay: 0.2 + i * 0.05 }}
                >
                  ✨
                </motion.div>
              );
            })}

            <motion.div
              className="w-14 h-14 rounded-2xl bg-white/30 backdrop-blur-sm flex items-center justify-center text-3xl flex-shrink-0 shadow-inner border border-white/50"
              animate={{ scale: [0, 1.3, 1], rotate: [0, 15, -15, 0] }}
              transition={{ duration: 0.6 }}
            >
              {badge.emoji || <Trophy className="w-7 h-7 text-white" />}
            </motion.div>

            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-900/70">Badge Unlocked</p>
              <p className="text-lg font-black text-slate-900 leading-tight">{badge.label}</p>
              <p className="text-xs text-slate-800/80 leading-snug">{badge.description}</p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}