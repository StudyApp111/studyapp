import React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Home, BookOpen, Trophy, History, LogOut, Settings, Plus, Flame, Award, CheckCircle, Clock, FileCheck, TrendingUp, Map, Sparkles } from "lucide-react";
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
import FeedbackButton from "@/components/feedback/FeedbackButton";
import { trackUserSession, trackSessionDuration } from "@/components/utils/userTracking";
import { logError } from "@/components/utils/errorLogger";
import CreateLessonModal from "@/components/modals/CreateLessonModal";
import AITutorModal from "@/components/modals/AITutorModal.jsx";

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
          title: "Course Mapper",
          url: createPageUrl("CourseMapper"),
          icon: Map,
          isComingSoon: true,
        },
        {
          title: "Leaderboard",
          url: createPageUrl("Leaderboard"),
          icon: Trophy,
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
  const [createLessonModalOpen, setCreateLessonModalOpen] = React.useState(false);
  const [aiTutorModalOpen, setAiTutorModalOpen] = React.useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(false);

  React.useEffect(() => {
    const checkUser = async () => {
      try {
        const currentUser = await base44.auth.me();
        setUser(currentUser);
        
        // Track user session
        await trackUserSession();
        
        // Start tracking session duration
        const cleanup = trackSessionDuration();
        
        // Redirect to onboarding if not completed and not already on onboarding page
        if (!currentUser.onboarding_completed && location.pathname !== createPageUrl("Onboarding")) {
          navigate(createPageUrl("Onboarding"));
        }
        
        return cleanup;
      } catch (error) {
        console.error("Error fetching user:", error);
      }
    };
    
    checkUser();
  }, [location.pathname, navigate]);

  // Global UI error tracking
  React.useEffect(() => {
    const onWindowError = (event) => {
      try {
        logError('ui_error', event?.error || event?.message || 'Unknown window error', {
          source: 'window.error',
        });
      } catch {}
    };
    const onUnhandledRejection = (event) => {
      try {
        logError('ui_error', event?.reason || 'Unhandled promise rejection', {
          source: 'unhandledrejection',
        });
      } catch {}
    };

    window.addEventListener('error', onWindowError);
    window.addEventListener('unhandledrejection', onUnhandledRejection);
    return () => {
      window.removeEventListener('error', onWindowError);
      window.removeEventListener('unhandledrejection', onUnhandledRejection);
    };
  }, []);





  // Don't render layout navigation if onboarding not completed
  const isOnboardingPage = location.pathname === createPageUrl("Onboarding");
  const showNavigation = user?.onboarding_completed || isOnboardingPage;
  
  // Hide mobile bottom nav on pages with their own custom navigation
  const pagesWithCustomNav = ["DiagnosticQuiz", "Worksheet"];
  const showMobileBottomNav = !pagesWithCustomNav.includes(currentPageName);



  return (
    <SidebarProvider>
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
        
        {/* Desktop Sidebar - Hidden during onboarding */}
        {showNavigation && !isOnboardingPage && (
          <>
          <Sidebar className={`border-r border-purple-200/60 bg-white/90 backdrop-blur-xl transition-all duration-300 ${sidebarCollapsed ? 'hidden' : ''}`}>
            <SidebarHeader className="border-b border-purple-200/60 p-6">
              <Link to={createPageUrl("Home")} className="flex items-center gap-3 hover:opacity-80 transition-opacity cursor-pointer">
                <img 
                  src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68ffadbdd9532e7e7691129d/02b2ff5d6_StudyAppAI500x500.png"
                  alt="StudyApp.AI Logo"
                  className="w-10 h-10 rounded-xl shadow-lg"
                />
                <div>
                  <h2 className="font-bold text-slate-900 text-lg">StudyApp.AI</h2>
                  <p className="text-xs text-slate-500">AI-Powered Learning</p>
                </div>
              </Link>
            </SidebarHeader>
            
            <SidebarContent className="p-3">
              {/* Start Now Button - Above Navigation */}
              <div className="mb-4 px-2">
                <Button
                  onClick={() => setCreateLessonModalOpen(true)}
                  className="w-full bg-gradient-to-r from-yellow-400 to-amber-500 hover:from-yellow-500 hover:to-amber-600 text-slate-900 font-semibold shadow-lg shadow-yellow-500/30"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Upload Now
                </Button>
              </div>

              <SidebarGroup>
                <SidebarGroupLabel className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-3 py-3">
                  Navigation
                </SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {navigationItems.map((item) => (
                      <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton 
                          asChild 
                          className={`hover:bg-yellow-50 hover:text-yellow-700 transition-all duration-200 rounded-xl mb-1 ${
                            location.pathname === item.url ? 'bg-gradient-to-r from-yellow-400 to-amber-500 text-slate-900 shadow-lg shadow-yellow-500/30 font-semibold' : ''
                          }`}
                        >
                          <Link to={item.url} className="flex items-center justify-between gap-3 px-4 py-3 w-full">
                            <div className="flex items-center gap-3 min-w-0">
                              <item.icon className="w-5 h-5 flex-shrink-0" />
                              <span className="font-medium whitespace-nowrap">{item.title}</span>
                            </div>
                            {item.isNew && (
                              <span className="bg-emerald-500 text-white text-[9px] font-bold px-2 py-0.5 rounded-full shadow-sm flex-shrink-0">
                                NEW
                              </span>
                            )}
                            {item.isComingSoon && (
                              <span className="bg-purple-500 text-white text-[9px] font-bold px-2 py-0.5 rounded-full shadow-sm flex-shrink-0">
                                SOON
                              </span>
                            )}
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>

              {user && (
                <>
                  <SidebarGroup className="mt-4">
                    <SidebarGroupLabel className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-3 py-3">
                      Your Progress
                    </SidebarGroupLabel>
                    <SidebarGroupContent>
                      <div className="px-4 py-3 space-y-3">
                        <div className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <CheckCircle className="w-4 h-4 text-purple-600" />
                            <span className="text-slate-600">Questions</span>
                          </div>
                          <span className="font-bold text-purple-600">{user.questions_completed || 0}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4 text-purple-700" />
                            <span className="text-slate-600">Time Spent</span>
                          </div>
                          <span className="font-bold text-purple-700">{formatTime(user.time_spent_seconds || 0)}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <TrendingUp className="w-4 h-4 text-purple-800" />
                            <span className="text-slate-600">Avg Score</span>
                          </div>
                          <span className="font-bold text-purple-800">{user.average_score || 0}%</span>
                        </div>
                      </div>
                    </SidebarGroupContent>
                  </SidebarGroup>


                </>
              )}
            </SidebarContent>

            <SidebarFooter className="border-t border-purple-200/60 p-4">
              {user && (
                <div className="space-y-3">
                  <button
                    onClick={() => navigate(createPageUrl("Settings"))}
                    className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-yellow-50 transition-colors"
                  >
                    <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-purple-800 rounded-full flex items-center justify-center">
                      <span className="text-white font-semibold text-sm">
                        {user.full_name?.[0]?.toUpperCase() || 'U'}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                      <p className="font-medium text-slate-900 text-sm truncate">{user.full_name || 'User'}</p>
                      <p className="text-xs text-slate-500 truncate">{user.email}</p>
                    </div>
                    <Settings className="w-4 h-4 text-slate-400" />
                  </button>
                </div>
              )}
            </SidebarFooter>
            </Sidebar>

            {/* Desktop Sidebar Toggle Button */}
            <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="hidden md:flex fixed left-0 top-1/2 -translate-y-1/2 z-50 bg-white border border-purple-200 rounded-r-lg shadow-lg hover:bg-purple-50 transition-all p-2"
            style={{ left: sidebarCollapsed ? '0' : '256px' }}
            >
            {sidebarCollapsed ? (
              <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            ) : (
              <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            )}
            </button>
            </>
            )}

        <main className="flex-1 flex flex-col">
          {/* Mobile Header - Hidden during onboarding */}
          {showNavigation && !isOnboardingPage && (
            <header className="bg-white/90 backdrop-blur-xl border-b border-purple-200/60 px-6 py-4 md:hidden">
              <div className="flex items-center justify-between">
                <Link to={createPageUrl("Home")} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
                  <img 
                    src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68ffadbdd9532e7e7691129d/02b2ff5d6_StudyAppAI500x500.png"
                    alt="StudyApp.AI Logo"
                    className="w-8 h-8 rounded-lg"
                  />
                  <h1 className="text-xl font-bold text-slate-900">StudyApp.AI</h1>
                </Link>
                {user && (
                  <button
                    onClick={() => navigate(createPageUrl("Settings"))}
                    className="w-8 h-8 bg-gradient-to-br from-purple-600 to-purple-800 rounded-full flex items-center justify-center"
                  >
                    <span className="text-white font-semibold text-xs">
                      {user.full_name?.[0]?.toUpperCase() || 'U'}
                    </span>
                  </button>
                )}
              </div>
            </header>
          )}

          <div className="flex-1 overflow-auto pb-24 md:pb-0">
            {children}
          </div>

          {/* Mobile Bottom Navigation - Hidden during onboarding and on pages with custom nav */}
          {showNavigation && !isOnboardingPage && showMobileBottomNav && (
            <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-xl border-t border-purple-200/60 px-2 py-3 safe-area-inset-bottom z-50">
              <div className="flex items-center justify-between max-w-lg mx-auto relative">
                <Link
                  to={createPageUrl("Home")}
                  className={`flex flex-col items-center justify-center gap-1 p-2 rounded-lg transition-all min-w-0 ${
                    location.pathname === createPageUrl("Home")
                      ? 'text-yellow-600 bg-yellow-50'
                      : 'text-slate-600'
                  }`}
                >
                  <Home className="w-6 h-6" />
                  <span className="text-[10px] font-medium">Home</span>
                </Link>

                <Link
                  to={createPageUrl("SmartGrader")}
                  className={`flex flex-col items-center justify-center gap-1 p-2 rounded-lg transition-all relative min-w-0 ${
                    location.pathname === createPageUrl("SmartGrader")
                      ? 'text-yellow-600 bg-yellow-50'
                      : 'text-slate-600'
                  }`}
                >
                  <div className="relative">
                    <FileCheck className="w-6 h-6" />
                    <span className="absolute -top-1 -right-1 bg-emerald-500 text-white text-[8px] font-bold px-1 py-0.5 rounded-full">
                      NEW
                    </span>
                  </div>
                  <span className="text-[10px] font-medium whitespace-nowrap">Smart Grader</span>
                </Link>

                {/* Space for center CTA */}
                <div className="w-14" />

                <Link
                  to={createPageUrl("Leaderboard")}
                  className={`flex flex-col items-center justify-center gap-1 p-2 rounded-lg transition-all min-w-0 ${
                    location.pathname === createPageUrl("Leaderboard")
                      ? 'text-yellow-600 bg-yellow-50'
                      : 'text-slate-600'
                  }`}
                >
                  <Trophy className="w-6 h-6" />
                  <span className="text-[10px] font-medium">Ranks</span>
                </Link>

                <button
                  onClick={() => navigate(createPageUrl("Settings"))}
                  className={`flex flex-col items-center justify-center gap-1 p-2 rounded-lg transition-all min-w-0 ${
                    location.pathname === createPageUrl("Settings")
                      ? 'text-yellow-600 bg-yellow-50'
                      : 'text-slate-600'
                  }`}
                >
                  <Settings className="w-6 h-6" />
                  <span className="text-[10px] font-medium">Settings</span>
                </button>

                {/* AI Tutor CTA Button */}
                <button
                  onClick={() => setAiTutorModalOpen(true)}
                  className="absolute left-1/2 -translate-x-1/2 -top-5 group"
                >
                  <div className="relative">
                    {/* Subtle glow */}
                    <div className="absolute inset-0 rounded-full bg-gradient-to-br from-purple-500 to-purple-700 blur-lg opacity-40 group-hover:opacity-60 transition-opacity" />

                    {/* Main button - sleek and minimal */}
                    <div className="relative w-14 h-14 bg-gradient-to-br from-purple-600 to-purple-800 rounded-full shadow-2xl ring-4 ring-white/70 flex items-center justify-center transform group-hover:scale-110 transition-transform duration-200 border border-white">
                      <Sparkles className="w-6 h-6 text-white drop-shadow" strokeWidth={2.5} />
                    </div>
                  </div>
                </button>
              </div>
            </nav>
          )}
        </main>

        {/* Global Feedback Button - Always visible on authenticated pages */}
        {showNavigation && !isOnboardingPage && <FeedbackButton />}

        {/* Create Lesson Modal */}
        <CreateLessonModal 
          open={createLessonModalOpen} 
          onOpenChange={setCreateLessonModalOpen} 
        />
        
        {/* AI Tutor Modal */}
        <AITutorModal 
          open={aiTutorModalOpen} 
          onOpenChange={setAiTutorModalOpen} 
        />
        </div>
        </SidebarProvider>
        );
        }