import React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Home, BookOpen, GraduationCap, History, LogOut, Settings, Plus, Trophy, Flame, Award, Clock, CheckCircle2 } from "lucide-react";
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

const navigationItems = [
  {
    title: "Home",
    url: createPageUrl("Home"),
    icon: Home,
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

// Helper function to format time
const formatTime = (seconds) => {
  if (!seconds || seconds < 60) return `${seconds || 0}s`;
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  }
  return `${minutes}m`;
};

export default function Layout({ children, currentPageName }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [user, setUser] = React.useState(null);

  React.useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-gradient-to-br from-purple-50 via-yellow-50/30 to-purple-100/40">
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
        
        {/* Desktop Sidebar */}
        <Sidebar className="border-r border-purple-200/60 bg-white/90 backdrop-blur-xl">
          <SidebarHeader className="border-b border-purple-200/60 p-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-purple-800 rounded-xl flex items-center justify-center shadow-lg shadow-purple-500/30">
                <GraduationCap className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="font-bold text-slate-900 text-lg">StudyApp.AI</h2>
                <p className="text-xs text-slate-500">AI-Powered Learning</p>
              </div>
            </div>
          </SidebarHeader>
          
          <SidebarContent className="p-3">
            {/* Create Lesson Button - Above Navigation */}
            <div className="mb-4 px-2">
              <Button
                onClick={() => navigate(createPageUrl("CreateLesson"))}
                className="w-full bg-gradient-to-r from-purple-600 to-purple-800 hover:from-purple-700 hover:to-purple-900 shadow-lg shadow-purple-500/20"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Lesson
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
                        className={`hover:bg-purple-50 hover:text-purple-700 transition-all duration-200 rounded-xl mb-1 ${
                          location.pathname === item.url ? 'bg-gradient-to-r from-purple-600 to-purple-800 text-white shadow-lg shadow-purple-500/30' : ''
                        }`}
                      >
                        <Link to={item.url} className="flex items-center gap-3 px-4 py-3">
                          <item.icon className="w-5 h-5" />
                          <span className="font-medium">{item.title}</span>
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
                          <CheckCircle2 className="w-4 h-4 text-purple-600" />
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
                          <Award className="w-4 h-4 text-purple-800" />
                          <span className="text-slate-600">Avg Score</span>
                        </div>
                        <span className="font-bold text-purple-800">{user.average_score || 0}%</span>
                      </div>
                    </div>
                  </SidebarGroupContent>
                </SidebarGroup>

                {/* Gamification Stats */}
                <SidebarGroup className="mt-4">
                  <SidebarGroupLabel className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-3 py-3">
                    Achievements
                  </SidebarGroupLabel>
                  <SidebarGroupContent>
                    <div className="px-4 py-3 space-y-3">
                      <div className="flex items-center justify-between p-3 bg-gradient-to-r from-yellow-50 to-amber-50 rounded-lg border border-yellow-200">
                        <div className="flex items-center gap-2">
                          <Trophy className="w-5 h-5 text-yellow-600" />
                          <div>
                            <p className="text-xs text-slate-600">Level</p>
                            <p className="font-bold text-yellow-700">{user.level || 1}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-slate-600">Points</p>
                          <p className="font-bold text-yellow-700">{user.total_points || 0}</p>
                        </div>
                      </div>
                      
                      {(user.current_streak || 0) > 0 && (
                        <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-orange-50 to-red-50 rounded-lg border border-orange-200">
                          <Flame className="w-6 h-6 text-orange-500" />
                          <div>
                            <p className="text-xs text-slate-600">Study Streak</p>
                            <p className="font-bold text-orange-600">{user.current_streak} {user.current_streak === 1 ? 'day' : 'days'}</p>
                          </div>
                        </div>
                      )}

                      {user.badges && user.badges.length > 0 && (
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-slate-600">Badges</span>
                          <span className="font-bold text-purple-600">{user.badges.length}</span>
                        </div>
                      )}
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
                  className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-purple-50 transition-colors"
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

        <main className="flex-1 flex flex-col">
          <header className="bg-white/90 backdrop-blur-xl border-b border-purple-200/60 px-6 py-4 md:hidden">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gradient-to-br from-purple-600 to-purple-800 rounded-lg flex items-center justify-center">
                  <GraduationCap className="w-5 h-5 text-white" />
                </div>
                <h1 className="text-xl font-bold text-slate-900">StudyApp.AI</h1>
              </div>
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

          <div className="flex-1 overflow-auto pb-20 md:pb-0">
            {children}
          </div>

          {/* Mobile Bottom Navigation */}
          <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-xl border-t border-purple-200/60 px-6 py-3 safe-area-inset-bottom z-50">
            <div className="flex items-center justify-between max-w-lg mx-auto relative">
              <Link
                to={createPageUrl("Home")}
                className={`flex items-center justify-center p-3 rounded-lg transition-all ${
                  location.pathname === createPageUrl("Home")
                    ? 'text-purple-700 bg-purple-50'
                    : 'text-slate-600'
                }`}
              >
                <Home className="w-6 h-6" />
              </Link>

              <Link
                to={createPageUrl("Leaderboard")}
                className={`flex items-center justify-center p-3 rounded-lg transition-all ${
                  location.pathname === createPageUrl("Leaderboard")
                    ? 'text-purple-700 bg-purple-50'
                    : 'text-slate-600'
                }`}
              >
                <Trophy className="w-6 h-6" />
              </Link>

              {/* Elevated CTA Button - Centered with clear space below */}
              <button
                onClick={() => navigate(createPageUrl("CreateLesson"))}
                className="absolute left-1/2 -translate-x-1/2 -top-8 w-14 h-14 bg-gradient-to-r from-purple-600 to-purple-800 hover:from-purple-700 hover:to-purple-900 rounded-full shadow-xl shadow-purple-500/30 flex items-center justify-center transition-transform hover:scale-110"
              >
                <Plus className="w-6 h-6 text-white" />
              </button>

              <Link
                to={createPageUrl("LessonHistory")}
                className={`flex items-center justify-center p-3 rounded-lg transition-all ${
                  location.pathname === createPageUrl("LessonHistory")
                    ? 'text-purple-700 bg-purple-50'
                    : 'text-slate-600'
                }`}
              >
                <History className="w-6 h-6" />
              </Link>

              <button
                onClick={() => navigate(createPageUrl("Settings"))}
                className={`flex items-center justify-center p-3 rounded-lg transition-all ${
                  location.pathname === createPageUrl("Settings")
                    ? 'text-purple-700 bg-purple-50'
                    : 'text-slate-600'
                }`}
              >
                <Settings className="w-6 h-6" />
              </button>
            </div>
          </nav>
        </main>
      </div>
    </SidebarProvider>
  );
}