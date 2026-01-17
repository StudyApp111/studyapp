import React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Home, BookOpen, Trophy, History, LogOut, Settings, Plus, Flame, Award, CheckCircle, Clock, FileCheck, TrendingUp, Map, Sparkles, Users, MessageSquareText, MessageCircle, ChevronDown, ChevronRight } from "lucide-react";
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
import CreateLessonModal from "@/components/modals/CreateLessonModal";

import BrowserCompatibilityBanner from "@/components/utils/BrowserCompatibility";
import FeedbackModal from "@/components/feedback/FeedbackModal.jsx";
import AITutorFloatingButton from "@/components/modals/AITutorFloatingButton.jsx";

import { AITutorProvider } from "@/components/ai-tutor/AITutorContext";
import AITutorSheet from "@/components/ai-tutor/AITutorSheet";

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
        {
          title: "Settings",
          url: createPageUrl("Settings"),
          icon: Settings,
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
  const [createLessonModalOpen, setCreateLessonModalOpen] = React.useState(false);
  const [feedbackModalOpen, setFeedbackModalOpen] = React.useState(false);

  React.useEffect(() => {
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
  const isDocumentViewerPage = currentPageName === "DocumentViewer";
  const showNavigation = user?.onboarding_completed || isOnboardingPage;
  const showSidebar = showNavigation && !isOnboardingPage;
  const pagesWithCustomNav = ["DiagnosticQuiz", "Worksheet"];
  const pagesWithCustomMobileHeader = ["DocumentViewer"];
  const showMobileHeader = !pagesWithCustomMobileHeader.includes(currentPageName);
  const showMobileBottomNav = !pagesWithCustomNav.includes(currentPageName);



  return (
    <AITutorProvider>
    <SidebarProvider>
      <BrowserCompatibilityBanner />
      <div className="min-h-screen flex w-full bg-gradient-to-br from-purple-50 via-yellow-50/30 to-purple-100/40 relative">
        <style>{`
          :root {
            --primary: 270 50% 50%;
            --primary-foreground: 0 0% 100%;
            --secondary: 45 100% 85%;
            --accent: 280 60% 60%;
          }
          
          /* Hide desktop sidebar on mobile */
          @media (max-width: 768px) {
            aside[data-sidebar] {
              display: none;
            }
          }
        `}</style>
        
        {/* Desktop Sidebar - White theme */}
        {showSidebar && (
          <div className="hidden md:flex flex-col w-16 bg-white border-r border-slate-200 shadow-sm">
            {/* Logo */}
            <div className="p-3 flex justify-center">
              <Link to={createPageUrl("Home")} className="hover:opacity-80 transition-opacity">
                <img 
                  src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68ffadbdd9532e7e7691129d/127ee5758_StudyAppAI1024x1024px.png"
                  alt="StudyApp"
                  className="w-10 h-10 object-contain rounded-lg border-2 border-purple-200 shadow-sm"
                />
              </Link>
            </div>

            {/* Upload Button */}
            <div className="px-2 py-3">
              <button
                onClick={() => setCreateLessonModalOpen(true)}
                className="w-full aspect-square rounded-xl bg-gradient-to-br from-purple-600 to-purple-700 hover:from-purple-500 hover:to-purple-600 flex items-center justify-center shadow-lg shadow-purple-500/30 transition-all hover:scale-105"
                title="Upload Now"
              >
                <Plus className="w-5 h-5 text-white" />
              </button>
            </div>

            {/* Navigation Icons */}
            <nav className="flex-1 flex flex-col items-center gap-1 px-2 py-2">
              {navigationItems.map((item, index) => {
                const isActive = location.pathname === item.url;
                const isLessonHistory = item.title === "Lesson History";

                return (
                  <Link
                    key={item.title}
                    to={item.url}
                    className={`relative w-full aspect-square rounded-xl flex items-center justify-center transition-all ${
                      isActive 
                        ? 'bg-purple-100 text-purple-700 shadow-sm' 
                        : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
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
            </nav>

            {/* Bottom: Profile */}
            <div className="p-2 space-y-2">
              {user && (
                <button
                  onClick={() => navigate(createPageUrl("Settings"))}
                  className="w-full aspect-square rounded-xl bg-slate-100 hover:bg-purple-100 flex items-center justify-center transition-all"
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

        <main className="flex-1 flex flex-col">
          {/* Mobile Header - Hidden during onboarding and on DocumentViewer */}
          {showNavigation && !isOnboardingPage && showMobileHeader && (
            <header className="bg-white/95 backdrop-blur-xl border-b border-purple-100 px-3 py-2 md:hidden">
              <div className="flex items-center justify-center">
                {/* Logo + App Name - centered */}
                <Link to={createPageUrl("Home")} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                  <img 
                    src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68ffadbdd9532e7e7691129d/e6f13a569_LogoOnly.png"
                    alt="StudyApp Logo"
                    className="w-6 h-6"
                  />
                  <span className="font-bold text-slate-900 text-sm">StudyApp</span>
                </Link>
              </div>
            </header>
          )}

          <div className="flex-1 overflow-auto pb-24 md:pb-0">
            {children}
          </div>



          {/* Mobile Bottom Navigation - Hidden during onboarding and on pages with custom nav */}
          {showNavigation && !isOnboardingPage && showMobileBottomNav && (
            <nav 
              className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 z-[9999]"
              style={{ paddingBottom: 'env(safe-area-inset-bottom, 8px)' }}
            >
              <div className="flex items-center justify-between max-w-lg mx-auto relative px-6 py-3">
                <Link
                  to={createPageUrl("Home")}
                  className={`flex items-center justify-center p-2.5 rounded-xl transition-all ${
                    location.pathname === createPageUrl("Home")
                      ? 'text-purple-600 bg-purple-50'
                      : 'text-slate-500'
                  }`}
                >
                  <Home className="w-6 h-6" />
                </Link>

                <Link
                  to={createPageUrl("LessonHistory")}
                  className={`flex items-center justify-center p-2.5 rounded-xl transition-all ${
                    location.pathname === createPageUrl("LessonHistory")
                      ? 'text-purple-600 bg-purple-50'
                      : 'text-slate-500'
                  }`}
                >
                  <History className="w-6 h-6" />
                </Link>

                {/* Space for center CTA */}
                <div className="w-16" />

                <button
                  onClick={() => setFeedbackModalOpen(true)}
                  className="flex items-center justify-center p-2.5 rounded-xl transition-all text-slate-500 hover:text-purple-600 hover:bg-purple-50"
                >
                  <MessageCircle className="w-6 h-6" />
                </button>

                <Link
                  to={createPageUrl("Settings")}
                  className={`flex items-center justify-center p-2.5 rounded-xl transition-all ${
                    location.pathname === createPageUrl("Settings")
                      ? 'text-purple-600 bg-purple-50'
                      : 'text-slate-500'
                  }`}
                >
                  <Settings className="w-6 h-6" />
                </Link>

                {/* Upload CTA Button */}
                <button
                  onClick={() => setCreateLessonModalOpen(true)}
                  className="absolute left-1/2 -translate-x-1/2 -top-5 group"
                >
                  <div className="relative">
                    {/* Subtle glow */}
                    <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 blur-xl opacity-50 group-hover:opacity-70 transition-opacity" />

                    {/* Main button - Upload icon */}
                    <div className="relative w-14 h-14 bg-gradient-to-br from-purple-600 via-purple-700 to-indigo-700 rounded-2xl shadow-xl ring-4 ring-white flex items-center justify-center transform group-hover:scale-105 transition-transform duration-200">
                      <Plus className="w-7 h-7 text-white" strokeWidth={2.5} />
                    </div>
                  </div>
                </button>
              </div>
            </nav>
          )}
        </main>



        {/* Create Lesson Modal */}
        <CreateLessonModal 
          open={createLessonModalOpen} 
          onOpenChange={setCreateLessonModalOpen} 
        />



        {/* Floating AI Tutor Button */}
        {showNavigation && !isOnboardingPage && <AITutorFloatingButton hidden={createLessonModalOpen} />}

        {/* Feedback Modal */}
        <FeedbackModal open={feedbackModalOpen} onOpenChange={setFeedbackModalOpen} />

        {/* AI Tutor Sheet - Mobile contextual helper */}
        <AITutorSheet />

        </div>
        </SidebarProvider>
        </AITutorProvider>
        );
        }