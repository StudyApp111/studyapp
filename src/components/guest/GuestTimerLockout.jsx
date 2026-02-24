import React from "react";
import { useGuestSession } from "./GuestSessionContext";
import GuestSignUpModal from "./GuestSignUpModal";

// This component now shows the sign-up modal when guest completes diagnostic
// (replaces the old timer-based lockout)
export default function GuestTimerLockout() {
  const { isGuest, guestDiagnosticCompleted } = useGuestSession();

  // Only show the unskippable sign-up modal when guest finishes diagnostic
  if (!isGuest || !guestDiagnosticCompleted) return null;

  return <GuestSignUpModal />;
}