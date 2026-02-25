import React, { useState, useEffect } from "react";
import ConfettiEffect from "./ConfettiEffect";

/**
 * Global listener for study plan task completion — shows full-screen confetti.
 * Place once in DocumentViewer.
 */
export default function TaskCompleteConfetti() {
  const [showConfetti, setShowConfetti] = useState(false);

  useEffect(() => {
    const handleTaskComplete = () => {
      setShowConfetti(true);
    };

    window.addEventListener('studyTaskCompleted', handleTaskComplete);
    return () => window.removeEventListener('studyTaskCompleted', handleTaskComplete);
  }, []);

  return (
    <ConfettiEffect
      show={showConfetti}
      onComplete={() => setShowConfetti(false)}
    />
  );
}