import React, { useState, useEffect, useCallback, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "@/components/theme/ThemeProvider";
import posthog from "posthog-js";
import StepSchool from "./StepSchool";
import StepName from "./StepName";
import { useGuestSession } from "@/components/guest/GuestSessionContext";
import { checkIsMobile } from "@/components/utils/BrowserCompatibility";
import { detectDeviceInfo } from "@/components/utils/userTracking";

const TOTAL_STEPS = 2;

// Step order:
// 1 = School
// 2 = Name

export default function OnboardingModal({ onComplete }) {
  const { isDark } = useTheme();
  const [step, setStep] = useState(1);
  const [user, setUser] = useState(null);
  const [displayName, setDisplayName] = useState("");
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const { isGuest, startGuestSession, updateGuestProfile } = useGuestSession();

  // School suggestions loaded once on mount via IP geolocation (no user interaction needed)
  const [schoolSuggestions, setSchoolSuggestions] = useState([]);
  const [schoolsLoading, setSchoolsLoading] = useState(true);
  const [schoolLocation, setSchoolLocation] = useState(null);
  const schoolsFetchedRef = useRef(false);

  // Persist onboarding step to localStorage for cross-browser continuity
  // (TikTok/Instagram → real browser, or back-button recovery)
  const ONBOARDING_STEP_KEY = 'studyapp_onboarding_step';
  const ONBOARDING_SCHOOL_KEY = 'onboarding_profile_school';
  const ONBOARDING_NAME_KEY = 'onboarding_profile_name';

  // Fetch nearby schools immediately on mount using IP-based geolocation
  useEffect(() => {
    if (schoolsFetchedRef.current) return;
    schoolsFetchedRef.current = true;

    const fetchSchools = async () => {
      setSchoolsLoading(true);
      try {
        // Race against a 5s timeout so we never block the user
        const timeoutPromise = new Promise((resolve) =>
          setTimeout(() => resolve({ data: { success: true, schools: [], location: {} } }), 5000)
        );
        const result = await Promise.race([
          base44.functions.invoke("getNearbySchools", { searchQuery: "" }),
          timeoutPromise,
        ]);

        if (result?.data?.success) {
          setSchoolSuggestions(result.data.schools || []);
          if (result.data.location?.city) {
            setSchoolLocation(result.data.location);
          }
        }
      } catch (err) {
        console.error("Error pre-loading schools:", err);
      } finally {
        setSchoolsLoading(false);
      }
    };

    fetchSchools();
  }, []);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const isAuth = await base44.auth.isAuthenticated();
        if (isAuth) {
          const currentUser = await base44.auth.me();
          setUser(currentUser);
          setDisplayName(currentUser.full_name?.split(" ")[0] || "");
          const savedSchool = sessionStorage.getItem(ONBOARDING_SCHOOL_KEY);
          
          let hasProfile = false;
          try {
            const profiles = await base44.entities.LearningProfile.filter({ created_by: currentUser.email });
            hasProfile = profiles.length > 0;
          } catch (e) {}

          if (hasProfile || savedSchool) {
            setStep(2);
          } else {
            setStep(1);
          }
        }
      } catch {
        // Ignore
      } finally {
        setIsCheckingAuth(false);
      }
    };
    checkAuth();
  }, [isGuest]);

  useEffect(() => {
    try {
      const deviceInfo = detectDeviceInfo();
      posthog.capture("onboarding_step_viewed", { 
        step, 
        total_steps: TOTAL_STEPS,
        device_type: deviceInfo.device_type,
        app_type: deviceInfo.app_type
      });
    } catch {}
    // Persist step to localStorage for cross-browser and back-button continuity
    localStorage.setItem(ONBOARDING_STEP_KEY, String(step));
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

  const handleSchoolComplete = async ({ school }) => {
    try { posthog.capture("onboarding_school_completed", { has_school: !!school }); } catch {}

    sessionStorage.setItem(ONBOARDING_SCHOOL_KEY, school);
    localStorage.setItem(ONBOARDING_SCHOOL_KEY, school);

    if (isGuest) {
      updateGuestProfile(displayName || "", school);
    }

    handleNext();
  };

  const handleNameComplete = async ({ name }) => {
    try { posthog.capture("onboarding_name_completed", { has_name: !!name }); } catch {}

    if (name) {
      sessionStorage.setItem(ONBOARDING_NAME_KEY, name);
      localStorage.setItem(ONBOARDING_NAME_KEY, name);
      setDisplayName(name);
    } else {
      sessionStorage.removeItem(ONBOARDING_NAME_KEY);
      localStorage.removeItem(ONBOARDING_NAME_KEY);
    }

    if (isGuest) {
      const school = sessionStorage.getItem(ONBOARDING_SCHOOL_KEY) || localStorage.getItem(ONBOARDING_SCHOOL_KEY) || "";
      updateGuestProfile(name || "", school);
    }

    if (!isGuest && user) {
      try {
        if (name) {
          await base44.auth.updateMe({ display_name: name });
        }
        const school = sessionStorage.getItem(ONBOARDING_SCHOOL_KEY) || localStorage.getItem(ONBOARDING_SCHOOL_KEY);
        if (school) {
          const existingProfiles = await base44.entities.LearningProfile.filter({
            created_by: user.email,
          });
          if (existingProfiles.length > 0) {
            await base44.entities.LearningProfile.update(existingProfiles[0].id, { school });
          } else {
            await base44.entities.LearningProfile.create({ school });
          }
        }
      } catch (err) {
        console.error("Error saving profile:", err);
      }
    }

    handleNext();
  };

  const clearOnboardingStorage = () => {
    sessionStorage.removeItem("onboarding_v2_active");
    sessionStorage.removeItem(ONBOARDING_NAME_KEY);
    sessionStorage.removeItem(ONBOARDING_SCHOOL_KEY);
    localStorage.removeItem("onboarding_v2_active");
    localStorage.removeItem(ONBOARDING_STEP_KEY);
    localStorage.removeItem(ONBOARDING_NAME_KEY);
    localStorage.removeItem(ONBOARDING_SCHOOL_KEY);
  };

  const handleComplete = async () => {
    try {
      const deviceInfo = detectDeviceInfo();
      posthog.capture("onboarding_completed", { 
        total_steps: TOTAL_STEPS, 
        is_guest: isGuest,
        device_type: deviceInfo.device_type,
        app_type: deviceInfo.app_type
      });
    } catch {}

    if (isGuest) {
      clearOnboardingStorage();
      onComplete?.();
      return;
    }

    try {
      const savedName = sessionStorage.getItem(ONBOARDING_NAME_KEY) || localStorage.getItem(ONBOARDING_NAME_KEY);
      const savedSchool = sessionStorage.getItem(ONBOARDING_SCHOOL_KEY) || localStorage.getItem(ONBOARDING_SCHOOL_KEY);

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

      clearOnboardingStorage();
      window.dispatchEvent(new Event("userSubscriptionUpdated"));

      base44.functions.invoke("enrichLearningProfile", {}).catch(() => {});
      base44.functions.invoke("sendResendEmail", {
        trigger_type: "signup",
        user_email: user?.email,
        context: { reference_id: `signup_${new Date().toISOString()}` },
      }).catch(() => {});
    } catch (err) {
      console.error("Error completing onboarding:", err);
    }
    onComplete?.();
  };

  if (isCheckingAuth) return null;

  const progress = (step / TOTAL_STEPS) * 100;
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
                <StepSchool
                  key="step1"
                  user={user}
                  isGuest={false}
                  schoolSuggestions={schoolSuggestions}
                  schoolsLoading={schoolsLoading}
                  schoolLocation={schoolLocation}
                  onComplete={handleSchoolComplete}
                  onBack={null}
                />
              )}
              {step === 2 && (
                <StepName
                  key="step2"
                  user={user}
                  onComplete={handleNameComplete}
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