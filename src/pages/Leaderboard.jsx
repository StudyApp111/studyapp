import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, Medal, Award, Crown, TrendingUp, Zap } from "lucide-react";
import { motion } from "framer-motion";
import { Skeleton } from "@/components/ui/skeleton";

export default function Leaderboard() {
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const user = await base44.auth.me();
        setCurrentUser(user);
      } catch (error) {
        console.error("Error fetching user:", error);
      }
    };
    
    fetchUser();
  }, []);

  const { data: allUsers = [], isLoading } = useQuery({
    queryKey: ['leaderboard'],
    queryFn: async () => {
      const users = await base44.entities.User.list('-total_points', 100);
      
      // Give default points to users with 0 points for demo purposes
      const updatePromises = users.map(async user => {
        if (!user.total_points || user.total_points === 0) {
          const demoPoints = Math.floor(Math.random() * 10) * 5 + 5; // Random 5-50 points in multiples of 5
          const newLevel = Math.floor(demoPoints / 100) + 1;
          await base44.entities.User.update(user.id, {
            total_points: demoPoints,
            level: newLevel
          });
          return { ...user, total_points: demoPoints, level: newLevel };
        }
        return user;
      });

      const updatedUsers = await Promise.all(updatePromises);
      
      // Sort by points after updates
      const sortedUsers = updatedUsers.sort((a, b) => (b.total_points || 0) - (a.total_points || 0));
      
      const profilePromises = sortedUsers.map(user => 
        user.learning_profile_id 
          ? base44.entities.LearningProfile.filter({ id: user.learning_profile_id })
          : Promise.resolve([])
      );
      
      const profiles = await Promise.all(profilePromises);
      
      return sortedUsers.map((user, idx) => ({
        ...user,
        country: profiles[idx][0]?.country || "Unknown"
      }));
    },
    initialData: [],
  });

  const getRankIcon = (rank) => {
    if (rank === 1) return <Crown className="w-6 h-6 text-yellow-500" />;
    if (rank === 2) return <Medal className="w-6 h-6 text-slate-400" />;
    if (rank === 3) return <Medal className="w-6 h-6 text-amber-600" />;
    return <span className="text-lg font-bold text-slate-600">#{rank}</span>;
  };

  const getRankBg = (rank) => {
    if (rank === 1) return "bg-gradient-to-r from-yellow-100 to-amber-100 border-yellow-300";
    if (rank === 2) return "bg-gradient-to-r from-slate-100 to-gray-100 border-slate-300";
    if (rank === 3) return "bg-gradient-to-r from-amber-100 to-orange-100 border-amber-300";
    return "bg-white border-slate-200";
  };

  const currentUserRank = currentUser 
    ? allUsers.findIndex(u => u.id === currentUser.id) + 1 
    : 0;

  const getCountryFlag = (country) => {
    // Simple country to flag emoji mapping (can be expanded)
    const flagMap = {
      "Canada": "🇨🇦",
      "United States": "🇺🇸",
      "USA": "🇺🇸",
      "United Kingdom": "🇬🇧",
      "UK": "🇬🇧",
      "Australia": "🇦🇺",
      "Germany": "🇩🇪",
      "France": "🇫🇷",
      "Spain": "🇪🇸",
      "Italy": "🇮🇹",
      "Japan": "🇯🇵",
      "China": "🇨🇳",
      "India": "🇮🇳",
      "Brazil": "🇧🇷",
      "Mexico": "🇲🇽",
      "Unknown": "🌍"
    };
    return flagMap[country] || "🌍";
  };

  if (isLoading || !currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-10 max-w-6xl mx-auto">
      <div className="mb-6 md:mb-8 text-center md:text-left">
        <h1 className="text-2xl md:text-4xl font-bold text-slate-900 mb-2 flex items-center justify-center md:justify-start gap-2 md:gap-3">
          <Trophy className="w-8 h-8 md:w-10 md:h-10 text-yellow-500" />
          Global Leaderboard
        </h1>
        <p className="text-slate-600 text-sm md:text-lg">Compete with learners worldwide</p>
      </div>

      {/* Current User Stats Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6 md:mb-8"
      >
        <Card className="border-2 border-purple-300 shadow-xl bg-gradient-to-r from-purple-50 to-indigo-50">
          <CardContent className="p-4 md:p-6">
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-3 md:gap-4">
                <div className="w-12 h-12 md:w-16 md:h-16 bg-gradient-to-br from-purple-600 to-purple-800 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-white font-bold text-base md:text-xl">
                    {currentUser.full_name?.[0]?.toUpperCase() || 'U'}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-base md:text-xl font-bold text-slate-900 truncate">
                    {currentUser.full_name || 'You'}
                  </h3>
                  <p className="text-xs md:text-sm text-slate-600">Your Stats</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 md:gap-6">
                <div className="text-center">
                  <Trophy className="w-4 h-4 md:w-5 md:h-5 text-yellow-600 mx-auto mb-1" />
                  <p className="text-xl md:text-2xl font-bold text-slate-900">#{currentUserRank || '-'}</p>
                  <p className="text-xs text-slate-600">Rank</p>
                </div>
                <div className="text-center">
                  <TrendingUp className="w-4 h-4 md:w-5 md:h-5 text-purple-600 mx-auto mb-1" />
                  <p className="text-xl md:text-2xl font-bold text-purple-700">{currentUser.level || 1}</p>
                  <p className="text-xs text-slate-600">Level</p>
                </div>
                <div className="text-center">
                  <Zap className="w-4 h-4 md:w-5 md:h-5 text-amber-600 mx-auto mb-1" />
                  <p className="text-xl md:text-2xl font-bold text-amber-600">{currentUser.total_points || 0}</p>
                  <p className="text-xs text-slate-600">Points</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Achievement Milestones */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="mb-6 md:mb-8"
      >
        <Card className="shadow-lg border-0 bg-gradient-to-r from-amber-50 to-yellow-50">
          <CardContent className="p-4 md:p-6">
            <h3 className="text-base md:text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
              <Award className="w-5 h-5 text-amber-600" />
              Achievement Milestones
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
              <div className="bg-white p-3 rounded-lg border border-amber-200 text-center">
                <p className="text-2xl font-bold text-amber-600">🏆</p>
                <p className="text-xs md:text-sm font-semibold text-slate-700 mt-1">Top 10</p>
                <p className="text-xs text-slate-500">Elite Status</p>
              </div>
              <div className="bg-white p-3 rounded-lg border border-purple-200 text-center">
                <p className="text-2xl font-bold text-purple-600">⭐</p>
                <p className="text-xs md:text-sm font-semibold text-slate-700 mt-1">100+ Points</p>
                <p className="text-xs text-slate-500">Level Up!</p>
              </div>
              <div className="bg-white p-3 rounded-lg border border-emerald-200 text-center">
                <p className="text-2xl font-bold text-emerald-600">🔥</p>
                <p className="text-xs md:text-sm font-semibold text-slate-700 mt-1">Daily Streak</p>
                <p className="text-xs text-slate-500">Keep Going</p>
              </div>
              <div className="bg-white p-3 rounded-lg border border-blue-200 text-center">
                <p className="text-2xl font-bold text-blue-600">🎯</p>
                <p className="text-xs md:text-sm font-semibold text-slate-700 mt-1">10 Worksheets</p>
                <p className="text-xs text-slate-500">Dedicated</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Leaderboard List */}
      <Card className="shadow-xl border-0">
        <CardHeader className="p-4 md:p-6">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg md:text-2xl">Top 100 Learners</CardTitle>
            <Badge className="bg-purple-100 text-purple-700 border border-purple-300 px-3 py-1">
              <Zap className="w-3 h-3 mr-1" />
              Live Rankings
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-4 md:p-6">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map(i => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          ) : allUsers.length === 0 ? (
            <div className="text-center py-8 md:py-12">
              <Trophy className="w-12 h-12 md:w-16 md:h-16 mx-auto text-slate-300 mb-4" />
              <p className="text-sm md:text-base text-slate-500">No users on the leaderboard yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {allUsers.map((user, idx) => {
                const rank = idx + 1;
                const isCurrentUser = user.id === currentUser.id;
                
                return (
                  <motion.div
                    key={user.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className={`p-3 md:p-4 rounded-xl border-2 transition-all hover:shadow-lg hover:scale-[1.02] ${
                      isCurrentUser 
                        ? 'border-purple-400 bg-purple-50 shadow-md' 
                        : getRankBg(rank)
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 md:gap-4 flex-1 min-w-0">
                        <div className="w-8 md:w-12 flex items-center justify-center flex-shrink-0">
                          {getRankIcon(rank)}
                        </div>
                        
                        <div className="w-8 h-8 md:w-10 md:h-10 bg-gradient-to-br from-slate-600 to-slate-800 rounded-full flex items-center justify-center flex-shrink-0">
                          <span className="text-white font-semibold text-xs md:text-sm">
                            {user.full_name?.[0]?.toUpperCase() || '?'}
                          </span>
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-bold text-sm md:text-base text-slate-900 truncate">
                              {user.full_name || `User ${rank}`}
                            </h4>
                            {isCurrentUser && (
                              <Badge className="bg-purple-600 text-white text-xs flex-shrink-0">You</Badge>
                            )}
                            {rank <= 10 && (
                              <Badge className="bg-amber-100 text-amber-700 border border-amber-300 text-xs flex-shrink-0">
                                Elite
                              </Badge>
                            )}
                            {user.current_streak >= 7 && (
                              <span className="text-xs flex-shrink-0">🔥</span>
                            )}
                          </div>
                          <p className="text-xs md:text-sm text-slate-600 flex items-center gap-1">
                            <span>{getCountryFlag(user.country)}</span>
                            <span className="truncate">{user.country}</span>
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 md:gap-6 flex-shrink-0">
                        <div className="text-center hidden md:block">
                          <p className="text-xs md:text-sm text-slate-600">Level</p>
                          <p className="text-base md:text-lg font-bold text-purple-700">{user.level || 1}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-xs md:text-sm text-slate-600">Points</p>
                          <p className="text-base md:text-lg font-bold text-amber-600">{user.total_points || 0}</p>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}