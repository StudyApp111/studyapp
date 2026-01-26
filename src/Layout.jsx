import React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Home, BookOpen, Trophy, History, LogOut, Settings, Plus, Flame, Award, CheckCircle, Clock, FileCheck, TrendingUp, Map, Sparkles, Users, MessageSquareText, Mail, ChevronDown, ChevronRight, Upload } from "lucide-react";
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

import BrowserCompatibilityBanner from "@/components/utils/BrowserCompatibility";
import FeedbackModal from "@/components/feedback/FeedbackModal.jsx";
import AITutorFloatingButton from "@/components/modals/AITutorFloatingButton.jsx";

import { AITutorProvider } from "@/components/ai-tutor/AITutorContext";
import AITutorSheet from "@/components/ai-tutor/AITutorSheet";
import { SubscriptionProvider } from "@/components/subscription/SubscriptionContext";
import { UpgradeNavBadge } from "@/components/subscription/UpgradeBadge";
import UpgradeModalWrapper from "@/components/subscription/UpgradeModalWrapper";

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

export default function Layout({ children, currentPageName }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [user, setUser] = React.useState(null);
  // CreateLessonModal replaced with CreateLesson page
  const [feedbackModalOpen, setFeedbackModalOpen] = React.useState(false);

  React.useEffect(() => {
    // Initialize TikTok Pixel
    initTikTokPixel();
    
    let cleanup;
    (async () => {
      try {
        const currentUser = await base44.auth.me();
        setUser(currentUser);
        
        if (!currentUser.onboarding_completed && location.pathname !== createPageUrl("Onboarding")) {
          navigate(createPageUrl("Onboarding"), { replace: true });
          return;
        }
        
        trackUserSession();
        cleanup = trackSessionDuration();
      } catch (error) {
        base44.auth.redirectToLogin(window.location.pathname + window.location.search);
      }
    })();
    
    return () => cleanup?.();
  }, []);







  const isOnboardingPage = location.pathname === createPageUrl("Onboarding");
  const isDocumentViewerPage = currentPageName === "DocumentViewer" || location.pathname === createPageUrl("DocumentViewer");
  const showNavigation = user?.onboarding_completed || isOnboardingPage;
  const showSidebar = showNavigation && !isOnboardingPage;
  const pagesWithCustomNav = ["DiagnosticQuiz", "Worksheet"];
  const showMobileHeader = !isDocumentViewerPage;
  const showMobileBottomNav = !pagesWithCustomNav.includes(currentPageName);



  return (
    <SubscriptionProvider>
    <AITutorProvider>
    <SidebarProvider>
      <BrowserCompatibilityBanner />
      <div className="min-h-screen flex w-full bg-slate-900 relative">
        <style>{`
          /* Hide desktop sidebar on mobile */
          @media (max-width: 768px) {
            aside[data-sidebar] {
              display: none;
            }
          }
        `}</style>
        
        {/* Desktop Sidebar - Dark theme, fixed to viewport */}
        {showSidebar && (
          <div className="hidden md:flex flex-col w-16 bg-slate-800 border-r border-slate-700 shadow-sm fixed top-0 left-0 h-screen z-40">
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
                        : 'text-slate-400 hover:bg-slate-700 hover:text-slate-200'
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

              {/* Feedback/Email icon */}
              <button
                onClick={() => setFeedbackModalOpen(true)}
                className="relative w-full aspect-square rounded-xl flex items-center justify-center transition-all text-slate-400 hover:bg-slate-700 hover:text-slate-200"
                title="Send Feedback"
              >
                <Mail className="w-5 h-5" />
              </button>

              {/* Upgrade Badge */}
              <UpgradeNavBadge />
              </nav>

            {/* Bottom: Settings + Profile */}
            <div className="p-2 space-y-1">
              {/* Settings Icon */}
              <Link
                to={createPageUrl("Settings")}
                className={`relative w-full aspect-square rounded-xl flex items-center justify-center transition-all ${
                  location.pathname.replace(/\/$/, '') === createPageUrl("Settings").replace(/\/$/, '')
                    ? 'bg-purple-600/20 text-purple-400 shadow-sm' 
                    : 'text-slate-400 hover:bg-slate-700 hover:text-slate-200'
                }`}
                title="Settings"
              >
                <Settings className="w-5 h-5" />
              </Link>
              
              {/* Profile Avatar */}
              {user && (
                <button
                  onClick={() => navigate(createPageUrl("Settings"))}
                  className="w-full aspect-square rounded-xl bg-slate-700 hover:bg-purple-600/20 flex items-center justify-center transition-all"
                  title={user.full_name || 'Profile'}
                >
                  <div className="w-8 h-8 bg-gradient-to-br from-purple-600 to-purple-700 rounded-full flex items-center justify-center">
                    <span className="text-white font-bold text-sm">
                      {user.full_name?.[0]?.toUpperCase() || 'U'}
                    </span>
                  </div>
                </button>
              )}
            </div>
          </div>
        )}

        <main className="flex-1 flex flex-col md:ml-16">
          {/* Mobile Header - Hidden during onboarding and on DocumentViewer */}
          {showNavigation && !isOnboardingPage && showMobileHeader && (
            <header className="bg-slate-800/95 backdrop-blur-xl border-b border-slate-700 px-3 py-2 md:hidden">
              <div className="flex items-center justify-center">
                {/* Logo + App Name - centered */}
                <Link to={createPageUrl("Home")} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                  <img 
                    src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68ffadbdd9532e7e7691129d/e6f13a569_LogoOnly.png"
                    alt="StudyApp Logo"
                    className="w-6 h-6"
                  />
                  <span className="font-bold text-slate-100 text-sm">StudyApp</span>
                </Link>
              </div>
            </header>
          )}

          <div className="flex-1 md:overflow-auto pb-0 md:pb-0">
            {children}
          </div>



          {/* Mobile Bottom Navigation - Hidden during onboarding and on pages with custom nav */}
          {showNavigation && !isOnboardingPage && showMobileBottomNav && (
            <nav 
              className="md:hidden fixed bottom-0 left-0 right-0 bg-slate-800 border-t border-slate-700 z-[9999]"
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
                      : 'text-slate-400'
                  }`}
                >
                  <Home className="w-6 h-6" />
                </Link>

                <Link
                  to={createPageUrl("LessonHistory")}
                  className={`flex items-center justify-center p-2.5 rounded-xl transition-all ${
                    location.pathname === createPageUrl("LessonHistory")
                      ? 'text-purple-400 bg-purple-600/20'
                      : 'text-slate-400'
                  }`}
                >
                  <History className="w-6 h-6" />
                </Link>

                {/* Space for center CTA */}
                <div className="w-16" />

                <button
                  onClick={() => setFeedbackModalOpen(true)}
                  className="flex items-center justify-center p-2.5 rounded-xl transition-all text-slate-400 hover:text-purple-400 hover:bg-purple-600/20"
                >
                  <Mail className="w-6 h-6" />
                </button>

                <Link
                  to={createPageUrl("Settings")}
                  className={`flex items-center justify-center p-2.5 rounded-xl transition-all ${
                    location.pathname === createPageUrl("Settings")
                      ? 'text-purple-400 bg-purple-600/20'
                      : 'text-slate-400'
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
                    <div className="relative w-14 h-14 bg-gradient-to-br from-purple-600 via-purple-700 to-indigo-700 rounded-2xl shadow-xl ring-4 ring-slate-800 flex items-center justify-center transform group-hover:scale-105 transition-transform duration-200">
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
        {showNavigation && !isOnboardingPage && <AITutorFloatingButton hidden={false} />}

        {/* Feedback Modal */}
        <FeedbackModal open={feedbackModalOpen} onOpenChange={setFeedbackModalOpen} />

        {/* AI Tutor Sheet - Mobile contextual helper */}
        <AITutorSheet />

        {/* Global Upgrade Modal */}
        <UpgradeModalWrapper />

        </div>
        </SidebarProvider>
        </AITutorProvider>
        </SubscriptionProvider>
        );
        }