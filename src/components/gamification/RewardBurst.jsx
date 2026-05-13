import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

/**
 * High-fidelity feedback burst (~1s) — purple/indigo/pink palette to match the app theme.
 * Scoped to its PARENT container (use absolute, not fixed). The parent must be `position: relative`.
 *
 * Variants:
 *   - "small"  → quick pop, no label  (subtle wins)
 *   - "medium" → coin shower + ring flash + label
 *   - "large"  → confetti + glow + ring + label
 *
 * Usage:
 *   <div className="relative">
 *     <RewardBurst trigger={counter} intensity="medium" xp={10} label="Got it!" />
 *     ...
 *   </div>
 */
export default function RewardBurst({ trigger, intensity = "medium", label = "+XP", xp }) {
  const [pulse, setPulse] = useState(0);

  useEffect(() => {
    if (trigger) setPulse((p) => p + 1);
  }, [trigger]);

  if (!pulse) return null;

  const particleCount = intensity === "small" ? 10 : intensity === "large" ? 26 : 16;
  const spread = intensity === "small" ? 70 : intensity === "large" ? 180 : 130;
  const duration = intensity === "large" ? 1.2 : 1.0;

  // Purple → indigo → pink palette (matches app theme — no more gold).
  const colors = ["#a855f7", "#8b5cf6", "#6366f1", "#ec4899", "#c084fc", "#f472b6"];

  return (
    <AnimatePresence>
      <motion.div
        key={pulse}
        className="pointer-events-none absolute inset-0 z-[80] flex items-center justify-center overflow-hidden"
        initial={{ opacity: 1 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        {/* Soft radial glow — purple/pink, fades over the full duration */}
        {intensity !== "small" && (
          <motion.div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(circle at center, rgba(168,85,247,0.35) 0%, rgba(99,102,241,0.15) 35%, transparent 70%)",
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.7, 0] }}
            transition={{ duration, ease: "easeOut" }}
          />
        )}

        {/* Expanding ring — purple */}
        <motion.div
          className="absolute rounded-full border-4"
          style={{ width: 40, height: 40, borderColor: "#a855f7" }}
          initial={{ scale: 0, opacity: 0.9 }}
          animate={{ scale: intensity === "large" ? 14 : 9, opacity: 0 }}
          transition={{ duration, ease: "easeOut" }}
        />

        {/* Inner pulse disc */}
        <motion.div
          className="absolute rounded-full"
          style={{
            width: 60,
            height: 60,
            background: "linear-gradient(135deg, #a855f7 0%, #6366f1 100%)",
            filter: "blur(10px)",
          }}
          initial={{ scale: 0.4, opacity: 0.8 }}
          animate={{ scale: intensity === "large" ? 3 : 2, opacity: 0 }}
          transition={{ duration: duration * 0.85, ease: "easeOut" }}
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
              style={{ width: size, height: size, background: color, boxShadow: `0 0 10px ${color}` }}
              initial={{ x: 0, y: 0, scale: 0, opacity: 1 }}
              animate={{ x, y, scale: [0, 1.3, 0.4], opacity: [1, 1, 0] }}
              transition={{ duration, ease: "easeOut", delay: i * 0.005 }}
            />
          );
        })}

        {/* Center scale-punch label */}
        {intensity !== "small" && (
          <motion.div
            initial={{ scale: 0, rotate: -8, opacity: 0 }}
            animate={{ scale: [0, 1.25, 1, 1], rotate: [-8, 0, 0, 0], opacity: [0, 1, 1, 0] }}
            transition={{ duration, times: [0, 0.25, 0.7, 1], ease: "easeOut" }}
            className="relative"
          >
            <div className="bg-gradient-to-br from-purple-500 via-indigo-500 to-pink-500 text-white px-5 py-2.5 rounded-2xl shadow-2xl border-2 border-white/30">
              <div className="font-black text-2xl leading-none tracking-tight">
                {xp ? `+${xp} XP` : label}
              </div>
              {label && xp && (
                <div className="text-[10px] font-bold uppercase tracking-wider text-white/80 mt-0.5">{label}</div>
              )}
            </div>
          </motion.div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}