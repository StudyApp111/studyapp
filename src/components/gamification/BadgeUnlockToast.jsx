import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy } from "lucide-react";

/**
 * Badge unlock celebration — purple/indigo theme to match the app.
 * Positioning:
 *   - Mobile: drops in from the top of the screen.
 *   - Desktop: pinned to the top header area (below the sticky lesson banner)
 *     so it feels embedded, not screen-spanning.
 * Shows ~3.5s then auto-dismisses.
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
          // Mobile: top-4. Desktop: top-14 so it nests just under the lesson header bar.
          className="fixed inset-x-0 top-4 md:top-14 z-[300] flex items-start justify-center pointer-events-none px-4"
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -30 }}
          transition={{ type: "spring", stiffness: 400, damping: 26 }}
        >
          <motion.div
            className="relative bg-gradient-to-br from-purple-600 via-indigo-600 to-pink-600 rounded-2xl shadow-2xl border border-white/20 px-4 py-3 flex items-center gap-3 max-w-sm w-full pointer-events-auto"
            animate={{ rotate: [-0.5, 0.5, -0.5, 0] }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            {/* Sparkle ring — soft purple */}
            {[...Array(8)].map((_, i) => {
              const angle = (i / 8) * Math.PI * 2;
              return (
                <motion.div
                  key={i}
                  className="absolute text-purple-200"
                  style={{ left: "50%", top: "50%", fontSize: 14 }}
                  initial={{ scale: 0, x: 0, y: 0, opacity: 0 }}
                  animate={{
                    scale: [0, 1, 0],
                    x: Math.cos(angle) * 90,
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
              className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center text-2xl flex-shrink-0 shadow-inner border border-white/30"
              animate={{ scale: [0, 1.25, 1], rotate: [0, 12, -12, 0] }}
              transition={{ duration: 0.6 }}
            >
              {badge.emoji || <Trophy className="w-6 h-6 text-white" />}
            </motion.div>

            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-black uppercase tracking-widest text-white/80">Badge Unlocked</p>
              <p className="text-base font-black text-white leading-tight">{badge.label}</p>
              <p className="text-xs text-white/80 leading-snug truncate">{badge.description}</p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}