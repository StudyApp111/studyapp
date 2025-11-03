import React, { useEffect } from "react";
import { motion } from "framer-motion";

export default function ConfettiEffect({ show, onComplete }) {
  useEffect(() => {
    if (show && onComplete) {
      const timer = setTimeout(onComplete, 3000);
      return () => clearTimeout(timer);
    }
  }, [show, onComplete]);

  if (!show) return null;

  const confettiPieces = Array.from({ length: 50 }, (_, i) => ({
    id: i,
    x: Math.random() * window.innerWidth,
    rotation: Math.random() * 360,
    color: ['#8B5CF6', '#FBBF24', '#F59E0B', '#A855F7', '#EC4899'][Math.floor(Math.random() * 5)],
    delay: Math.random() * 0.5
  }));

  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {confettiPieces.map((piece) => (
        <motion.div
          key={piece.id}
          initial={{
            x: piece.x,
            y: -20,
            rotate: 0,
            scale: 1
          }}
          animate={{
            y: window.innerHeight + 100,
            rotate: piece.rotation,
            scale: [1, 1.2, 0.8]
          }}
          transition={{
            duration: 2 + Math.random(),
            delay: piece.delay,
            ease: "easeIn"
          }}
          style={{
            position: 'absolute',
            width: '10px',
            height: '10px',
            backgroundColor: piece.color,
            borderRadius: '2px'
          }}
        />
      ))}
    </div>
  );
}