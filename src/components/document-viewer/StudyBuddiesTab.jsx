import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { motion, AnimatePresence } from "framer-motion";
import { Users, Copy, Check, UserPlus, Circle, Share2, Mail, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";

export default function StudyBuddiesTab({ lessonId, lessonName }) {
  const [studySession, setStudySession] = useState(null);
  const [activeStudiers, setActiveStudiers] = useState([]);
  const [user, setUser] = useState(null);
  const [copied, setCopied] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteSent, setInviteSent] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (lessonId) {
      initializeSession();
      const interval = setInterval(refreshActiveStudiers, 30000);
      return () => {
        clearInterval(interval);
        leaveSession();
      };
    }
  }, [lessonId]);

  const initializeSession = async () => {
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);

      const sessions = await base44.entities.StudyRoom.filter({ 
        name: `lesson_${lessonId}` 
      });

      let session;
      if (sessions.length > 0) {
        session = sessions[0];
      } else {
        session = await base44.entities.StudyRoom.create({
          name: `lesson_${lessonId}`,
          description: lessonName,
          subject: lessonName,
          is_public: true,
          member_emails: [currentUser.email],
          member_count: 1,
          is_active: true
        });
      }

      if (!session.member_emails?.includes(currentUser.email)) {
        const updatedMembers = [...(session.member_emails || []), currentUser.email];
        await base44.entities.StudyRoom.update(session.id, {
          member_emails: updatedMembers,
          member_count: updatedMembers.length
        });
        session.member_emails = updatedMembers;
      }

      setStudySession(session);
      await refreshActiveStudiers();
    } catch (error) {
      console.error("Error initializing study session:", error);
    }
  };

  const refreshActiveStudiers = async () => {
    try {
      const sessions = await base44.entities.StudyRoom.filter({ 
        name: `lesson_${lessonId}` 
      });
      
      if (sessions.length > 0) {
        const memberEmails = sessions[0].member_emails || [];
        setActiveStudiers(memberEmails);
        setStudySession(sessions[0]);
      }
    } catch (error) {
      console.error("Error refreshing studiers:", error);
    }
  };

  const leaveSession = async () => {
    try {
      if (!studySession?.id || !user?.email) return;
      
      const updatedMembers = (studySession.member_emails || []).filter(
        email => email !== user.email
      );
      
      await base44.entities.StudyRoom.update(studySession.id, {
        member_emails: updatedMembers,
        member_count: updatedMembers.length
      });
    } catch (error) {
      console.error("Error leaving session:", error);
    }
  };

  const copyInviteLink = () => {
    const link = `${window.location.origin}${window.location.pathname}?lessonId=${lessonId}`;
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
        subject: `${user?.full_name || 'A friend'} invited you to study together!`,
        body: `
          <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
            <h2 style="color: #7c3aed;">Study Together on StudyApp</h2>
            <p>${user?.full_name || 'Your friend'} is studying <strong>${lessonName}</strong> and wants you to join!</p>
            <a href="${window.location.origin}${window.location.pathname}?lessonId=${lessonId}" 
               style="display: inline-block; background: linear-gradient(to right, #7c3aed, #6366f1); color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">
              Join Study Session
            </a>
            <p style="color: #64748b; font-size: 14px; margin-top: 20px;">
              Study together, stay motivated, and ace your exams!
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

  const otherStudiers = activeStudiers.filter(email => email !== user?.email);
  const studyingCount = otherStudiers.length;

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="text-center">
        <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
          <Users className="w-8 h-8 text-white" />
        </div>
        <h2 className="text-xl md:text-2xl font-bold text-slate-900">Study Together</h2>
        <p className="text-slate-500 text-sm mt-1">Invite friends to study this lesson with you</p>
      </div>

      {/* Active Studiers */}
      <Card className="border-0 shadow-lg bg-gradient-to-br from-green-50 to-emerald-50">
        <CardContent className="p-4 md:p-6">
          <div className="flex items-center gap-2 mb-3">
            <Circle className="w-3 h-3 fill-green-500 text-green-500 animate-pulse" />
            <span className="font-semibold text-green-800">
              {studyingCount + 1} {studyingCount + 1 === 1 ? 'person' : 'people'} studying now
            </span>
          </div>
          
          <div className="flex flex-wrap gap-2">
            {/* Current user */}
            <div className="flex items-center gap-2 bg-white rounded-full px-3 py-1.5 shadow-sm border border-green-200">
              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white text-xs font-bold">
                {user?.full_name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'U'}
              </div>
              <span className="text-sm font-medium text-slate-700">You</span>
            </div>
            
            {/* Other studiers */}
            {otherStudiers.map((email) => (
              <div key={email} className="flex items-center gap-2 bg-white rounded-full px-3 py-1.5 shadow-sm border border-slate-200">
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white text-xs font-bold">
                  {email[0].toUpperCase()}
                </div>
                <span className="text-sm text-slate-600 truncate max-w-[120px]">{email.split('@')[0]}</span>
              </div>
            ))}
          </div>

          {studyingCount === 0 && (
            <p className="text-sm text-green-700 mt-3">
              You're the first one here! Invite friends to study together.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Invite Options */}
      <div className="grid gap-4">
        {/* Copy Link */}
        <Card className="border-0 shadow-md">
          <CardContent className="p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
                <Link2 className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900">Share Link</h3>
                <p className="text-xs text-slate-500">Copy and send to friends</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Input 
                value={`${window.location.origin}${window.location.pathname}?lessonId=${lessonId}`}
                readOnly
                className="text-xs bg-slate-50 flex-1"
              />
              <Button
                variant="outline"
                onClick={copyInviteLink}
                className="flex-shrink-0 gap-2"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 text-green-600" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
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
              <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center">
                <Mail className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900">Email Invite</h3>
                <p className="text-xs text-slate-500">Send a direct invitation</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Input 
                type="email"
                placeholder="friend@email.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && sendInvite()}
                className="flex-1"
              />
              <Button
                onClick={sendInvite}
                disabled={!inviteEmail.trim() || sending}
                className="bg-purple-600 hover:bg-purple-700 flex-shrink-0 gap-2"
              >
                <UserPlus className="w-4 h-4" />
                {sending ? 'Sending...' : 'Invite'}
              </Button>
            </div>
            <AnimatePresence>
              {inviteSent && (
                <motion.p
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="text-sm text-green-600 mt-2 flex items-center gap-1"
                >
                  <Check className="w-4 h-4" />
                  Invite sent successfully!
                </motion.p>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>
      </div>

      {/* Motivation */}
      <div className="bg-gradient-to-r from-purple-100 to-indigo-100 rounded-2xl p-4 text-center">
        <p className="text-purple-800 font-medium">
          🎯 Students who study together score <strong>23% higher</strong> on average
        </p>
      </div>
    </div>
  );
}