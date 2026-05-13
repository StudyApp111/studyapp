import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

/**
 * Fast, high-fidelity feedback burst (~500ms).
 * Drop it anywhere — it self-cleans. Use the `trigger` prop to fire (increment a counter or pass `{intensity, label}` object).
 *
 * Variants:
 *   - intensity="small"  → quick coin pop  (flashcards "Good")
 *   - intensity="medium" → coin shower + ring flash (flashcards "Excellent", correct answer)
 *   - intensity="large"  → confetti + screen flash + scale punch (perfect score, badge unlock)
 */
export default function RewardBurst({ trigger, intensity = "medium", label = "+XP", xp }) {
  const [pulse, setPulse] = useState(0);

  useEffect(() => {
    if (trigger) setPulse((p) => p + 1);
  }, [trigger]);

  if (!pulse) return null;

  const particleCount = intensity === "small" ? 8 : intensity === "large" ? 22 : 14;
  const spread = intensity === "small" ? 60 : intensity === "large" ? 160 : 110;
  const duration = intensity === "large" ? 0.7 : 0.5;

  // Slot-machine palette: gold + purple + emerald sparkles
  const colors = ["#fbbf24", "#a855f7", "#10b981", "#f472b6", "#facc15"];

  return (
    <AnimatePresence>
      <motion.div
        key={pulse}
        className="pointer-events-none fixed inset-0 z-[200] flex items-center justify-center overflow-hidden"
        initial={{ opacity: 1 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        {/* Screen flash */}
        {intensity !== "small" && (
          <motion.div
            className="absolute inset-0 bg-gradient-radial from-yellow-300/30 via-purple-400/10 to-transparent"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.6, 0] }}
            transition={{ duration, ease: "easeOut" }}
          />
        )}

        {/* Expanding ring */}
        <motion.div
          className="absolute rounded-full border-4 border-yellow-300"
          style={{ width: 40, height: 40 }}
          initial={{ scale: 0, opacity: 0.9 }}
          animate={{ scale: intensity === "large" ? 14 : 9, opacity: 0 }}
          transition={{ duration, ease: "easeOut" }}
        />

        {/* Inner pulse disc */}
        <motion.div
          className="absolute rounded-full bg-gradient-to-br from-yellow-300 to-purple-500"
          style={{ width: 60, height: 60, filter: "blur(8px)" }}
          initial={{ scale: 0.4, opacity: 0.8 }}
          animate={{ scale: intensity === "large" ? 3 : 2, opacity: 0 }}
          transition={{ duration: duration * 0.8, ease: "easeOut" }}
        />

        {/* Particle shower */}
        {[...Array(particleCount)].map((_, i) => {
          const angle = (i / particleCount) * Math.PI * 2;
          const dist = spread * (0.6 + Math.random() * 0.4);
          const x = Math.cos(angle) * dist;
          const y = Math.sin(angle) * dist - 30; // slight upward bias
          const color = colors[i % colors.length];
          const size = 6 + Math.random() * 6;
          return (
            <motion.div
              key={i}
              className="absolute rounded-full"
              style={{ width: size, height: size, background: color, boxShadow: `0 0 8px ${color}` }}
              initial={{ x: 0, y: 0, scale: 0, opacity: 1 }}
              animate={{ x, y, scale: [0, 1.2, 0.6], opacity: [1, 1, 0] }}
              transition={{ duration, ease: "easeOut", delay: i * 0.005 }}
            />
          );
        })}

        {/* Center scale-punch label (only for medium/large) */}
        {intensity !== "small" && (
          <motion.div
            initial={{ scale: 0, rotate: -8, opacity: 0 }}
            animate={{ scale: [0, 1.25, 1], rotate: [-8, 0, 0], opacity: [0, 1, 1, 0] }}
            transition={{ duration, times: [0, 0.4, 0.7, 1], ease: "easeOut" }}
            className="relative"
          >
            <div className="bg-gradient-to-br from-yellow-300 via-amber-400 to-orange-500 text-slate-900 px-5 py-2.5 rounded-2xl shadow-2xl border-2 border-white/60">
              <div className="font-black text-2xl leading-none tracking-tight">
                {xp ? `+${xp} XP` : label}
              </div>
              {label && xp && (
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-800/80 mt-0.5">{label}</div>
              )}
            </div>
          </motion.div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}