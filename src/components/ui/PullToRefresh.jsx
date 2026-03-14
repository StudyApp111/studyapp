import React, { useState, useRef, useEffect } from 'react';
import { Loader2, ArrowDown } from 'lucide-react';

export default function PullToRefresh({ onRefresh, children, isDark }) {
  const [startY, setStartY] = useState(0);
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const containerRef = useRef(null);

  const maxPull = 100;
  const threshold = 60;

  const handleTouchStart = (e) => {
    if (window.scrollY <= 0 && !refreshing) {
      setStartY(e.touches[0].clientY);
    } else {
      setStartY(0);
    }
  };

  const handleTouchMove = (e) => {
    if (startY === 0 || refreshing) return;
    
    const currentY = e.touches[0].clientY;
    const distance = currentY - startY;
    
    if (distance > 0 && window.scrollY <= 0) {
      // We are pulling down at the top of the page
      // Add resistance
      const resisted = distance * 0.4;
      setPullDistance(Math.min(resisted, maxPull));
    }
  };

  const handleTouchEnd = async () => {
    if (startY === 0 || refreshing) return;
    
    if (pullDistance >= threshold) {
      setRefreshing(true);
      setPullDistance(50); // Hold at 50px while refreshing
      try {
        await onRefresh();
      } finally {
        setRefreshing(false);
        setPullDistance(0);
      }
    } else {
      setPullDistance(0);
    }
    setStartY(0);
  };

  return (
    <div 
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className="min-h-screen w-full relative"
    >
      <div 
        className="absolute top-0 left-0 right-0 flex justify-center items-end overflow-hidden transition-all duration-200 ease-out z-[100] pointer-events-none"
        style={{ height: `${pullDistance}px`, opacity: pullDistance > 10 ? 1 : 0 }}
      >
        <div className={`mb-4 rounded-full p-2 shadow-md ${isDark ? 'bg-slate-800 text-purple-400' : 'bg-white text-purple-600'} transition-transform ${pullDistance >= threshold ? 'scale-110' : 'scale-100'}`}>
          {refreshing ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <ArrowDown className="w-5 h-5" style={{ transform: `rotate(${Math.min((pullDistance / threshold) * 180, 180)}deg)` }} />
          )}
        </div>
      </div>
      <div 
        className="transition-transform duration-200 ease-out w-full h-full"
        style={{ transform: `translateY(${refreshing ? 50 : pullDistance}px)` }}
      >
        {children}
      </div>
    </div>
  );
}