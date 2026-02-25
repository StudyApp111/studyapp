import React, { useState, useEffect } from "react";
import { useGuestSession } from "./GuestSessionContext";
import GuestSignUpModal from "./GuestSignUpModal";

const GUEST_TIME_LIMIT_MS = 10 * 60 * 1000; // 10 minutes
const POST_DIAGNOSTIC_DELAY_MS = 5000; // 5 seconds after diagnostic

export default function GuestTimerLockout() {
  const { isGuest, guestData, guestDiagnosticCompleted } = useGuestSession();
  const [showModal, setShowModal] = useState(false);

  // Timer-based lockout: 10 minutes from session start
  useEffect(() => {
    if (!isGuest || !guestData?.startedAt) return;

    const elapsed = Date.now() - guestData.startedAt;
    if (elapsed >= GUEST_TIME_LIMIT_MS) {
      setShowModal(true);
      return;
    }

    const timer = setTimeout(() => setShowModal(true), GUEST_TIME_LIMIT_MS - elapsed);
    return () => clearTimeout(timer);
  }, [isGuest, guestData?.startedAt]);

  // Post-diagnostic: show modal 5s after diagnostic is completed
  useEffect(() => {
    if (!isGuest || !guestDiagnosticCompleted) return;

    const timer = setTimeout(() => setShowModal(true), POST_DIAGNOSTIC_DELAY_MS);
    return () => clearTimeout(timer);
  }, [isGuest, guestDiagnosticCompleted]);

  if (!showModal) return null;
  return <GuestSignUpModal />;
}