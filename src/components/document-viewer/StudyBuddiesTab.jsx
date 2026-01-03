import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { motion, AnimatePresence } from "framer-motion";
import { Users, Copy, Check, UserPlus, Mail, Link2, Send, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";

export default function StudyBuddiesTab({ lessonId, lessonName }) {
  const [user, setUser] = useState(null);
  const [copied, setCopied] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteSent, setInviteSent] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const loadUser = async () => {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
    };
    loadUser();
  }, []);

  const copyInviteLink = () => {
    const link = `${window.location.origin}/documentviewer?lessonId=${lessonId}&course=${encodeURIComponent(lessonName)}&tab=collaborate`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const sendInvite = async () => {
    if (!inviteEmail.trim() || sending) return;
    
    setSending(true);
    try {
      // Create invite record
      await base44.entities.StudyInvite.create({
        from_email: user.email,
        from_name: user.full_name || user.email.split('@')[0],
        to_email: inviteEmail.trim(),
        course_name: lessonName,
        lesson_id: lessonId,
        message: `Hey! Want to study ${lessonName} together?`,
        status: "pending",
        read: false
      });

      // Also send email
      await base44.integrations.Core.SendEmail({
        to: inviteEmail.trim(),
        subject: `${user?.full_name || 'A friend'} invited you to study ${lessonName}! 📚`,
        body: `
          <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #7c3aed; margin-bottom: 16px;">📚 Study Together on StudyApp</h2>
            <p style="color: #334155; font-size: 16px; line-height: 1.6;">
              <strong>${user?.full_name || 'Your friend'}</strong> is studying <strong>${lessonName}</strong> and wants you to join!
            </p>
            <p style="color: #64748b; font-size: 14px; margin: 16px 0;">
              Join now to study together!
            </p>
            <a href="${window.location.origin}/documentviewer?lessonId=${lessonId}&course=${encodeURIComponent(lessonName)}" 
               style="display: inline-block; background: linear-gradient(to right, #7c3aed, #6366f1); color: white; padding: 14px 28px; border-radius: 12px; text-decoration: none; font-weight: bold; margin-top: 8px;">
              Join Study Session 🎯
            </a>
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

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-5">
      {/* Header */}
      <div className="text-center">
        <div className="w-16 h-16 bg-gradient-to-br from-purple-500 via-indigo-500 to-pink-500 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-xl">
          <Users className="w-8 h-8 text-white" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900">Study Together</h2>
        <p className="text-slate-500 text-sm mt-1">
          Invite friends to study <span className="font-semibold text-purple-600">{lessonName}</span>
        </p>
      </div>

      {/* Invite Options */}
      <div className="grid gap-3">
        <p className="text-sm font-semibold text-slate-700 flex items-center gap-2">
          <UserPlus className="w-4 h-4 text-purple-600" />
          Invite Friends
        </p>
        
        {/* Copy Link */}
        <Card className="border-0 shadow-md hover:shadow-lg transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-purple-100 to-indigo-100 rounded-xl flex items-center justify-center">
                <Link2 className="w-5 h-5 text-purple-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-slate-900 text-sm">Share Link</h3>
                <p className="text-xs text-slate-500">Anyone with link can join</p>
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
              <div className="w-10 h-10 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-xl flex items-center justify-center">
                <Mail className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900 text-sm">Email Invite</h3>
                <p className="text-xs text-slate-500">Send a direct invite</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Input 
                type="email"
                placeholder="friend@email.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && sendInvite()}
                className="flex-1 h-10"
              />
              <Button
                onClick={sendInvite}
                disabled={!inviteEmail.trim() || sending}
                className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 gap-1.5"
              >
                <Send className="w-4 h-4" />
                {sending ? '...' : 'Send'}
              </Button>
            </div>
            <AnimatePresence>
              {inviteSent && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center gap-1.5 mt-2 text-green-600"
                >
                  <Check className="w-4 h-4" />
                  <span className="text-sm font-medium">Invite sent!</span>
                </motion.div>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>
      </div>

      {/* Fun Stats */}
      <div className="bg-gradient-to-r from-amber-50 to-yellow-50 rounded-xl p-4 border border-amber-200">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <p className="font-semibold text-amber-900">Study buddies boost grades!</p>
            <p className="text-xs text-amber-700">Students in groups score <strong>23% higher</strong> on average</p>
          </div>
        </div>
      </div>
    </div>
  );
}