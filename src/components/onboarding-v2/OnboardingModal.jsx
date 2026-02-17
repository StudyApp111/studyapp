import React, { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "@/components/theme/ThemeProvider";
import StepSignIn from "./StepSignIn";
import StepProfile from "./StepProfile";
import StepWelcome from "./StepWelcome";
import StepHowItWorks from "./StepHowItWorks";
import StepFeatures from "./StepFeatures";
import StepReady from "./StepReady";

const TOTAL_STEPS = 6;

export default function OnboardingModal({ onComplete }) {
  const { isDark } = useTheme();
  const [step, setStep] = useState(1);
  const [user, setUser] = useState(null);
  const [displayName, setDisplayName] = useState("");
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  // On mount, check if user is already authenticated
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const isAuth = await base44.auth.isAuthenticated();
        if (isAuth) {
          const currentUser = await base44.auth.me();
          setUser(currentUser);
          setDisplayName(currentUser.full_name?.split(" ")[0] || "");
          // Authenticated users start at step 2 (profile)
          setStep(2);
        }
      } catch {
        // Not authenticated - stay on step 1
      } finally {
        setIsCheckingAuth(false);
      }
    };
    checkAuth();
  }, []);

  const handleNext = useCallback(() => {
    if (step < TOTAL_STEPS) {
      setStep((s) => s + 1);
    } else {
      // Final step — mark onboarding complete
      handleComplete();
    }
  }, [step]);

  const handleBack = useCallback(() => {
    // Users who logged in land on step 2 — can't go back from there
    if (step > 2 || (step === 2 && !user)) {
      setStep((s) => s - 1);
    }
  }, [step, user]);

  const handleSignIn = (method) => {
    // Store that we're in onboarding so Layout doesn't interfere
    sessionStorage.setItem("onboarding_v2_active", "true");
    // Redirect to login — after login, user lands back on Home
    const returnUrl = window.location.pathname + window.location.search;
    base44.auth.redirectToLogin(returnUrl);
  };

  const handleProfileComplete = async ({ name, school }) => {
    try {
      // Update user display name
      await base44.auth.updateMe({ display_name: name });
      setDisplayName(name);

      // Save learning profile
      const existingProfiles = await base44.entities.LearningProfile.filter({
        created_by: user.email,
      });
      if (existingProfiles.length > 0) {
        await base44.entities.LearningProfile.update(existingProfiles[0].id, {
          school,
        });
      } else {
        await base44.entities.LearningProfile.create({ school });
      }

      handleNext();
    } catch (err) {
      console.error("Error saving profile:", err);
      // Still advance even if save fails
      handleNext();
    }
  };

  const handleComplete = async () => {
    try {
      await base44.auth.updateMe({ onboarding_completed: true });
      sessionStorage.removeItem("onboarding_v2_active");
      window.dispatchEvent(new Event("userSubscriptionUpdated"));
    } catch (err) {
      console.error("Error completing onboarding:", err);
    }
    onComplete?.();
  };

  if (isCheckingAuth) return null;

  const progress = (step / TOTAL_STEPS) * 100;
  const canGoBack = step > 2 || (step === 2 && !user);

  return (
    <>
      {/* Dimmed overlay — no blur, just dim */}
      <div className="fixed inset-0 z-[9998] bg-black/60" />

      {/* Modal container */}
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 pointer-events-none">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className={`pointer-events-auto w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-3xl shadow-2xl border ${
            isDark
              ? "bg-[#12121a] border-white/10"
              : "bg-white border-slate-200"
          }`}
        >
          {/* Progress bar header */}
          <div className="sticky top-0 z-10 px-6 pt-5 pb-3">
            <div className="flex items-center justify-between mb-2">
              <span
                className={`text-xs font-medium ${
                  isDark ? "text-slate-400" : "text-slate-500"
                }`}
              >
                Step {step} of {TOTAL_STEPS}
              </span>
              <span
                className={`text-xs font-medium ${
                  isDark ? "text-slate-400" : "text-slate-500"
                }`}
              >
                {Math.round(progress)}%
              </span>
            </div>
            <div
              className={`h-1.5 rounded-full overflow-hidden ${
                isDark ? "bg-white/10" : "bg-slate-200"
              }`}
            >
              <motion.div
                className="h-full bg-gradient-to-r from-purple-500 via-pink-500 to-amber-400 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.4, ease: "easeOut" }}
              />
            </div>
          </div>

          {/* Step content */}
          <div className="px-6 pb-6">
            <AnimatePresence mode="wait">
              {step === 1 && (
                <StepSignIn key="step1" onSignIn={handleSignIn} />
              )}
              {step === 2 && (
                <StepProfile
                  key="step2"
                  user={user}
                  onComplete={handleProfileComplete}
                  onBack={canGoBack ? handleBack : null}
                />
              )}
              {step === 3 && (
                <StepWelcome
                  key="step3"
                  displayName={displayName}
                  onNext={handleNext}
                  onBack={handleBack}
                />
              )}
              {step === 4 && (
                <StepHowItWorks
                  key="step4"
                  onNext={handleNext}
                  onBack={handleBack}
                />
              )}
              {step === 5 && (
                <StepFeatures
                  key="step5"
                  onNext={handleNext}
                  onBack={handleBack}
                />
              )}
              {step === 6 && (
                <StepReady
                  key="step6"
                  displayName={displayName}
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