import React, { useEffect, useMemo } from "react";
import { motion } from "framer-motion";

export default function ConfettiEffect({ show, onComplete }) {
  useEffect(() => {
    if (show && onComplete) {
      const timer = setTimeout(onComplete, 3500);
      return () => clearTimeout(timer);
    }
  }, [show, onComplete]);

  const animationType = useMemo(() => {
    const types = ['confetti', 'stars', 'sparkles', 'hearts'];
    return types[Math.floor(Math.random() * types.length)];
  }, [show]);

  if (!show) return null;

  const getParticleConfig = () => {
    switch (animationType) {
      case 'stars':
        return {
          count: 30,
          shapes: ['⭐', '✨', '🌟'],
          colors: ['#FFD700', '#FFA500', '#FF69B4', '#00CED1']
        };
      case 'sparkles':
        return {
          count: 40,
          shapes: ['✨', '💫', '⚡', '🌈'],
          colors: ['#8B5CF6', '#EC4899', '#F59E0B', '#10B981']
        };
      case 'hearts':
        return {
          count: 25,
          shapes: ['💜', '💛', '🧡', '💚'],
          colors: ['#8B5CF6', '#FBBF24', '#F59E0B', '#10B981']
        };
      default:
        return {
          count: 50,
          shapes: ['▪', '▫', '●', '■'],
          colors: ['#8B5CF6', '#FBBF24', '#F59E0B', '#A855F7', '#EC4899', '#10B981']
        };
    }
  };

  const config = getParticleConfig();
  
  const particles = Array.from({ length: config.count }, (_, i) => {
    const isEmoji = config.shapes[0].length > 1;
    
    return {
      id: i,
      shape: config.shapes[Math.floor(Math.random() * config.shapes.length)],
      color: config.colors[Math.floor(Math.random() * config.colors.length)],
      startX: Math.random() * 100,
      endX: (Math.random() * 100),
      startRotation: Math.random() * 360,
      endRotation: Math.random() * 720 + 360,
      delay: Math.random() * 0.3,
      duration: 2 + Math.random() * 1.5,
      size: isEmoji ? (16 + Math.random() * 8) : (8 + Math.random() * 6),
      drift: (Math.random() - 0.5) * 50,
      isEmoji
    };
  });

  return (
    <div 
      className="fixed inset-0 pointer-events-none overflow-hidden z-50"
    >
      {particles.map((particle) => (
        <motion.div
          key={particle.id}
          initial={{
            x: `${particle.startX}vw`,
            y: -30,
            rotate: particle.startRotation,
            scale: 1,
            opacity: 1
          }}
          animate={{
            x: [`${particle.startX}vw`, `${particle.startX + particle.drift * 0.5}vw`, `${particle.endX}vw`],
            y: ['-10vh', '50vh', '120vh'],
            rotate: particle.endRotation,
            scale: [1, 1.2, 0.8, 0.6],
            opacity: [1, 1, 0.8, 0]
          }}
          transition={{
            duration: particle.duration,
            delay: particle.delay,
            ease: "easeIn",
            times: [0, 0.3, 0.7, 1]
          }}
          style={{
            position: 'fixed',
            fontSize: particle.isEmoji ? `${particle.size}px` : undefined,
            width: particle.isEmoji ? 'auto' : `${particle.size}px`,
            height: particle.isEmoji ? 'auto' : `${particle.size}px`,
            backgroundColor: particle.isEmoji ? 'transparent' : particle.color,
            color: particle.isEmoji ? particle.color : undefined,
            borderRadius: particle.shape === '●' ? '50%' : '2px',
          }}
        >
          {particle.isEmoji ? particle.shape : ''}
        </motion.div>
      ))}
      
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: [0, 0.15, 0], scale: [0.8, 1.2, 1.5] }}
        transition={{ duration: 1, ease: "easeOut" }}
        className="fixed inset-0 bg-gradient-to-br from-purple-500/20 to-yellow-500/20 pointer-events-none"
      />
    </div>
  );
}