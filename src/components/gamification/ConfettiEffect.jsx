import React, { useEffect, useMemo } from "react";
import { motion } from "framer-motion";

export default function ConfettiEffect({ show, onComplete, containerRef }) {
  useEffect(() => {
    if (show && onComplete) {
      const timer = setTimeout(onComplete, 3500); // Increased duration
      return () => clearTimeout(timer);
    }
  }, [show, onComplete]);

  // Randomly select animation type
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
      default: // confetti
        return {
          count: 50,
          shapes: ['▪', '▫', '●', '■'],
          colors: ['#8B5CF6', '#FBBF24', '#F59E0B', '#A855F7', '#EC4899', '#10B981']
        };
    }
  };

  const config = getParticleConfig();
  
  const particles = Array.from({ length: config.count }, (_, i) => {
    const isEmoji = config.shapes[0].length > 1; // Emojis are longer than geometric shapes
    
    return {
      id: i,
      shape: config.shapes[Math.floor(Math.random() * config.shapes.length)],
      color: config.colors[Math.floor(Math.random() * config.colors.length)],
      // Random starting position across width
      startX: Math.random() * 100,
      // Random end position with more spread
      endX: (Math.random() * 100),
      // Random rotation
      startRotation: Math.random() * 360,
      endRotation: Math.random() * 720 + 360,
      // Random delay for staggered effect
      delay: Math.random() * 0.3,
      // Random duration between 2-3.5 seconds
      duration: 2 + Math.random() * 1.5,
      // Random size
      size: isEmoji ? (16 + Math.random() * 8) : (8 + Math.random() * 6),
      // Random horizontal drift
      drift: (Math.random() - 0.5) * 50,
      isEmoji
    };
  });

  return (
    <div 
      className="absolute inset-0 pointer-events-none overflow-hidden"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 30
      }}
    >
      {particles.map((particle) => (
        <motion.div
          key={particle.id}
          initial={{
            x: `${particle.startX}%`,
            y: -30,
            rotate: particle.startRotation,
            scale: 1,
            opacity: 1
          }}
          animate={{
            x: [`${particle.startX}%`, `${particle.startX + particle.drift}%`, `${particle.endX}%`],
            y: ['0%', '50%', '120%'],
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
            position: 'absolute',
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
      
      {/* Success pulse overlay */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: [0, 0.15, 0], scale: [0.8, 1.2, 1.5] }}
        transition={{ duration: 1, ease: "easeOut" }}
        className="absolute inset-0 bg-gradient-to-br from-purple-500/20 to-yellow-500/20 rounded-xl"
      />
    </div>
  );
}