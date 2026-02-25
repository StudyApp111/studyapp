import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { generateFingerprint } from '@/components/utils/browserFingerprint';
import posthog from 'posthog-js';

const GuestSessionContext = createContext(null);

const GUEST_STORAGE_KEY = 'studyapp_guest_session';

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
  const [guestLessonCreated, setGuestLessonCreated] = useState(false);
  const [guestDiagnosticCompleted, setGuestDiagnosticCompleted] = useState(false);

  // On mount, check if there's an existing guest session
  useEffect(() => {
    const session = loadGuestSession();
    if (session && session.isGuest) {
      setIsGuest(true);
      setGuestData(session);
      setGuestLessonCreated(!!session.lessonData);
      setGuestDiagnosticCompleted(!!session.diagnosticCompleted);
    }
  }, []);

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
      lessonData: null,
      diagnosticCompleted: false
    };

    saveGuestSession(session);
    sessionStorage.setItem('guest_session_active', 'true');
    setIsGuest(true);
    setGuestData(session);
    setGuestLessonCreated(false);
    setGuestDiagnosticCompleted(false);

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
      // Preserve the lesson ID for transfer
      const updated = { ...prev, lessonData: { ...lessonData, id: lessonData.id } };
      saveGuestSession(updated);
      return updated;
    });
    setGuestLessonCreated(true);
  }, []);

  const markGuestDiagnosticCompleted = useCallback(() => {
    setGuestDiagnosticCompleted(true);
    setGuestData(prev => {
      const updated = { ...prev, diagnosticCompleted: true };
      saveGuestSession(updated);
      return updated;
    });
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

      if (guestData.name) {
        await base44.auth.updateMe({ display_name: guestData.name });
      }

      endGuestSession();
      return data;
    } catch (err) {
      console.error('Error transferring guest data:', err);
      return null;
    }
  }, [guestData]);

  const endGuestSession = useCallback(() => {
    clearGuestSession();
    sessionStorage.removeItem('guest_session_active');
    setIsGuest(false);
    setGuestData(null);
    setGuestLessonCreated(false);
    setGuestDiagnosticCompleted(false);
  }, []);

  // Auto-transfer is now handled by Layout after authentication redirect
  // (see Layout.js - returning guest handler)

  return (
    <GuestSessionContext.Provider value={{
      isGuest,
      guestData,
      guestLessonCreated,
      guestDiagnosticCompleted,
      startGuestSession,
      updateGuestProfile,
      setGuestLesson,
      markGuestDiagnosticCompleted,
      transferGuestData,
      endGuestSession
    }}>
      {children}
    </GuestSessionContext.Provider>
  );
}

const GUEST_SESSION_DEFAULTS = {
  isGuest: false,
  guestData: null,
  guestLessonCreated: false,
  guestDiagnosticCompleted: false,
  startGuestSession: async () => ({ allowed: false }),
  updateGuestProfile: () => {},
  setGuestLesson: () => {},
  markGuestDiagnosticCompleted: () => {},
  transferGuestData: async () => null,
  endGuestSession: () => {}
};

export function useGuestSession() {
  const ctx = useContext(GuestSessionContext);
  if (!ctx) {
    console.warn('useGuestSession called outside GuestSessionProvider — using defaults');
    return GUEST_SESSION_DEFAULTS;
  }
  return ctx;
}