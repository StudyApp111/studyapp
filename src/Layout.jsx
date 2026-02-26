import React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Home, BookOpen, Trophy, History, LogOut, Settings, Plus, Flame, Award, CheckCircle, Clock, FileCheck as FileCheckIcon, TrendingUp, Map, Sparkles, Users, MessageSquareText, Mail, ChevronDown, ChevronRight, Upload, FileCheck } from "lucide-react";
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
import { trackUserSession, trackSessionDuration } from "@/components/utils/userTracking";
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

// TikTok Pixel initialization
const initTikTokPixel = () => {
  if (window.ttq) return; // Already initialized
  
  !function (w, d, t) {
    w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie","holdConsent","revokeConsent","grantConsent"],ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(
    var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e},ttq.load=function(e,n){var r="https://analytics.tiktok.com/i18n/pixel/events.js",o=n&&n.partner;ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=r,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};n=document.createElement("script")
    ;n.type="text/javascript",n.async=!0,n.src=r+"?sdkid="+e+"&lib="+t;e=document.getElementsByTagName("script")[0];e.parentNode.insertBefore(n,e)};
    ttq.load('D5RDOBBC77U2HKOKRPCG');
    ttq.page();
  }(window, document, 'ttq');
};
// CreateLessonModal replaced with CreateLesson page for better UX

// BrowserCompatibilityBanner removed — in-app browser detection now handled inline in onboarding sign-in step
import FeedbackModal from "@/components/feedback/FeedbackModal.jsx";
import AITutorFloatingButton from "@/components/modals/AITutorFloatingButton.jsx";

import { AITutorProvider } from "@/components/ai-tutor/AITutorContext";
import AITutorSheet from "@/components/ai-tutor/AITutorSheet";
import { SubscriptionProvider } from "@/components/subscription/SubscriptionContext";
import { UpgradeNavBadge } from "@/components/subscription/UpgradeBadge";
import UpgradeModalWrapper from "@/components/subscription/UpgradeModalWrapper";
import { ThemeProvider, useTheme } from "@/components/theme/ThemeProvider";
import { Moon, Sun } from "lucide-react";
import { GuestSessionProvider, useGuestSession } from "@/components/guest/GuestSessionContext";
import GuestTimerLockout from "@/components/guest/GuestTimerLockout";

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
    initTikTokPixel();

    let cleanup;
    (async () => {
      const currentIsHome = currentPageName === "Home" || location.pathname === createPageUrl("Home") || location.pathname === "/" || location.pathname === "";
      
      // Force redirect to Home if platform default page is misconfigured (e.g. AssignmentHistory)
      const isAssignmentHistory = currentPageName === "AssignmentHistory" || location.pathname.toLowerCase().includes("assignmenthistory");
      
      // Try to get user
      try {
        const currentUser = await base44.auth.me();
        setUser(currentUser);

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
            
            // PostHog: Guest → signup conversion
            try {
              posthog.capture('guest_signup_conversion', {
                user_email: currentUser.email,
                lesson_id: transferData?.lesson_id || returningGuestLessonId,
                transfer_success: !!transferData?.lesson_id,
              });
            } catch {}

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
              // Allow guests to access these pages (they see auth gates on locked pages)
              const guestAllowedPages = ['Home', 'CreateLesson', 'DocumentViewer', 'Settings', 'SmartGrader', 'LessonHistory'];
              const isGuestAllowed = isGuest && guestAllowedPages.some(p => 
                currentPageName === p || location.pathname.toLowerCase().includes(p.toLowerCase())
              );
              if (isAssignmentHistory || (!currentIsHome && !isGuestAllowed)) {
                navigate(createPageUrl("Home"), { replace: true });
              }
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

  const onboardingDone = user?.onboarding_completed || user?.data?.onboarding_completed;
  const isAdmin = user?.role === 'admin';
  // Show navigation if user exists AND (onboarding done OR admin), OR if guest with a lesson created
  const showNavigation = (!!user && (!!onboardingDone || !!isAdmin)) || (isGuest && !!guestData?.lessonData);
  const showSidebar = showNavigation;
  
  const pagesWithCustomNav = ["Worksheet"];
  const showMobileHeader = showNavigation && !isDocumentViewerPage && !isHomePage;
  const showMobileBottomNav = showNavigation && !pagesWithCustomNav.includes(currentPageName);



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
            <div className={`hidden md:flex flex-col w-16 ${isDark ? 'bg-[#12121a] border-white/10' : 'bg-white border-slate-200'} border-r fixed top-0 left-0 h-screen z-40`}>
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

            {/* Upload Button */}
            <div className="px-2 py-3">
              <Link
                to={createPageUrl("CreateLesson")}
                className="w-full aspect-square rounded-xl bg-gradient-to-br from-purple-600 to-purple-700 hover:from-purple-500 hover:to-purple-600 flex items-center justify-center shadow-lg shadow-purple-500/30 transition-all hover:scale-105"
                title="Upload Now"
              >
                <Plus className="w-5 h-5 text-white" />
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
                    className={`relative w-full aspect-square rounded-xl flex items-center justify-center transition-all ${
                      isActive 
                        ? 'bg-purple-600/20 text-purple-400 shadow-sm' 
                        : isDark ? 'text-slate-400 hover:bg-white/5 hover:text-slate-200' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                    title={item.title}
                  >
                    <item.icon className="w-5 h-5" />
                    {item.isNew && (
                      <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-emerald-500 rounded-full" />
                    )}
                  </Link>
                );
              })}

              {/* Feedback/Email icon - hide for guests */}
              {!isGuest && (
                <button
                  onClick={() => setFeedbackModalOpen(true)}
                  className={`relative w-full aspect-square rounded-xl flex items-center justify-center transition-all ${isDark ? 'text-slate-400 hover:bg-white/5 hover:text-slate-200' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}
                  title="Send Feedback"
                >
                  <Mail className="w-5 h-5" />
                </button>
              )}

              {/* Upgrade Badge - hide for guests */}
              {!isGuest && <UpgradeNavBadge isDark={isDark} />}

              {/* Theme Toggle */}
              <button
                onClick={toggleTheme}
                className={`relative w-full aspect-square rounded-xl flex items-center justify-center transition-all ${isDark ? 'text-slate-400 hover:bg-white/5 hover:text-slate-200' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-800'}`}
                title={isDark ? 'Light Mode' : 'Dark Mode'}
              >
                {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>
              </nav>

            {/* Bottom: Settings + Profile */}
            <div className="p-2 space-y-1">
              {/* Settings Icon */}
              <Link
                to={createPageUrl("Settings")}
                className={`relative w-full aspect-square rounded-xl flex items-center justify-center transition-all ${
                  location.pathname.replace(/\/$/, '') === createPageUrl("Settings").replace(/\/$/, '')
                    ? 'bg-purple-600/20 text-purple-400 shadow-sm' 
                    : isDark ? 'text-slate-400 hover:bg-white/5 hover:text-slate-200' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
                title="Settings"
              >
                <Settings className="w-5 h-5" />
              </Link>
              
              {/* Profile Avatar */}
              {(user || isGuest) && (
                <button
                  onClick={() => navigate(createPageUrl("Settings"))}
                  className="w-full aspect-square rounded-xl bg-white/5 hover:bg-purple-600/20 flex items-center justify-center transition-all"
                  title={user?.full_name || guestData?.name || 'Guest'}
                >
                  <div className="w-8 h-8 bg-gradient-to-br from-purple-600 to-purple-700 rounded-full flex items-center justify-center">
                    <span className="text-white font-bold text-sm">
                      {user?.full_name?.[0]?.toUpperCase() || guestData?.name?.[0]?.toUpperCase() || 'G'}
                    </span>
                  </div>
                </button>
              )}
            </div>
          </div>
        )}

        <main className={`flex-1 flex flex-col ${showSidebar ? 'md:ml-16' : ''}`}>
          {/* Mobile Header */}
            {showMobileHeader && (
            <header className={`${isDark ? 'bg-[#12121a]/95 border-white/10' : 'bg-white/95 border-slate-200'} backdrop-blur-xl border-b px-3 py-2 md:hidden`}>
              <div className="flex items-center justify-center">
                {/* Logo + App Name - centered */}
                <Link to={createPageUrl("Home")} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                    <img 
                      src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68ffadbdd9532e7e7691129d/e6f13a569_LogoOnly.png"
                      alt="StudyApp Logo"
                      className="w-6 h-6"
                    />
                    <span className="font-bold text-sm">
                          <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">Study</span>
                          <span className="text-white">App</span>
                        </span>
                  </Link>
              </div>
            </header>
          )}

          <div className="flex-1 md:overflow-auto pb-0 md:pb-0">
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
                  className={`flex items-center justify-center p-2.5 rounded-xl transition-all ${
                    location.pathname === createPageUrl("Home")
                      ? 'text-purple-400 bg-purple-600/20'
                      : isDark ? 'text-slate-400' : 'text-slate-600'
                  }`}
                >
                  <Home className="w-6 h-6" />
                </Link>

                {!isGuest && (
                  <button
                    onClick={() => setFeedbackModalOpen(true)}
                    className={`flex items-center justify-center p-2.5 rounded-xl transition-all ${isDark ? 'text-slate-400' : 'text-slate-600'} hover:text-purple-400 hover:bg-purple-600/20`}
                  >
                    <Mail className="w-6 h-6" />
                  </button>
                )}
                {isGuest && (
                  <Link
                    to={createPageUrl("SmartGrader")}
                    className={`flex items-center justify-center p-2.5 rounded-xl transition-all ${
                      location.pathname.toLowerCase().includes('smartgrader')
                        ? 'text-purple-400 bg-purple-600/20'
                        : isDark ? 'text-slate-400' : 'text-slate-600'
                    }`}
                  >
                    <FileCheck className="w-6 h-6" />
                  </Link>
                )}

                {/* Space for center CTA */}
                <div className="w-16" />

                <Link
                  to={createPageUrl("LessonHistory")}
                  className={`flex items-center justify-center p-2.5 rounded-xl transition-all ${
                    location.pathname === createPageUrl("LessonHistory")
                      ? 'text-purple-400 bg-purple-600/20'
                      : isDark ? 'text-slate-400' : 'text-slate-600'
                  }`}
                >
                  <History className="w-6 h-6" />
                </Link>

                <Link
                  to={createPageUrl("Settings")}
                  className={`flex items-center justify-center p-2.5 rounded-xl transition-all ${
                    location.pathname === createPageUrl("Settings")
                      ? 'text-purple-400 bg-purple-600/20'
                      : isDark ? 'text-slate-400' : 'text-slate-600'
                  }`}
                >
                  <Settings className="w-6 h-6" />
                </Link>

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



        {/* Floating AI Tutor Button */}
        {showNavigation && <AITutorFloatingButton hidden={false} />}

        {/* Feedback Modal */}
        <FeedbackModal open={feedbackModalOpen} onOpenChange={setFeedbackModalOpen} />

        {/* AI Tutor Sheet - Mobile contextual helper */}
        <AITutorSheet />

        {/* Global Upgrade Modal */}
        <UpgradeModalWrapper />

        {/* Guest Timer Lockout */}
        <GuestTimerLockout />

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