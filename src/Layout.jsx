import React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Home, BookOpen, Trophy, History, LogOut, Settings, Plus, Flame, Award, CheckCircle, Clock, FileCheck, TrendingUp, Map, Sparkles, Users, MessageSquareText, Mail, ChevronDown, ChevronRight, Upload, ArrowLeft } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { base44 } from "@/api/base44Client";
import { trackUserSession, trackSessionDuration, detectDeviceInfo } from "@/components/utils/userTracking";
import { logError } from "@/components/utils/errorLogger";
import { PostHogProvider } from '@posthog/react';
import posthog from 'posthog-js';

// Google Analytics initialization
const initGoogleAnalytics = () => {
  // Prevent duplicate injection
  const existingScript = document.querySelector('script[src*="googletagmanager.com/gtag/js"]');
  if (existingScript) return;

  const script = document.createElement('script');
  script.async = true;
  script.src = 'https://www.googletagmanager.com/gtag/js?id=G-J5CF3WKGDR';
  document.head.appendChild(script);

  window.dataLayer = window.dataLayer || [];
  function gtag(){window.dataLayer.push(arguments);}
  window.gtag = gtag; // Make accessible globally
  gtag('js', new Date());
  gtag('config', 'G-J5CF3WKGDR');
};

// CreateLessonModal replaced with CreateLesson page for better UX

// BrowserCompatibilityBanner removed — in-app browser detection now handled inline in onboarding sign-in step
import FeedbackModal from "@/components/feedback/FeedbackModal.jsx";
import AITutorFloatingButton from "@/components/modals/AITutorFloatingButton.jsx";
import LessonSideNav from "@/components/document-viewer/LessonSideNav";
import { AnimatePresence, motion } from "framer-motion";

import { AITutorProvider } from "@/components/ai-tutor/AITutorContext";
import AITutorSheet from "@/components/ai-tutor/AITutorSheet";
import { SubscriptionProvider } from "@/components/subscription/SubscriptionContext";
import { UpgradeNavBadge } from "@/components/subscription/UpgradeBadge";
import UpgradeModalWrapper from "@/components/subscription/UpgradeModalWrapper";
import { ThemeProvider, useTheme } from "@/components/theme/ThemeProvider";
import { Moon, Sun } from "lucide-react";
import { GuestSessionProvider, useGuestSession } from "@/components/guest/GuestSessionContext";
import GuestTimerLockout from "@/components/guest/GuestTimerLockout";
import GlobalBadgeListener from "@/components/gamification/GlobalBadgeListener";

const navigationItems = [
        {
          title: "Home",
          url: createPageUrl("Home"),
          icon: Home,
        },
        {
          title: "Smart Grader",
          url: createPageUrl("SmartGrader"),
          icon: FileCheck,
          isNew: true,
        },
        {
          title: "Lesson History",
          url: createPageUrl("LessonHistory"),
          icon: History,
        },
      ];

const formatTime = (seconds) => {
  if (!seconds || seconds === 0) return '0m';
  
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}h ${mins}m`;
};

function LayoutContent({ children, currentPageName }) {
    const location = useLocation();
    const navigate = useNavigate();
    const [user, setUser] = React.useState(null);
    const [feedbackModalOpen, setFeedbackModalOpen] = React.useState(false);
    const { isDark, toggleTheme } = useTheme();
    const { isGuest, endGuestSession } = useGuestSession();

  const pathLowerEarly = location.pathname.toLowerCase();
  const isHomePageEarly = currentPageName === "Home" || location.pathname === createPageUrl("Home") || location.pathname === "/" || location.pathname === "";

  React.useEffect(() => {
    // Initialize Analytics
    initGoogleAnalytics();

    let cleanup;
    (async () => {
      const currentIsHome = currentPageName === "Home" || location.pathname === createPageUrl("Home") || location.pathname === "/" || location.pathname === "";
      
      // Force redirect to Home if platform default page is misconfigured (e.g. AssignmentHistory)
      const isAssignmentHistory = currentPageName === "AssignmentHistory" || location.pathname.toLowerCase().includes("assignmenthistory");
      
      // Try to get user
      try {
        const currentUser = await base44.auth.me();
        setUser(currentUser);
        
        if (currentUser && currentUser.email) {
          try {
            posthog.identify(currentUser.email);
            // Track sign-in once per session
            if (!sessionStorage.getItem('posthog_session_tracked')) {
              sessionStorage.setItem('posthog_session_tracked', '1');
              const deviceInfo = detectDeviceInfo();
              posthog.capture('user_signed_in', {
                device_type: deviceInfo.device_type,
                app_type: deviceInfo.app_type,
                is_onboarded: !!(currentUser.onboarding_completed || currentUser.data?.onboarding_completed),
                role: currentUser.role
              });
            }
          } catch (e) {}
        }

        // Handle returning guest: transfer lesson data to newly authenticated user
        // Check both localStorage and sessionStorage — localStorage survives cross-browser
        // handoff (e.g. TikTok in-app browser → Safari/Chrome)
        const returningGuestLessonId = sessionStorage.getItem('guest_returning_lesson_id') || localStorage.getItem('guest_returning_lesson_id');
        const returningGuestFP = sessionStorage.getItem('guest_returning_fingerprint') || localStorage.getItem('guest_returning_fingerprint');
        if (returningGuestLessonId && returningGuestFP) {
          sessionStorage.removeItem('guest_returning_lesson_id');
          sessionStorage.removeItem('guest_returning_fingerprint');
          sessionStorage.removeItem('guest_returning_to_lesson');
          localStorage.removeItem('guest_returning_lesson_id');
          localStorage.removeItem('guest_returning_fingerprint');
          localStorage.removeItem('guest_returning_to_lesson');
          
          try {
            // Mark onboarding complete FIRST so subsequent Layout re-renders don't redirect to Home
            await base44.auth.updateMe({ onboarding_completed: true });
            setUser({ ...currentUser, onboarding_completed: true });
            
            const { data: transferData } = await base44.functions.invoke('checkGuestEligibility', {
              fingerprint: returningGuestFP,
              action: 'transfer',
              lesson_data: { id: returningGuestLessonId },
              user_email: currentUser.email,
              profile_data: {}
            });
            
            endGuestSession();
            


            if (transferData?.lesson_id) {
              // Clear any stale lesson IDs from sessionStorage so DocumentViewer uses the URL ID
              sessionStorage.removeItem('currentLessonId');
              // Load into exam review so user can see their diagnostic results after sign-up
              navigate(createPageUrl("DocumentViewer") + `?id=${transferData.lesson_id}&tab=exam&viewResults=1`, { replace: true });
              return;
            }
          } catch (transferErr) {
            console.error('Guest transfer error:', transferErr);
            endGuestSession();
          }
        }

        const onboardingDone = currentUser?.onboarding_completed || currentUser?.data?.onboarding_completed;
          const isAdmin = currentUser?.role === 'admin';

            // Track session for authenticated users with completed onboarding
            if (onboardingDone || isAdmin) {
              trackUserSession();
              cleanup = trackSessionDuration();
              // Redirect away from AssignmentHistory if it loaded as default
              if (isAssignmentHistory) {
                navigate(createPageUrl("Home"), { replace: true });
              }
            } else if (!onboardingDone && !isAdmin && !currentIsHome) {
              // Not onboarded and not on Home — redirect to Home where modal lives
              navigate(createPageUrl("Home"), { replace: true });
            }
          } catch (error) {
              // Not authenticated
              setUser(null);
              base44.auth.redirectToLogin(window.location.pathname);
              return;
      }
    })();

    // Listen for subscription updates
    const handleSubscriptionUpdate = async () => {
      try {
        const refreshedUser = await base44.auth.me();
        setUser(refreshedUser);
      } catch (error) {
        console.error('Error refreshing user:', error);
      }
    };

    window.addEventListener('userSubscriptionUpdated', handleSubscriptionUpdate);

    return () => {
      cleanup?.();
      window.removeEventListener('userSubscriptionUpdated', handleSubscriptionUpdate);
    };
  }, [location.pathname, navigate]);







  // Navigation visibility
  const pathLower = location.pathname.toLowerCase();

  const isDocumentViewerPage = currentPageName === "DocumentViewer" || pathLower.includes("documentviewer");
  const isHomePage = currentPageName === "Home" || location.pathname === createPageUrl("Home") || location.pathname === "/" || location.pathname === "";

  // Lesson-aware sidebar swap: when inside a lesson, replace global nav items with lesson activities.
  // We listen to lesson-specific notification dots dispatched by DocumentViewer.
  const [lessonNavState, setLessonNavState] = React.useState({
    insideLesson: false,
    hasDocument: false,
    showStudyPlanDot: false,
    showFlashcardsDot: false,
    showTeachItDot: false,
    showExamDot: false,
    isCramActive: false,
    showCramTab: false,
  });

  React.useEffect(() => {
    const handler = (e) => setLessonNavState((prev) => ({ ...prev, ...(e.detail || {}) }));
    window.addEventListener('lessonNavStateUpdate', handler);
    return () => window.removeEventListener('lessonNavStateUpdate', handler);
  }, []);

  const onboardingDone = user?.onboarding_completed || user?.data?.onboarding_completed;
  const isAdmin = user?.role === 'admin';
  // Show navigation if user exists AND (onboarding done OR admin)
  const showNavigation = (!!user && (!!onboardingDone || !!isAdmin));
  const showSidebar = showNavigation;
  // Show mobile bottom nav for guests on key pages (CreateLesson, DocumentViewer) so they can navigate
  const isGuestOnActivePage = isGuest && (
    currentPageName === "CreateLesson" || currentPageName === "DocumentViewer"
  );
  
  const pagesWithCustomNav = ["Worksheet"];
  // While inside a lesson, MobileLessonView owns the entire mobile chrome
  // (top bar with back chevron + bottom nav with Chat/Flashcards/Quizzes/Teach It).
  // Hide the global mobile header and global mobile bottom nav to avoid a
  // double-stacked UI and to maximize 9:16 content area.
  const showMobileHeader = showNavigation && !isDocumentViewerPage && !isHomePage && !lessonNavState.insideLesson;
  const showMobileBottomNav = ((showNavigation && !pagesWithCustomNav.includes(currentPageName)) || isGuestOnActivePage) && !lessonNavState.insideLesson;
  const isMainTab = ["Home", "LessonHistory", "SmartGrader", "CreateLesson"].includes(currentPageName);



  return (
    <SidebarProvider>
      <div className={`min-h-screen flex w-full ${isDark ? 'bg-[#0a0a12]' : 'bg-slate-50'} relative`}>
        <style>{`
          /* Hide desktop sidebar on mobile */
          @media (max-width: 768px) {
            aside[data-sidebar] {
              display: none;
            }
          }
        `}</style>
        
        {/* Desktop Sidebar - Adaptive theme, fixed to viewport */}
          {showSidebar && (
            <div className={`hidden md:flex flex-col w-20 ${isDark ? 'bg-[#12121a] border-white/10' : 'bg-white border-slate-200'} border-r fixed top-0 left-0 h-screen z-40`}>
            {/* Logo */}
            <div className="p-3 flex justify-center">
              <Link to={createPageUrl("Home")} className="hover:opacity-80 transition-opacity">
                <img 
                  src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68ffadbdd9532e7e7691129d/127ee5758_StudyAppAI1024x1024px.png"
                  alt="StudyApp"
                  className="w-10 h-10 object-contain rounded-lg border-2 border-purple-500/30 shadow-sm"
                />
              </Link>
            </div>

            {/* Lesson-aware swap: show LessonSideNav inside a lesson, otherwise global nav */}
            <AnimatePresence mode="wait">
              {isDocumentViewerPage ? (
                <LessonSideNav
                  key="lesson"
                  isDark={isDark}
                  hasDocument={lessonNavState.hasDocument}
                  showStudyPlanDot={lessonNavState.showStudyPlanDot}
                  showFlashcardsDot={lessonNavState.showFlashcardsDot}
                  showTeachItDot={lessonNavState.showTeachItDot}
                  showExamDot={lessonNavState.showExamDot}
                  isCramActive={lessonNavState.isCramActive}
                  showCramTab={lessonNavState.showCramTab}
                />
              ) : (
                <motion.div
                  key="global"
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -8 }}
                  transition={{ duration: 0.2 }}
                  className="flex flex-col flex-1"
                >
            {/* Upload Button */}
            <div className="px-2 py-3">
              <Link
              to={createPageUrl("CreateLesson")}
              className="w-full min-h-[44px] py-3 rounded-xl bg-gradient-to-br from-purple-600 to-purple-700 hover:from-purple-500 hover:to-purple-600 flex flex-col items-center justify-center gap-1 shadow-lg shadow-purple-500/30 transition-all hover:scale-105"
              title="Upload Now"
              >
              <Plus className="w-5 h-5 text-white flex-shrink-0" />
              <span className="text-[9px] font-medium text-center leading-tight px-1 text-white truncate">Create</span>
              </Link>
            </div>

            {/* Navigation Icons */}
            <nav className="flex-1 flex flex-col items-center gap-1 px-2 py-2">
              {navigationItems.map((item) => {
                const currentPath = location.pathname.replace(/\/$/, '');
                const itemPath = item.url.replace(/\/$/, '');
                const isActive = currentPath === itemPath || 
                  (item.title === "Home" && (currentPath === '' || currentPath === '/'));

                return (
                  <Link
                    key={item.title}
                    to={item.url}
                    className={`relative w-full min-h-[44px] py-3 rounded-xl flex flex-col items-center justify-center gap-1 transition-all ${
                      isActive 
                        ? 'bg-purple-600/20 text-purple-400 shadow-sm' 
                        : isDark ? 'text-slate-400 hover:bg-white/5 hover:text-slate-200' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                    title={item.title}
                  >
                    <item.icon className="w-5 h-5 flex-shrink-0" />
                    <span className="text-[9px] font-medium text-center leading-tight px-1 truncate">{item.title}</span>
                    {item.isNew && (
                      <span className="absolute top-1 right-1 w-2 h-2 bg-emerald-500 rounded-full" />
                    )}
                  </Link>
                );
              })}

              {/* Feedback/Email icon */}
              <button
                onClick={() => setFeedbackModalOpen(true)}
                className={`relative w-full min-h-[44px] py-3 rounded-xl flex flex-col items-center justify-center gap-1 transition-all ${isDark ? 'text-slate-400 hover:bg-white/5 hover:text-slate-200' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}
                title="Send Feedback"
              >
                <Mail className="w-5 h-5 flex-shrink-0" />
                <span className="text-[9px] font-medium text-center leading-tight px-1 truncate">Feedback</span>
              </button>

              {/* Upgrade Badge */}
              <UpgradeNavBadge isDark={isDark} />
              </nav>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Bottom: Theme + Admin + Settings + Profile */}
            <div className="p-2 space-y-1">
              {/* Theme Toggle — sits right above Admin / Settings for easy access */}
              <button
                onClick={toggleTheme}
                className={`relative w-full min-h-[44px] py-3 rounded-xl flex flex-col items-center justify-center gap-1 transition-all ${isDark ? 'text-slate-400 hover:bg-white/5 hover:text-slate-200' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-800'}`}
                title={isDark ? 'Light Mode' : 'Dark Mode'}
              >
                {isDark ? <Sun className="w-5 h-5 flex-shrink-0" /> : <Moon className="w-5 h-5 flex-shrink-0" />}
                <span className="text-[9px] font-medium text-center leading-tight px-1 truncate">Theme</span>
              </button>

              {/* Admin Dashboard (if admin) */}
              {user?.role === 'admin' && (
                <Link
                  to={createPageUrl("AdminPreMadeCourses")}
                  className={`relative w-full min-h-[44px] py-3 rounded-xl flex flex-col items-center justify-center gap-1 transition-all ${
                    location.pathname.replace(/\/$/, '') === createPageUrl("AdminPreMadeCourses").replace(/\/$/, '')
                      ? 'bg-purple-600/20 text-purple-400 shadow-sm' 
                      : isDark ? 'text-slate-400 hover:bg-white/5 hover:text-slate-200' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                  title="Admin Dashboard"
                >
                  <Sparkles className="w-5 h-5 flex-shrink-0" />
                  <span className="text-[9px] font-medium text-center leading-tight px-1 truncate">Admin</span>
                </Link>
              )}
              
              {/* Settings Icon */}
              <Link
                to={createPageUrl("Settings")}
                className={`relative w-full min-h-[44px] py-3 rounded-xl flex flex-col items-center justify-center gap-1 transition-all ${
                  location.pathname.replace(/\/$/, '') === createPageUrl("Settings").replace(/\/$/, '')
                    ? 'bg-purple-600/20 text-purple-400 shadow-sm' 
                    : isDark ? 'text-slate-400 hover:bg-white/5 hover:text-slate-200' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
                title="Settings"
              >
                <Settings className="w-5 h-5 flex-shrink-0" />
                <span className="text-[9px] font-medium text-center leading-tight px-1 truncate">Settings</span>
              </Link>
              
              {/* Profile Avatar */}
              {user && (
                <button
                  onClick={() => navigate(createPageUrl("Settings"))}
                  className="w-full min-h-[44px] py-3 rounded-xl hover:bg-purple-600/20 flex flex-col items-center justify-center gap-1 transition-all"
                  title={user.full_name || 'Profile'}
                >
                  <div className="w-8 h-8 bg-gradient-to-br from-purple-600 to-purple-700 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-white font-bold text-sm">
                      {user.full_name?.[0]?.toUpperCase() || 'U'}
                    </span>
                  </div>
                  <span className="text-[9px] font-medium text-center leading-tight px-1 text-slate-500 truncate">{user.full_name || 'Profile'}</span>
                </button>
              )}
            </div>
          </div>
        )}

        <main className={`flex-1 flex flex-col ${showSidebar ? 'md:ml-20' : ''}`}>
          {/* Mobile Header */}
            {showMobileHeader && (
            <header 
              className={`${isDark ? 'bg-[#12121a]/95 border-white/10' : 'bg-white/95 border-slate-200'} backdrop-blur-xl border-b px-3 py-2 md:hidden sticky top-0 z-50`}
              style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
            >
              <div className="flex items-center justify-center relative h-11">
                {!isMainTab ? (
                  <>
                    <button 
                      onClick={() => {
                        const settingsPages = ['ProfileInformation', 'ChangePassword', 'ManageSubscription', 'EmailManager', 'PricingPlans'];
                        if (settingsPages.includes(currentPageName)) {
                          navigate(createPageUrl("Settings"));
                        } else if (currentPageName === 'GradeResults' || currentPageName === 'DocumentViewer') {
                          navigate(createPageUrl("LessonHistory"));
                        } else {
                          navigate(createPageUrl("Home"));
                        }
                      }}
                      className={`absolute left-0 w-11 h-11 flex items-center justify-center rounded-lg ${isDark ? 'text-slate-300 hover:bg-white/10' : 'text-slate-600 hover:bg-slate-100'}`}
                    >
                      <ArrowLeft className="w-5 h-5" />
                    </button>
                    <span className={`font-bold text-sm truncate px-10 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                      {currentPageName.replace(/([A-Z])/g, ' $1').trim()}
                    </span>
                  </>
                ) : (
                  <Link to={createPageUrl("Home")} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                      <img 
                        src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68ffadbdd9532e7e7691129d/e6f13a569_LogoOnly.png"
                        alt="StudyApp Logo"
                        className="w-6 h-6"
                      />
                      <span className="font-bold text-sm">
                            <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">Study</span>
                            <span className={isDark ? 'text-white' : 'text-slate-900'}>App</span>
                          </span>
                  </Link>
                )}
              </div>
            </header>
          )}

          <div className="flex-1 md:overflow-auto pb-0 md:pb-0 scrollbar-hide">
            {children}
          </div>



          {/* Mobile Bottom Navigation */}
            {showMobileBottomNav && (
            <nav 
              className={`md:hidden fixed bottom-0 left-0 right-0 ${isDark ? 'bg-[#12121a] border-white/10' : 'bg-white border-slate-200'} border-t z-[9999]`}
              style={{ 
                paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 8px)',
                minHeight: '60px'
              }}
            >
              <div className="flex items-center justify-between max-w-lg mx-auto relative px-6 py-3">
                <Link
                  to={createPageUrl("Home")}
                  onClick={(e) => {
                    if (location.pathname === createPageUrl("Home") || location.pathname === "/") {
                      e.preventDefault();
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }
                  }}
                  className={`flex items-center justify-center w-11 h-11 rounded-xl transition-all ${
                    location.pathname === createPageUrl("Home") || location.pathname === "/"
                      ? 'text-purple-400 bg-purple-600/20'
                      : isDark ? 'text-slate-400' : 'text-slate-600'
                  }`}
                >
                  <Home className="w-6 h-6" />
                </Link>

                <button
                  onClick={() => setFeedbackModalOpen(true)}
                  className={`flex items-center justify-center w-11 h-11 rounded-xl transition-all ${isDark ? 'text-slate-400' : 'text-slate-600'} hover:text-purple-400 hover:bg-purple-600/20`}
                >
                  <Mail className="w-6 h-6" />
                </button>

                {/* Space for center CTA */}
                <div className="w-16" />

                <Link
                  to={createPageUrl("LessonHistory")}
                  onClick={(e) => {
                    if (location.pathname === createPageUrl("LessonHistory")) {
                      e.preventDefault();
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }
                  }}
                  className={`flex items-center justify-center w-11 h-11 rounded-xl transition-all ${
                    location.pathname === createPageUrl("LessonHistory")
                      ? 'text-purple-400 bg-purple-600/20'
                      : isDark ? 'text-slate-400' : 'text-slate-600'
                  }`}
                >
                  <History className="w-6 h-6" />
                </Link>

                {/* Settings: hide for guests — they don't need it */}
                {!isGuest && (
                  <Link
                    to={createPageUrl("Settings")}
                    onClick={(e) => {
                      if (location.pathname === createPageUrl("Settings")) {
                        e.preventDefault();
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }
                    }}
                    className={`flex items-center justify-center w-11 h-11 rounded-xl transition-all ${
                      location.pathname === createPageUrl("Settings")
                        ? 'text-purple-400 bg-purple-600/20'
                        : isDark ? 'text-slate-400' : 'text-slate-600'
                    }`}
                  >
                    <Settings className="w-6 h-6" />
                  </Link>
                )}

                {/* Upload CTA Button */}
                <Link
                  to={createPageUrl("CreateLesson")}
                  className="absolute left-1/2 -translate-x-1/2 -top-5 group"
                >
                  <div className="relative">
                    {/* Subtle glow */}
                    <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 blur-xl opacity-50 group-hover:opacity-70 transition-opacity" />

                    {/* Main button - Upload icon */}
                    <div className={`relative w-14 h-14 bg-gradient-to-br from-purple-600 via-purple-700 to-indigo-700 rounded-2xl shadow-xl ring-4 ${isDark ? 'ring-[#12121a]' : 'ring-white'} flex items-center justify-center transform group-hover:scale-105 transition-transform duration-200`}>
                      <Upload className="w-7 h-7 text-white" strokeWidth={2.5} />
                    </div>
                  </div>
                </Link>
              </div>
            </nav>
          )}
        </main>



        {/* CreateLessonModal removed - using CreateLesson page instead */}



        {/* Floating AI Tutor Button — hidden inside a lesson on mobile because
            the lesson's bottom nav already has a dedicated Chat tab. */}
        {showNavigation && <AITutorFloatingButton hidden={lessonNavState.insideLesson} />}

        {/* Feedback Modal */}
        <FeedbackModal open={feedbackModalOpen} onOpenChange={setFeedbackModalOpen} />

        {/* AI Tutor Sheet - Mobile contextual helper */}
        <AITutorSheet />

        {/* Global Upgrade Modal */}
        <UpgradeModalWrapper />

        {/* Guest Timer Lockout */}
        <GuestTimerLockout />

        {/* Global badge unlock celebrations — fires from any page when awardDailyXP unlocks a badge */}
        <GlobalBadgeListener />

        </div>
        </SidebarProvider>
        );
        }

        export default function Layout({ children, currentPageName }) {
        return (
        <PostHogProvider
        apiKey='phc_CW2ahMtxlaEYnd9YbML39HMb1xJMfMqLVj7w2qbwnZY'
        options={{
        api_host: 'https://us.i.posthog.com',
        defaults: '2026-01-30',
        }}
        >
        <ThemeProvider>
        <GuestSessionProvider>
        <SubscriptionProvider>
        <AITutorProvider>
          <LayoutContent children={children} currentPageName={currentPageName} />
        </AITutorProvider>
        </SubscriptionProvider>
        </GuestSessionProvider>
        </ThemeProvider>
        </PostHogProvider>
        );
        }