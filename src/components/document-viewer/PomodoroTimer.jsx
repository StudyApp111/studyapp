import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Coffee, X } from "lucide-react";

export default function PomodoroTimer({ elapsedSeconds, onBreakComplete }) {
  const [showBreakPrompt, setShowBreakPrompt] = useState(false);
  const [isOnBreak, setIsOnBreak] = useState(false);
  const [breakTimeLeft, setBreakTimeLeft] = useState(300); // 5 minutes in seconds
  const [hasPromptedAt20, setHasPromptedAt20] = useState(false);

  useEffect(() => {
    // Show break prompt every 20 minutes
    if (elapsedSeconds > 0 && elapsedSeconds % 1200 === 0) {
      const currentInterval = Math.floor(elapsedSeconds / 1200);
      if (!hasPromptedAt20 || currentInterval !== Math.floor((elapsedSeconds - 1) / 1200)) {
        setShowBreakPrompt(true);
        setHasPromptedAt20(true);
      }
    }
  }, [elapsedSeconds]);

  useEffect(() => {
    let interval;
    if (isOnBreak) {
      interval = setInterval(() => {
        setBreakTimeLeft(prev => {
          if (prev <= 1) {
            setIsOnBreak(false);
            setShowBreakPrompt(false);
            onBreakComplete?.();
            return 300;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isOnBreak]);

  const handleStartBreak = () => {
    setIsOnBreak(true);
    setBreakTimeLeft(300);
  };

  const handleSkipBreak = () => {
    setShowBreakPrompt(false);
    setIsOnBreak(false);
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <Dialog open={showBreakPrompt || isOnBreak} onOpenChange={(open) => !open && handleSkipBreak()}>
      <DialogContent className="max-w-[280px] w-[calc(100%-2rem)] mx-auto rounded-2xl p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-full flex items-center justify-center flex-shrink-0">
            <Coffee className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-bold text-slate-900">
              {isOnBreak ? "Break Time!" : "Take a Break?"}
            </h2>
            <p className="text-[11px] text-slate-500 leading-snug">
              {isOnBreak 
                ? "Refresh your mind!" 
                : "20 min passed. A break helps focus."}
            </p>
          </div>
        </div>

        {isOnBreak ? (
          <div className="space-y-3">
            <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl p-4 border border-emerald-200">
              <div className="text-center">
                <p className="text-[10px] font-medium text-slate-500 mb-1">Time Remaining</p>
                <div className="text-3xl font-bold text-emerald-600 font-mono tracking-tight">
                  {formatTime(breakTimeLeft)}
                </div>
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5">
              <p className="text-[11px] text-amber-800">
                💡 Stand up, stretch, or walk!
              </p>
            </div>

            <Button
              onClick={handleSkipBreak}
              variant="outline"
              className="w-full h-9 text-sm"
            >
              End Break Early
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <Button
              onClick={handleStartBreak}
              className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 h-10 text-sm"
            >
              <Coffee className="w-4 h-4 mr-1.5" />
              Take 5 min Break
            </Button>
            <Button
              onClick={handleSkipBreak}
              variant="outline"
              className="w-full h-9 text-sm"
            >
              Keep Studying
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}