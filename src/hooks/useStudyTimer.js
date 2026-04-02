import { useState, useEffect, useRef, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { recordDailyActivity } from "@/components/utils/dailyReset";

const IDLE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
const HEARTBEAT_INTERVAL_MS = 60 * 1000; // 60 seconds
const ACTIVITY_EVENTS = ["mousemove", "keydown", "click", "scroll", "touchstart"];

/**
 * Centralized study timer hook.
 * - Pauses on tab hidden / idle (5 min no interaction)
 * - Resumes on tab visible + activity
 * - Heartbeat flush every 60s
 * - Flush on unmount / visibility hidden
 *
 * Returns { displaySeconds, isRunning, pause, resume }
 * displaySeconds = total accumulated seconds this session (for UI display)
 */
export default function useStudyTimer({ lessonId, isGuest = false }) {
  // displaySeconds drives the UI clock — it only ticks while truly active
  const [displaySeconds, setDisplaySeconds] = useState(0);
  const [isRunning, setIsRunning] = useState(true);

  // Internal refs — avoid stale closures
  const isRunningRef = useRef(true);
  const tickIntervalRef = useRef(null);
  const heartbeatIntervalRef = useRef(null);
  const idleTimerRef = useRef(null);
  const unflushedSecondsRef = useRef(0); // seconds accumulated since last flush
  const lastTickRef = useRef(Date.now());
  const lessonIdRef = useRef(lessonId);
  const isGuestRef = useRef(isGuest);
  const isFlushing = useRef(false);
  const minuteAccumulatorRef = useRef(0); // sub-60s accumulator for daily activity

  // Keep refs current
  useEffect(() => { lessonIdRef.current = lessonId; }, [lessonId]);
  useEffect(() => { isGuestRef.current = isGuest; }, [isGuest]);

  // --- Flush unflushed seconds to backend ---
  const flush = useCallback(async () => {
    if (isGuestRef.current) return;
    const secs = unflushedSecondsRef.current;
    if (secs <= 0 || isFlushing.current) return;

    isFlushing.current = true;
    unflushedSecondsRef.current = 0;

    try {
      const updates = [];

      // Update user total time
      const user = await base44.auth.me();
      if (user) {
        updates.push(
          base44.auth.updateMe({
            time_spent_seconds: (user.time_spent_seconds || 0) + secs,
          })
        );
      }

      // Update lesson time
      if (lessonIdRef.current) {
        const lessons = await base44.entities.Lesson.filter({ id: lessonIdRef.current });
        if (lessons?.[0]) {
          updates.push(
            base44.entities.Lesson.update(lessonIdRef.current, {
              total_study_time_seconds: (lessons[0].total_study_time_seconds || 0) + secs,
            })
          );
        }
      }

      // Track daily study minutes (only full minutes)
      minuteAccumulatorRef.current += secs;
      const fullMinutes = Math.floor(minuteAccumulatorRef.current / 60);
      if (fullMinutes > 0) {
        minuteAccumulatorRef.current -= fullMinutes * 60;
        updates.push(recordDailyActivity("study_minutes", fullMinutes));
      }

      await Promise.all(updates);
    } catch (e) {
      // On failure put seconds back so next flush retries
      unflushedSecondsRef.current += secs;
      console.error("Study timer flush error:", e);
    } finally {
      isFlushing.current = false;
    }
  }, []);

  // --- Start / stop the 1-second tick ---
  const startTick = useCallback(() => {
    if (tickIntervalRef.current) return; // already ticking
    lastTickRef.current = Date.now();
    tickIntervalRef.current = setInterval(() => {
      const now = Date.now();
      const delta = Math.round((now - lastTickRef.current) / 1000);
      lastTickRef.current = now;
      if (delta > 0 && delta < 5) {
        // Guard: ignore ticks > 5s (JS timer can fire late after sleep)
        setDisplaySeconds((prev) => prev + delta);
        unflushedSecondsRef.current += delta;
      }
    }, 1000);
  }, []);

  const stopTick = useCallback(() => {
    if (tickIntervalRef.current) {
      clearInterval(tickIntervalRef.current);
      tickIntervalRef.current = null;
    }
  }, []);

  // --- Pause / resume helpers ---
  const pause = useCallback(() => {
    if (!isRunningRef.current) return;
    isRunningRef.current = false;
    setIsRunning(false);
    stopTick();
    flush(); // flush accumulated time immediately
  }, [stopTick, flush]);

  const resume = useCallback(() => {
    if (isRunningRef.current) return;
    isRunningRef.current = true;
    setIsRunning(true);
    lastTickRef.current = Date.now();
    startTick();
    resetIdleTimer();
  }, [startTick]);

  // --- Idle detection ---
  const resetIdleTimer = useCallback(() => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(() => {
      // 5 min with no interaction → pause
      if (isRunningRef.current) {
        pause();
      }
    }, IDLE_TIMEOUT_MS);
  }, [pause]);

  const handleActivity = useCallback(() => {
    // If paused due to idle, resume on interaction
    if (!isRunningRef.current && document.visibilityState === "visible") {
      resume();
    }
    resetIdleTimer();
  }, [resume, resetIdleTimer]);

  // --- Visibility change ---
  const handleVisibility = useCallback(() => {
    if (document.visibilityState === "hidden") {
      pause();
    } else if (document.visibilityState === "visible") {
      // Don't auto-resume — wait for user activity to confirm they're back
      // But reset the idle timer so first interaction resumes
      resetIdleTimer();
      // Auto-resume immediately (user switched back to tab)
      resume();
    }
  }, [pause, resume, resetIdleTimer]);

  // --- Heartbeat ---
  const startHeartbeat = useCallback(() => {
    if (heartbeatIntervalRef.current) return;
    heartbeatIntervalRef.current = setInterval(() => {
      if (isRunningRef.current) {
        flush();
      }
    }, HEARTBEAT_INTERVAL_MS);
  }, [flush]);

  const stopHeartbeat = useCallback(() => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
  }, []);

  // --- Mount / unmount ---
  useEffect(() => {
    // Start ticking
    startTick();
    startHeartbeat();
    resetIdleTimer();

    // Listeners
    document.addEventListener("visibilitychange", handleVisibility);
    ACTIVITY_EVENTS.forEach((evt) =>
      document.addEventListener(evt, handleActivity, { passive: true })
    );

    return () => {
      // Cleanup: stop everything, flush remaining
      stopTick();
      stopHeartbeat();
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      document.removeEventListener("visibilitychange", handleVisibility);
      ACTIVITY_EVENTS.forEach((evt) =>
        document.removeEventListener(evt, handleActivity)
      );
      // Final flush (synchronous best-effort via sendBeacon pattern)
      flush();
    };
  }, []); // intentionally empty — refs keep state current

  return { displaySeconds, isRunning, pause, resume };
}