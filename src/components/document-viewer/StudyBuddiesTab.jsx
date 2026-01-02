import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { motion, AnimatePresence } from "framer-motion";
import { Users, Copy, Check, UserPlus, Circle, Mail, Link2, MessageCircle, Send, BookOpen, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function StudyBuddiesTab({ lessonId, lessonName }) {
  const [studyRoom, setStudyRoom] = useState(null);
  const [messages, setMessages] = useState([]);
  const [activeMembers, setActiveMembers] = useState([]);
  const [user, setUser] = useState(null);
  const [copied, setCopied] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteSent, setInviteSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);
  const [view, setView] = useState("main"); // "main" or "chat"

  // Normalize course name for matching (e.g., "MATH 101" and "Math101" should match)
  const normalizeCourseName = (name) => {
    if (!name) return "";
    return name.toLowerCase().replace(/[^a-z0-9]/g, '');
  };

  const courseKey = normalizeCourseName(lessonName);

  useEffect(() => {
    if (lessonName) {
      initializeRoom();
      const interval = setInterval(refreshRoom, 15000);
      return () => {
        clearInterval(interval);
        markInactive();
      };
    }
  }, [lessonName]);

  const initializeRoom = async () => {
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);

      // Find or create a study room for this COURSE (not lesson)
      // This allows anyone studying the same course to connect
      const rooms = await base44.entities.StudyRoom.filter({ 
        invite_code: `course_${courseKey}` 
      });

      let room;
      if (rooms.length > 0) {
        room = rooms[0];
        // Add user to room if not already a member
        if (!room.member_emails?.includes(currentUser.email)) {
          const updatedMembers = [...(room.member_emails || []), currentUser.email];
          await base44.entities.StudyRoom.update(room.id, {
            member_emails: updatedMembers,
            member_count: updatedMembers.length
          });
          room.member_emails = updatedMembers;
        }
      } else {
        room = await base44.entities.StudyRoom.create({
          name: lessonName,
          description: `Study group for ${lessonName}`,
          subject: lessonName,
          invite_code: `course_${courseKey}`,
          is_public: true,
          member_emails: [currentUser.email],
          member_count: 1,
          is_active: true
        });
      }

      setStudyRoom(room);
      await loadMessages(room.id);
      await refreshRoom();
    } catch (error) {
      console.error("Error initializing study room:", error);
    }
  };

  const loadMessages = async (roomId) => {
    try {
      const msgs = await base44.entities.StudyRoomMessage.filter({ 
        room_id: roomId 
      });
      // Sort by created_date ascending (oldest first)
      const sorted = msgs.sort((a, b) => 
        new Date(a.created_date) - new Date(b.created_date)
      );
      setMessages(sorted.slice(-50)); // Keep last 50 messages
    } catch (error) {
      console.error("Error loading messages:", error);
    }
  };

  const refreshRoom = async () => {
    try {
      if (!studyRoom?.id) return;
      
      const rooms = await base44.entities.StudyRoom.filter({ 
        invite_code: `course_${courseKey}` 
      });
      
      if (rooms.length > 0) {
        setStudyRoom(rooms[0]);
        setActiveMembers(rooms[0].member_emails || []);
        await loadMessages(rooms[0].id);
      }
    } catch (error) {
      console.error("Error refreshing room:", error);
    }
  };

  const markInactive = async () => {
    // We don't remove from member_emails on leave - they stay as group members
    // This is intentional - once you join a study group, you're a member
  };

  const copyInviteLink = () => {
    // Share link goes to a join page with course info
    const link = `${window.location.origin}/home?joinCourse=${encodeURIComponent(lessonName)}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const sendInvite = async () => {
    if (!inviteEmail.trim() || sending) return;
    
    setSending(true);
    try {
      await base44.integrations.Core.SendEmail({
        to: inviteEmail.trim(),
        subject: `${user?.full_name || 'A friend'} invited you to study ${lessonName}!`,
        body: `
          <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #7c3aed; margin-bottom: 16px;">📚 Study Together on StudyApp</h2>
            <p style="color: #334155; font-size: 16px; line-height: 1.6;">
              <strong>${user?.full_name || 'Your friend'}</strong> is studying <strong>${lessonName}</strong> and wants you to join their study group!
            </p>
            <p style="color: #64748b; font-size: 14px; margin: 16px 0;">
              Join the group to chat, share tips, and stay motivated together.
            </p>
            <a href="${window.location.origin}/home?joinCourse=${encodeURIComponent(lessonName)}" 
               style="display: inline-block; background: linear-gradient(to right, #7c3aed, #6366f1); color: white; padding: 14px 28px; border-radius: 12px; text-decoration: none; font-weight: bold; margin-top: 8px;">
              Join Study Group
            </a>
            <p style="color: #94a3b8; font-size: 12px; margin-top: 24px;">
              StudyApp - Study smarter, together 🎯
            </p>
          </div>
        `
      });
      setInviteSent(true);
      setInviteEmail("");
      setTimeout(() => setInviteSent(false), 3000);
    } catch (error) {
      console.error("Error sending invite:", error);
    } finally {
      setSending(false);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || sendingMessage || !studyRoom?.id) return;
    
    setSendingMessage(true);
    try {
      await base44.entities.StudyRoomMessage.create({
        room_id: studyRoom.id,
        content: newMessage.trim(),
        sender_name: user?.full_name || user?.email?.split('@')[0] || 'Anonymous',
        sender_email: user?.email,
        message_type: 'text'
      });
      setNewMessage("");
      await loadMessages(studyRoom.id);
    } catch (error) {
      console.error("Error sending message:", error);
    } finally {
      setSendingMessage(false);
    }
  };

  const otherMembers = activeMembers.filter(email => email !== user?.email);
  const memberCount = activeMembers.length;

  const formatTime = (dateStr) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return date.toLocaleDateString();
  };

  // Chat View
  if (view === "chat") {
    return (
      <div className="flex flex-col h-full max-h-[calc(100vh-200px)] md:max-h-[calc(100vh-180px)]">
        {/* Chat Header */}
        <div className="flex items-center justify-between p-3 border-b bg-white">
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => setView("main")}
            className="text-slate-600"
          >
            ← Back
          </Button>
          <div className="text-center">
            <h3 className="font-semibold text-slate-900 text-sm">{lessonName}</h3>
            <p className="text-xs text-slate-500">{memberCount} members</p>
          </div>
          <div className="w-16" /> {/* Spacer */}
        </div>

        {/* Messages */}
        <ScrollArea className="flex-1 p-4">
          {messages.length === 0 ? (
            <div className="text-center py-12">
              <MessageCircle className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500 text-sm">No messages yet</p>
              <p className="text-slate-400 text-xs">Be the first to say hi! 👋</p>
            </div>
          ) : (
            <div className="space-y-3">
              {messages.map((msg) => {
                const isMe = msg.sender_email === user?.email;
                return (
                  <div 
                    key={msg.id} 
                    className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`max-w-[80%] ${isMe ? 'order-2' : 'order-1'}`}>
                      {!isMe && (
                        <p className="text-xs text-slate-500 mb-1 ml-1">{msg.sender_name}</p>
                      )}
                      <div className={`rounded-2xl px-4 py-2 ${
                        isMe 
                          ? 'bg-purple-600 text-white rounded-br-md' 
                          : 'bg-slate-100 text-slate-900 rounded-bl-md'
                      }`}>
                        <p className="text-sm">{msg.content}</p>
                      </div>
                      <p className={`text-[10px] text-slate-400 mt-1 ${isMe ? 'text-right mr-1' : 'ml-1'}`}>
                        {formatTime(msg.created_date)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>

        {/* Message Input */}
        <div className="p-3 border-t bg-white">
          <div className="flex gap-2">
            <Input
              placeholder="Type a message..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
              className="flex-1"
            />
            <Button
              onClick={sendMessage}
              disabled={!newMessage.trim() || sendingMessage}
              className="bg-purple-600 hover:bg-purple-700"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Main View
  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-5">
      {/* Header */}
      <div className="text-center">
        <div className="w-14 h-14 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-lg">
          <Users className="w-7 h-7 text-white" />
        </div>
        <h2 className="text-xl font-bold text-slate-900">Study Group</h2>
        <p className="text-slate-500 text-sm mt-1">Connect with others studying <span className="font-medium text-purple-600">{lessonName}</span></p>
      </div>

      {/* How It Works - Brief explanation */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-100">
        <div className="flex items-start gap-3">
          <Sparkles className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-blue-900 font-medium">How it works</p>
            <p className="text-xs text-blue-700 mt-1">
              Everyone studying this course joins the same group. Chat, share tips, and motivate each other - while keeping your own notes private.
            </p>
          </div>
        </div>
      </div>

      {/* Group Members */}
      <Card className="border-0 shadow-lg bg-gradient-to-br from-green-50 to-emerald-50">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Circle className="w-2.5 h-2.5 fill-green-500 text-green-500 animate-pulse" />
              <span className="font-semibold text-green-800 text-sm">
                {memberCount} {memberCount === 1 ? 'member' : 'members'}
              </span>
            </div>
            {messages.length > 0 && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setView("chat")}
                className="text-purple-600 hover:text-purple-700 hover:bg-purple-50 gap-1.5"
              >
                <MessageCircle className="w-4 h-4" />
                Chat ({messages.length})
              </Button>
            )}
          </div>
          
          <div className="flex flex-wrap gap-2">
            {/* Current user */}
            <div className="flex items-center gap-2 bg-white rounded-full px-3 py-1.5 shadow-sm border border-green-200">
              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white text-xs font-bold">
                {user?.full_name?.[0]?.toUpperCase() || 'U'}
              </div>
              <span className="text-sm font-medium text-slate-700">You</span>
            </div>
            
            {/* Other members */}
            {otherMembers.slice(0, 5).map((email) => (
              <div key={email} className="flex items-center gap-2 bg-white rounded-full px-3 py-1.5 shadow-sm border border-slate-200">
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white text-xs font-bold">
                  {email[0].toUpperCase()}
                </div>
                <span className="text-sm text-slate-600 truncate max-w-[100px]">{email.split('@')[0]}</span>
              </div>
            ))}
            {otherMembers.length > 5 && (
              <div className="flex items-center px-3 py-1.5 text-sm text-slate-500">
                +{otherMembers.length - 5} more
              </div>
            )}
          </div>

          {memberCount === 1 && (
            <p className="text-sm text-green-700 mt-3">
              You're the first one here! Invite classmates to study together.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Chat Button - Prominent CTA */}
      <Button
        onClick={() => setView("chat")}
        className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white py-6 rounded-xl shadow-lg gap-2"
      >
        <MessageCircle className="w-5 h-5" />
        Open Group Chat
        {messages.length > 0 && (
          <span className="ml-2 bg-white/20 px-2 py-0.5 rounded-full text-xs">
            {messages.length} messages
          </span>
        )}
      </Button>

      {/* Invite Options */}
      <div className="grid gap-3">
        {/* Copy Link */}
        <Card className="border-0 shadow-md">
          <CardContent className="p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 bg-purple-100 rounded-lg flex items-center justify-center">
                <Link2 className="w-4 h-4 text-purple-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-slate-900 text-sm">Invite via Link</h3>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={copyInviteLink}
                className="gap-1.5"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-green-600" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    Copy
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Email Invite */}
        <Card className="border-0 shadow-md">
          <CardContent className="p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 bg-indigo-100 rounded-lg flex items-center justify-center">
                <Mail className="w-4 h-4 text-indigo-600" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900 text-sm">Email Invite</h3>
              </div>
            </div>
            <div className="flex gap-2">
              <Input 
                type="email"
                placeholder="friend@email.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && sendInvite()}
                className="flex-1 h-9 text-sm"
              />
              <Button
                onClick={sendInvite}
                disabled={!inviteEmail.trim() || sending}
                size="sm"
                className="bg-purple-600 hover:bg-purple-700 gap-1.5"
              >
                <UserPlus className="w-3.5 h-3.5" />
                {sending ? '...' : 'Send'}
              </Button>
            </div>
            <AnimatePresence>
              {inviteSent && (
                <motion.p
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="text-xs text-green-600 mt-2 flex items-center gap-1"
                >
                  <Check className="w-3.5 h-3.5" />
                  Invite sent!
                </motion.p>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>
      </div>

      {/* Motivation */}
      <div className="bg-gradient-to-r from-purple-100 to-indigo-100 rounded-xl p-3 text-center">
        <p className="text-purple-800 text-sm font-medium">
          🎯 Students in study groups score <strong>23% higher</strong> on average
        </p>
      </div>
    </div>
  );
}