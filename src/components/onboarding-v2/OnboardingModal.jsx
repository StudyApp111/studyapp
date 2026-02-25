import React, { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "@/components/theme/ThemeProvider";
import posthog from "posthog-js";
import StepSignIn from "./StepSignIn";
import StepProfile from "./StepProfile";
import StepWelcome from "./StepWelcome";
import StepHowItWorks from "./StepHowItWorks";
import StepFeatures from "./StepFeatures";
import StepReady from "./StepReady";
import StepMaterials from "./StepMaterials";
import { useGuestSession } from "@/components/guest/GuestSessionContext";
import { checkIsMobile } from "@/components/utils/BrowserCompatibility";

const TOTAL_STEPS = 7;

// Step order:
// 1 = Welcome
// 2 = HowItWorks
// 3 = Materials
// 4 = Features
// 5 = Profile (name + school)
// 6 = SignIn (authenticate) — guest preview available on ALL mobile
// 7 = Ready ("You're all set")

export default function OnboardingModal({ onComplete }) {
  const { isDark } = useTheme();
  const [step, setStep] = useState(1);
  const [user, setUser] = useState(null);
  const [displayName, setDisplayName] = useState("");
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const { isGuest, startGuestSession, updateGuestProfile } = useGuestSession();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const isAuth = await base44.auth.isAuthenticated();
        if (isAuth) {
          const currentUser = await base44.auth.me();
          setUser(currentUser);
          setDisplayName(currentUser.full_name?.split(" ")[0] || "");
          const wasOnboarding = sessionStorage.getItem("onboarding_v2_active");
          if (wasOnboarding) {
            setStep(7);
          } else {
            // User already authenticated — skip to profile step (5)
            const savedName = sessionStorage.getItem("onboarding_profile_name");
            if (savedName) {
              // Already filled profile, skip ahead
              setStep(6);
            } else {
              setStep(1);
            }
          }
        }
      } catch {
        // Not authenticated
      } finally {
        setIsCheckingAuth(false);
      }
    };
    checkAuth();
  }, [isGuest]);

  useEffect(() => {
    try {
      posthog.capture('onboarding_step_viewed', { step, total_steps: TOTAL_STEPS });
    } catch {}
  }, [step]);

  const handleNext = useCallback(() => {
    if (step < TOTAL_STEPS) {
      setStep((s) => s + 1);
    } else {
      handleComplete();
    }
  }, [step]);

  const handleBack = useCallback(() => {
    if (step > 1) {
      setStep((s) => s - 1);
    }
  }, [step]);

  const handleSignIn = (method) => {
    try { posthog.capture('onboarding_sign_in_clicked', { method }); } catch {}
    sessionStorage.setItem("onboarding_v2_active", "true");
    const returnUrl = window.location.pathname + window.location.search;
    base44.auth.redirectToLogin(returnUrl);
  };

  const handleGuestStart = async () => {
    try { posthog.capture('guest_session_started'); } catch {}
    const result = await startGuestSession();
    if (result.allowed) {
      // Guest skips sign-in and ready steps — go straight to complete
      setStep(7);
    }
    return result;
  };

  const handleProfileComplete = async ({ name, school }) => {
    try {
      posthog.capture('onboarding_profile_completed', { has_school: !!school });
    } catch {}

    if (isGuest || !user) {
      if (isGuest) {
        updateGuestProfile(name, school);
      }
      sessionStorage.setItem("onboarding_profile_name", name);
      sessionStorage.setItem("onboarding_profile_school", school);
      setDisplayName(name);
      handleNext();
      return;
    }

    try {
      await base44.auth.updateMe({ display_name: name });
      setDisplayName(name);

      const existingProfiles = await base44.entities.LearningProfile.filter({
        created_by: user.email,
      });
      if (existingProfiles.length > 0) {
        await base44.entities.LearningProfile.update(existingProfiles[0].id, { school });
      } else {
        await base44.entities.LearningProfile.create({ school });
      }

      handleNext();
    } catch (err) {
      console.error("Error saving profile:", err);
      handleNext();
    }
  };

  const handleComplete = async () => {
    try {
      posthog.capture('onboarding_completed', { total_steps: TOTAL_STEPS, is_guest: isGuest });
    } catch {}

    if (isGuest) {
      sessionStorage.removeItem("onboarding_v2_active");
      sessionStorage.removeItem("onboarding_profile_name");
      sessionStorage.removeItem("onboarding_profile_school");
      onComplete?.();
      return;
    }

    try {
      const savedName = sessionStorage.getItem("onboarding_profile_name");
      const savedSchool = sessionStorage.getItem("onboarding_profile_school");
      
      if (savedName) {
        await base44.auth.updateMe({ display_name: savedName, onboarding_completed: true });
      } else {
        await base44.auth.updateMe({ onboarding_completed: true });
      }

      if (savedSchool && user) {
        const existingProfiles = await base44.entities.LearningProfile.filter({
          created_by: user.email,
        });
        if (existingProfiles.length > 0) {
          await base44.entities.LearningProfile.update(existingProfiles[0].id, { school: savedSchool });
        } else {
          await base44.entities.LearningProfile.create({ school: savedSchool });
        }
      }

      sessionStorage.removeItem("onboarding_v2_active");
      sessionStorage.removeItem("onboarding_profile_name");
      sessionStorage.removeItem("onboarding_profile_school");
      window.dispatchEvent(new Event("userSubscriptionUpdated"));

      // Fire-and-forget: enrich learning profile with city/country from IP geo
      base44.functions.invoke('enrichLearningProfile', {}).catch(() => {});

      // Fire-and-forget: trigger signup email via Resend
      base44.functions.invoke('sendResendEmail', {
        trigger_type: 'signup',
        user_email: user?.email,
        context: { reference_id: `signup_${new Date().toISOString()}` }
      }).catch(() => {});
    } catch (err) {
      console.error("Error completing onboarding:", err);
    }
    onComplete?.();
  };

  if (isCheckingAuth) return null;

  const progress = (step / TOTAL_STEPS) * 100;

  // Show guest preview on ALL mobile devices
  const isMobile = checkIsMobile();

  return (
    <>
      <div className="fixed inset-0 z-[9998] bg-black/60" />
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 pointer-events-none">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className={`pointer-events-auto w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-3xl shadow-2xl border ${
            isDark ? "bg-[#12121a] border-white/10" : "bg-white border-slate-200"
          }`}
        >
          <div className="sticky top-0 z-10 px-6 pt-5 pb-3">
            <div className="flex items-center justify-between mb-2">
              <span className={`text-xs font-medium ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                Step {step} of {TOTAL_STEPS}
              </span>
              <span className={`text-xs font-medium ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                {Math.round(progress)}%
              </span>
            </div>
            <div className={`h-1.5 rounded-full overflow-hidden ${isDark ? "bg-white/10" : "bg-slate-200"}`}>
              <motion.div
                className="h-full bg-gradient-to-r from-purple-500 via-pink-500 to-amber-400 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.4, ease: "easeOut" }}
              />
            </div>
          </div>

          <div className="px-6 pb-6">
            <AnimatePresence mode="wait">
              {step === 1 && (
                <StepWelcome key="step1" displayName={displayName} onNext={handleNext} onBack={null} />
              )}
              {step === 2 && (
                <StepHowItWorks key="step2" onNext={handleNext} onBack={handleBack} />
              )}
              {step === 3 && (
                <StepMaterials key="step3" onNext={handleNext} onBack={handleBack} />
              )}
              {step === 4 && (
                <StepFeatures key="step4" onNext={handleNext} onBack={handleBack} />
              )}
              {step === 5 && (
                <StepProfile key="step5" user={user} isGuest={isGuest} onComplete={handleProfileComplete} onBack={handleBack} />
              )}
              {step === 6 && (
                <StepSignIn
                  key="step6"
                  onSignIn={handleSignIn}
                  onGuestStart={isMobile ? handleGuestStart : null}
                  onBack={handleBack}
                />
              )}
              {step === 7 && (
                <StepReady
                  key="step7"
                  displayName={displayName || sessionStorage.getItem("onboarding_profile_name") || ""}
                  onComplete={handleComplete}
                  onBack={handleBack}
                />
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </div>
    </>
  );
}