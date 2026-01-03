import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Users, MessageCircle, HelpCircle, Target, Plus, Search, 
  ArrowRight, Sparkles, Globe, Lock, TrendingUp, Clock,
  CheckCircle, ChevronRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

import StudyRoomsTab from "@/components/collaborate/StudyRoomsTab";
import ForumTab from "@/components/collaborate/ForumTab";
import StudyGroupsTab from "@/components/collaborate/StudyGroupsTab";

export default function Collaborate() {
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState("rooms");

  useEffect(() => {
    const loadUser = async () => {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
    };
    loadUser();
  }, []);

  const { data: stats } = useQuery({
    queryKey: ['collaborate-stats'],
    queryFn: async () => {
      const [rooms, questions, groups] = await Promise.all([
        base44.entities.StudyRoom.filter({ is_public: true }),
        base44.entities.ForumQuestion.list('-created_date', 100),
        base44.entities.StudyGroup.filter({ is_public: true })
      ]);
      return {
        activeRooms: rooms.filter(r => r.is_active).length,
        totalQuestions: questions.length,
        resolvedQuestions: questions.filter(q => q.is_resolved).length,
        activeGroups: groups.length
      };
    },
    initialData: { activeRooms: 0, totalQuestions: 0, resolvedQuestions: 0, activeGroups: 0 }
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-amber-50/30">
      {/* Hero Section */}
      <div className="relative overflow-hidden bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 text-white">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml,...')] opacity-10" />
        <div className="relative max-w-2xl mx-auto px-3 py-6 md:py-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center"
          >
            <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm rounded-full px-4 py-1.5 mb-4">
              <Sparkles className="w-4 h-4" />
              <span className="text-sm font-medium">Learn Together</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold mb-2">
              Collaborate & Grow
            </h1>
            <p className="text-purple-100 text-xs md:text-sm">
              Study rooms, Q&A, and goal tracking
            </p>
          </motion.div>

          {/* Quick Stats */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="grid grid-cols-3 gap-2 mt-4"
          >
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-2 text-center">
              <div className="text-lg font-bold">{stats.activeRooms}</div>
              <div className="text-[10px] text-purple-200">Rooms</div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-2 text-center">
              <div className="text-lg font-bold">{stats.totalQuestions}</div>
              <div className="text-[10px] text-purple-200">Q&A</div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-2 text-center">
              <div className="text-lg font-bold">{stats.activeGroups}</div>
              <div className="text-[10px] text-purple-200">Groups</div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-2xl mx-auto px-3 py-4">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid grid-cols-3 w-full max-w-md mx-auto bg-white shadow-sm border">
            <TabsTrigger value="rooms" className="gap-2 data-[state=active]:bg-purple-50 data-[state=active]:text-purple-700">
              <Users className="w-4 h-4" />
              <span className="hidden sm:inline">Study Rooms</span>
              <span className="sm:hidden">Rooms</span>
            </TabsTrigger>
            <TabsTrigger value="forum" className="gap-2 data-[state=active]:bg-purple-50 data-[state=active]:text-purple-700">
              <HelpCircle className="w-4 h-4" />
              <span className="hidden sm:inline">Q&A Forum</span>
              <span className="sm:hidden">Q&A</span>
            </TabsTrigger>
            <TabsTrigger value="groups" className="gap-2 data-[state=active]:bg-purple-50 data-[state=active]:text-purple-700">
              <Target className="w-4 h-4" />
              <span className="hidden sm:inline">Study Groups</span>
              <span className="sm:hidden">Groups</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="rooms">
            <StudyRoomsTab user={user} />
          </TabsContent>

          <TabsContent value="forum">
            <ForumTab user={user} />
          </TabsContent>

          <TabsContent value="groups">
            <StudyGroupsTab user={user} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}