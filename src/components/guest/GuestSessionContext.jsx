import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { generateFingerprint } from '@/components/utils/browserFingerprint';

const GuestSessionContext = createContext(null);

const GUEST_STORAGE_KEY = 'studyapp_guest_session';
const GUEST_TIMER_SECONDS = 300; // 5 minutes

function loadGuestSession() {
  try {
    const raw = localStorage.getItem(GUEST_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}

function saveGuestSession(data) {
  localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(data));
}

function clearGuestSession() {
  localStorage.removeItem(GUEST_STORAGE_KEY);
}

export function GuestSessionProvider({ children }) {
  const [isGuest, setIsGuest] = useState(false);
  const [guestData, setGuestData] = useState(null); // { name, school, lessonData, startedAt }
  const [timeRemaining, setTimeRemaining] = useState(GUEST_TIMER_SECONDS);
  const [isTimerExpired, setIsTimerExpired] = useState(false);
  const [guestLessonCreated, setGuestLessonCreated] = useState(false);
  const timerRef = useRef(null);

  // On mount, check if there's an existing guest session
  useEffect(() => {
    const session = loadGuestSession();
    if (session && session.isGuest) {
      const elapsed = Math.floor((Date.now() - session.startedAt) / 1000);
      const remaining = Math.max(0, GUEST_TIMER_SECONDS - elapsed);
      
      if (remaining <= 0) {
        setIsTimerExpired(true);
        setIsGuest(true);
        setGuestData(session);
        setTimeRemaining(0);
      } else {
        setIsGuest(true);
        setGuestData(session);
        setTimeRemaining(remaining);
        setGuestLessonCreated(!!session.lessonData);
      }
    }
  }, []);

  // Timer countdown
  useEffect(() => {
    if (!isGuest || isTimerExpired) return;
    
    timerRef.current = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          setIsTimerExpired(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isGuest, isTimerExpired]);

  const startGuestSession = useCallback(async () => {
    // Check eligibility first
    const fp = await generateFingerprint();
    const { data } = await base44.functions.invoke('checkGuestEligibility', {
      fingerprint: fp,
      action: 'check'
    });

    if (!data.allowed) {
      return { allowed: false, reason: data.reason };
    }

    // Claim the guest session
    const { data: claimData } = await base44.functions.invoke('checkGuestEligibility', {
      fingerprint: fp,
      action: 'claim'
    });

    if (!claimData.allowed) {
      return { allowed: false, reason: claimData.reason };
    }

    const session = {
      isGuest: true,
      startedAt: Date.now(),
      fingerprint: fp,
      name: '',
      school: '',
      lessonData: null
    };

    saveGuestSession(session);
    setIsGuest(true);
    setGuestData(session);
    setTimeRemaining(GUEST_TIMER_SECONDS);
    setIsTimerExpired(false);
    setGuestLessonCreated(false);

    return { allowed: true };
  }, []);

  const updateGuestProfile = useCallback((name, school) => {
    setGuestData(prev => {
      const updated = { ...prev, name, school };
      saveGuestSession(updated);
      return updated;
    });
  }, []);

  const setGuestLesson = useCallback((lessonData) => {
    setGuestData(prev => {
      const updated = { ...prev, lessonData };
      saveGuestSession(updated);
      return updated;
    });
    setGuestLessonCreated(true);
  }, []);

  const transferGuestData = useCallback(async () => {
    if (!guestData) return null;
    
    try {
      const user = await base44.auth.me();
      const { data } = await base44.functions.invoke('checkGuestEligibility', {
        fingerprint: guestData.fingerprint,
        action: 'transfer',
        lesson_data: guestData.lessonData,
        user_email: user.email,
        profile_data: { name: guestData.name, school: guestData.school }
      });

      // Update user's display name if guest set one
      if (guestData.name) {
        await base44.auth.updateMe({ display_name: guestData.name });
      }

      // Clean up guest session
      endGuestSession();
      
      return data;
    } catch (err) {
      console.error('Error transferring guest data:', err);
      return null;
    }
  }, [guestData]);

  const endGuestSession = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    clearGuestSession();
    setIsGuest(false);
    setGuestData(null);
    setTimeRemaining(GUEST_TIMER_SECONDS);
    setIsTimerExpired(false);
    setGuestLessonCreated(false);
  }, []);

  return (
    <GuestSessionContext.Provider value={{
      isGuest,
      guestData,
      timeRemaining,
      isTimerExpired,
      guestLessonCreated,
      startGuestSession,
      updateGuestProfile,
      setGuestLesson,
      transferGuestData,
      endGuestSession
    }}>
      {children}
    </GuestSessionContext.Provider>
  );
}

export function useGuestSession() {
  const ctx = useContext(GuestSessionContext);
  if (!ctx) throw new Error('useGuestSession must be used within GuestSessionProvider');
  return ctx;
}