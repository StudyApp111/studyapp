import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, Check, X, Users, BookOpen, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export default function StudyInviteNotifications({ userEmail }) {
  const navigate = useNavigate();
  const [invites, setInvites] = useState([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (userEmail) {
      loadInvites();
      const interval = setInterval(loadInvites, 60000); // Reduced from 30s to 60s
      return () => clearInterval(interval);
    }
  }, [userEmail]);

  const loadInvites = async () => {
    try {
      const pending = await base44.entities.StudyInvite.filter({
        to_email: userEmail,
        status: "pending"
      });
      setInvites(pending);
    } catch (error) {
      console.error("Error loading invites:", error);
    }
  };

  const handleAccept = async (invite) => {
    try {
      await base44.entities.StudyInvite.update(invite.id, { 
        status: "accepted",
        read: true 
      });
      
      // Navigate to the lesson
      if (invite.lesson_id) {
        navigate(createPageUrl("DocumentViewer") + `?lessonId=${invite.lesson_id}&tab=collaborate`);
      }
      
      setInvites(invites.filter(i => i.id !== invite.id));
      setOpen(false);
    } catch (error) {
      console.error("Error accepting invite:", error);
    }
  };

  const handleDecline = async (invite) => {
    try {
      await base44.entities.StudyInvite.update(invite.id, { 
        status: "declined",
        read: true 
      });
      setInvites(invites.filter(i => i.id !== invite.id));
    } catch (error) {
      console.error("Error declining invite:", error);
    }
  };

  const unreadCount = invites.filter(i => !i.read).length;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="relative p-2 rounded-lg hover:bg-purple-50 transition-colors">
          <Bell className="w-5 h-5 text-slate-600" />
          {unreadCount > 0 && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center"
            >
              <span className="text-[10px] font-bold text-white">{unreadCount}</span>
            </motion.div>
          )}
        </button>
      </PopoverTrigger>
      
      <PopoverContent className="w-80 p-0" align="end">
        <div className="p-3 border-b bg-gradient-to-r from-purple-50 to-indigo-50">
          <h3 className="font-semibold text-slate-900 flex items-center gap-2">
            <Users className="w-4 h-4 text-purple-600" />
            Study Invites
          </h3>
        </div>
        
        <div className="max-h-[300px] overflow-y-auto">
          {invites.length === 0 ? (
            <div className="p-6 text-center">
              <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <Sparkles className="w-6 h-6 text-slate-400" />
              </div>
              <p className="text-sm text-slate-500">No pending invites</p>
            </div>
          ) : (
            <div className="divide-y">
              <AnimatePresence>
                {invites.map((invite) => (
                  <motion.div
                    key={invite.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    className="p-3 hover:bg-slate-50"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white font-bold flex-shrink-0">
                        {invite.from_name?.[0]?.toUpperCase() || 'U'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm">
                          <strong>{invite.from_name}</strong> wants to study together
                        </p>
                        {invite.course_name && (
                          <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                            <BookOpen className="w-3 h-3" />
                            {invite.course_name}
                          </p>
                        )}
                        {invite.message && (
                          <p className="text-xs text-slate-600 mt-1 bg-slate-100 rounded-lg p-2 italic">
                            "{invite.message}"
                          </p>
                        )}
                        
                        <div className="flex gap-2 mt-2">
                          <Button
                            size="sm"
                            onClick={() => handleAccept(invite)}
                            className="bg-green-600 hover:bg-green-700 h-8 px-3 gap-1"
                          >
                            <Check className="w-3 h-3" />
                            Join
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDecline(invite)}
                            className="h-8 px-3 gap-1"
                          >
                            <X className="w-3 h-3" />
                            Decline
                          </Button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}