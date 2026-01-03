import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { motion, AnimatePresence } from "framer-motion";
import { Users, Sparkles, BookOpen, Send, Clock, Flame, Circle, ChevronRight, Coffee, Zap, Brain, Battery } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const moodIcons = {
  focused: { icon: Brain, color: "text-purple-600", bg: "bg-purple-100", label: "Focused" },
  struggling: { icon: Coffee, color: "text-amber-600", bg: "bg-amber-100", label: "Need help" },
  excited: { icon: Zap, color: "text-yellow-600", bg: "bg-yellow-100", label: "On fire!" },
  tired: { icon: Battery, color: "text-slate-500", bg: "bg-slate-100", label: "Low energy" }
};

const statusColors = {
  studying: "bg-green-500",
  on_break: "bg-amber-500",
  idle: "bg-slate-400"
};

export default function ActiveUsersPanel({ currentUser, currentCourse, lessonId, onInviteSent }) {
  const [activeUsers, setActiveUsers] = useState([]);
  const [inviteModal, setInviteModal] = useState(null);
  const [inviteMessage, setInviteMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [mySession, setMySession] = useState(null);

  useEffect(() => {
    loadActiveUsers();
    updateMySession();
    
    const interval = setInterval(() => {
      loadActiveUsers();
      updateMySession();
    }, 30000); // Refresh every 30s
    
    return () => clearInterval(interval);
  }, [currentCourse]);

  const loadActiveUsers = async () => {
    try {
      // Get active sessions from last 5 minutes
      const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      const sessions = await base44.entities.ActiveSession.filter({
        open_to_collab: true
      });
      
      // Filter to recent sessions only
      const recent = sessions.filter(s => 
        s.user_email !== currentUser?.email && 
        s.last_heartbeat && 
        new Date(s.last_heartbeat) > new Date(fiveMinAgo)
      );
      
      setActiveUsers(recent);
    } catch (error) {
      console.error("Error loading active users:", error);
    }
  };

  const updateMySession = async () => {
    if (!currentUser?.email) return;
    
    try {
      const existing = await base44.entities.ActiveSession.filter({
        user_email: currentUser.email
      });
      
      const sessionData = {
        user_email: currentUser.email,
        user_name: currentUser.full_name || currentUser.email.split('@')[0],
        course_name: currentCourse || "Browsing",
        lesson_id: lessonId || "",
        status: "studying",
        open_to_collab: true,
        last_heartbeat: new Date().toISOString(),
        mood: mySession?.mood || "focused"
      };
      
      if (existing.length > 0) {
        await base44.entities.ActiveSession.update(existing[0].id, sessionData);
        setMySession({ ...existing[0], ...sessionData });
      } else {
        const newSession = await base44.entities.ActiveSession.create(sessionData);
        setMySession(newSession);
      }
    } catch (error) {
      console.error("Error updating session:", error);
    }
  };

  const updateMood = async (mood) => {
    if (!mySession?.id) return;
    
    try {
      await base44.entities.ActiveSession.update(mySession.id, { mood });
      setMySession({ ...mySession, mood });
    } catch (error) {
      console.error("Error updating mood:", error);
    }
  };

  const sendInvite = async () => {
    if (!inviteModal || sending) return;
    
    setSending(true);
    try {
      await base44.entities.StudyInvite.create({
        from_email: currentUser.email,
        from_name: currentUser.full_name || currentUser.email.split('@')[0],
        to_email: inviteModal.user_email,
        course_name: currentCourse,
        lesson_id: lessonId,
        message: inviteMessage.trim() || `Hey! Want to study ${currentCourse} together?`,
        status: "pending",
        read: false
      });
      
      setInviteModal(null);
      setInviteMessage("");
      onInviteSent?.();
    } catch (error) {
      console.error("Error sending invite:", error);
    } finally {
      setSending(false);
    }
  };

  // Group users by course
  const sameCourse = activeUsers.filter(u => 
    u.course_name?.toLowerCase().replace(/[^a-z0-9]/g, '') === 
    currentCourse?.toLowerCase().replace(/[^a-z0-9]/g, '')
  );
  const otherUsers = activeUsers.filter(u => 
    u.course_name?.toLowerCase().replace(/[^a-z0-9]/g, '') !== 
    currentCourse?.toLowerCase().replace(/[^a-z0-9]/g, '')
  );

  return (
    <div className="space-y-4">
      {/* My Status Card */}
      <Card className="border-0 shadow-lg bg-gradient-to-br from-purple-50 to-indigo-50">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold text-purple-900">Your Status</span>
            <div className="flex items-center gap-1.5">
              <Circle className={`w-2 h-2 ${statusColors.studying} animate-pulse`} />
              <span className="text-xs text-slate-600">Online</span>
            </div>
          </div>
          
          {/* Mood Selector */}
          <div className="flex gap-2">
            {Object.entries(moodIcons).map(([mood, config]) => {
              const Icon = config.icon;
              const isActive = mySession?.mood === mood;
              return (
                <button
                  key={mood}
                  onClick={() => updateMood(mood)}
                  className={`flex-1 flex flex-col items-center gap-1 p-2 rounded-xl transition-all ${
                    isActive 
                      ? `${config.bg} ring-2 ring-offset-2 ring-purple-400` 
                      : 'bg-white hover:bg-slate-50'
                  }`}
                >
                  <Icon className={`w-5 h-5 ${isActive ? config.color : 'text-slate-400'}`} />
                  <span className={`text-[10px] ${isActive ? 'font-medium text-slate-900' : 'text-slate-500'}`}>
                    {config.label}
                  </span>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Active Users */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Users className="w-4 h-4 text-purple-600" />
          <h3 className="font-semibold text-slate-900 text-sm">Study Buddies Online</h3>
          <span className="text-xs text-slate-500 ml-auto">{activeUsers.length} online</span>
        </div>

        {activeUsers.length === 0 ? (
          <Card className="border-dashed border-2 border-slate-200">
            <CardContent className="p-6 text-center">
              <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <Users className="w-6 h-6 text-slate-400" />
              </div>
              <p className="text-slate-600 text-sm font-medium">No one online right now</p>
              <p className="text-slate-400 text-xs mt-1">Check back later or invite friends!</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {/* Same Course Users - Highlighted */}
            {sameCourse.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-green-700 flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  Studying same course!
                </p>
                {sameCourse.map((user) => (
                  <UserCard 
                    key={user.id} 
                    user={user} 
                    highlighted 
                    onInvite={() => setInviteModal(user)}
                  />
                ))}
              </div>
            )}

            {/* Other Users */}
            {otherUsers.length > 0 && (
              <div className="space-y-2">
                {sameCourse.length > 0 && (
                  <p className="text-xs text-slate-500 mt-3">Other students online</p>
                )}
                <ScrollArea className="max-h-[200px]">
                  <div className="space-y-2">
                    {otherUsers.map((user) => (
                      <UserCard 
                        key={user.id} 
                        user={user} 
                        onInvite={() => setInviteModal(user)}
                      />
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Invite Modal */}
      <Dialog open={!!inviteModal} onOpenChange={() => setInviteModal(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="w-5 h-5 text-purple-600" />
              Invite to Study
            </DialogTitle>
          </DialogHeader>
          
          {inviteModal && (
            <div className="space-y-4">
              <div className="bg-slate-50 rounded-xl p-3">
                <p className="text-sm text-slate-600">
                  Sending invite to <strong>{inviteModal.user_name}</strong>
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  They're studying: {inviteModal.course_name}
                </p>
              </div>
              
              <Textarea
                placeholder="Add a personal message... (optional)"
                value={inviteMessage}
                onChange={(e) => setInviteMessage(e.target.value)}
                className="min-h-[80px]"
              />
              
              <Button
                onClick={sendInvite}
                disabled={sending}
                className="w-full bg-gradient-to-r from-purple-600 to-indigo-600"
              >
                {sending ? "Sending..." : "Send Study Invite 🎯"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function UserCard({ user, highlighted, onInvite }) {
  const moodConfig = moodIcons[user.mood] || moodIcons.focused;
  const MoodIcon = moodConfig.icon;
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex items-center gap-3 p-3 rounded-xl transition-all cursor-pointer hover:shadow-md ${
        highlighted 
          ? 'bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200' 
          : 'bg-white border border-slate-100 hover:border-purple-200'
      }`}
      onClick={onInvite}
    >
      {/* Avatar */}
      <div className="relative">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold ${
          highlighted 
            ? 'bg-gradient-to-br from-green-500 to-emerald-600' 
            : 'bg-gradient-to-br from-purple-500 to-indigo-600'
        }`}>
          {user.user_name?.[0]?.toUpperCase() || 'U'}
        </div>
        <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full ${statusColors[user.status]} ring-2 ring-white`} />
      </div>
      
      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="font-medium text-slate-900 text-sm truncate">{user.user_name}</p>
        <p className="text-xs text-slate-500 truncate flex items-center gap-1">
          <BookOpen className="w-3 h-3" />
          {user.course_name || "Browsing"}
        </p>
      </div>
      
      {/* Mood */}
      <div className={`${moodConfig.bg} p-1.5 rounded-lg`}>
        <MoodIcon className={`w-4 h-4 ${moodConfig.color}`} />
      </div>
      
      <ChevronRight className="w-4 h-4 text-slate-300" />
    </motion.div>
  );
}