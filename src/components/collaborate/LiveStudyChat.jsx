import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Smile, Image, ThumbsUp, Heart, PartyPopper, Flame, Brain, Zap, ChevronLeft, Users, Circle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

const quickReactions = [
  { emoji: "👍", label: "Nice!" },
  { emoji: "🔥", label: "On fire!" },
  { emoji: "💪", label: "Let's go!" },
  { emoji: "🤔", label: "Thinking..." },
  { emoji: "😅", label: "Struggling" },
  { emoji: "🎉", label: "Got it!" },
  { emoji: "☕", label: "Break?" },
  { emoji: "📚", label: "Studying" },
];

const studyPrompts = [
  "Just finished a section! 💪",
  "Anyone else confused by this?",
  "Taking a quick break ☕",
  "Back to studying! 📚",
  "This is making sense now 💡",
  "Quiz me on this topic!",
];

export default function LiveStudyChat({ roomId, roomName, memberCount, user, onBack }) {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [showPrompts, setShowPrompts] = useState(false);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    loadMessages();
    const interval = setInterval(loadMessages, 5000); // Poll every 5s for real-time feel
    return () => clearInterval(interval);
  }, [roomId]);

  useEffect(() => {
    // Auto-scroll to bottom on new messages
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const loadMessages = async () => {
    try {
      const msgs = await base44.entities.StudyRoomMessage.filter({ 
        room_id: roomId 
      });
      const sorted = msgs.sort((a, b) => 
        new Date(a.created_date) - new Date(b.created_date)
      );
      setMessages(sorted.slice(-100));
    } catch (error) {
      console.error("Error loading messages:", error);
    }
  };

  const sendMessage = async (content) => {
    const messageContent = content || newMessage.trim();
    if (!messageContent || sending) return;
    
    setSending(true);
    try {
      await base44.entities.StudyRoomMessage.create({
        room_id: roomId,
        content: messageContent,
        sender_name: user?.full_name || user?.email?.split('@')[0] || 'Anonymous',
        sender_email: user?.email,
        message_type: 'text'
      });
      setNewMessage("");
      await loadMessages();
      inputRef.current?.focus();
    } catch (error) {
      console.error("Error sending message:", error);
    } finally {
      setSending(false);
    }
  };

  const sendQuickReaction = (emoji) => {
    sendMessage(emoji);
  };

  const formatTime = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDateDivider = (dateStr) => {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (date.toDateString() === today.toDateString()) return "Today";
    if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
    return date.toLocaleDateString();
  };

  // Group messages by date
  const groupedMessages = messages.reduce((groups, msg) => {
    const date = formatDateDivider(msg.created_date);
    if (!groups[date]) groups[date] = [];
    groups[date].push(msg);
    return groups;
  }, {});

  return (
    <div className="flex flex-col h-full bg-white rounded-xl overflow-hidden shadow-lg border">
      {/* Header */}
      <div className="flex items-center gap-3 p-3 border-b bg-gradient-to-r from-purple-50 to-indigo-50">
        <Button 
          variant="ghost" 
          size="icon"
          onClick={onBack}
          className="h-8 w-8"
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1">
          <h3 className="font-semibold text-slate-900 text-sm">{roomName}</h3>
          <p className="text-xs text-slate-500 flex items-center gap-1">
            <Circle className="w-2 h-2 fill-green-500 text-green-500" />
            {memberCount} members
          </p>
        </div>
        <div className="flex -space-x-2">
          {[...Array(Math.min(3, memberCount))].map((_, i) => (
            <div 
              key={i}
              className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-400 to-indigo-500 border-2 border-white flex items-center justify-center"
            >
              <span className="text-[10px] text-white font-bold">{memberCount > 3 && i === 2 ? `+${memberCount - 2}` : ''}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Messages Area */}
      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        {messages.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Users className="w-8 h-8 text-purple-500" />
            </div>
            <h3 className="font-semibold text-slate-900 mb-1">Start the conversation!</h3>
            <p className="text-sm text-slate-500">Say hi to your study buddies 👋</p>
          </div>
        ) : (
          <div className="space-y-4">
            {Object.entries(groupedMessages).map(([date, msgs]) => (
              <div key={date}>
                {/* Date Divider */}
                <div className="flex items-center gap-3 my-4">
                  <div className="flex-1 h-px bg-slate-200" />
                  <span className="text-xs text-slate-400 font-medium">{date}</span>
                  <div className="flex-1 h-px bg-slate-200" />
                </div>
                
                {/* Messages */}
                <div className="space-y-3">
                  {msgs.map((msg, idx) => {
                    const isMe = msg.sender_email === user?.email;
                    const showAvatar = idx === 0 || msgs[idx - 1]?.sender_email !== msg.sender_email;
                    const isQuickEmoji = msg.content.length <= 2 && /[\u{1F300}-\u{1F9FF}]/u.test(msg.content);
                    
                    return (
                      <motion.div
                        key={msg.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
                      >
                        <div className={`flex gap-2 max-w-[80%] ${isMe ? 'flex-row-reverse' : ''}`}>
                          {/* Avatar */}
                          {showAvatar && !isMe ? (
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                              {msg.sender_name?.[0]?.toUpperCase() || 'U'}
                            </div>
                          ) : !isMe ? (
                            <div className="w-8" /> // Spacer
                          ) : null}
                          
                          {/* Message */}
                          <div className={isMe ? 'text-right' : ''}>
                            {showAvatar && !isMe && (
                              <p className="text-xs text-slate-500 mb-1 ml-1">{msg.sender_name}</p>
                            )}
                            
                            {isQuickEmoji ? (
                              // Large emoji reaction
                              <motion.span 
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                className="text-4xl"
                              >
                                {msg.content}
                              </motion.span>
                            ) : (
                              <div className={`rounded-2xl px-4 py-2 ${
                                isMe 
                                  ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-br-md' 
                                  : 'bg-slate-100 text-slate-900 rounded-bl-md'
                              }`}>
                                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                              </div>
                            )}
                            
                            <p className={`text-[10px] text-slate-400 mt-1 ${isMe ? 'mr-1' : 'ml-1'}`}>
                              {formatTime(msg.created_date)}
                            </p>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>

      {/* Quick Prompts */}
      <AnimatePresence>
        {showPrompts && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t overflow-hidden"
          >
            <div className="p-2 flex flex-wrap gap-1">
              {studyPrompts.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => {
                    sendMessage(prompt);
                    setShowPrompts(false);
                  }}
                  className="text-xs bg-purple-50 text-purple-700 px-3 py-1.5 rounded-full hover:bg-purple-100 transition-colors"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input Area */}
      <div className="p-3 border-t bg-white">
        {/* Quick Reactions */}
        <div className="flex gap-1 mb-2 overflow-x-auto pb-1">
          {quickReactions.map((reaction) => (
            <button
              key={reaction.emoji}
              onClick={() => sendQuickReaction(reaction.emoji)}
              className="flex-shrink-0 text-xl hover:scale-125 transition-transform p-1"
              title={reaction.label}
            >
              {reaction.emoji}
            </button>
          ))}
        </div>
        
        {/* Message Input */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setShowPrompts(!showPrompts)}
            className="flex-shrink-0"
          >
            <Zap className={`w-4 h-4 ${showPrompts ? 'text-purple-600' : ''}`} />
          </Button>
          
          <Input
            ref={inputRef}
            placeholder="Type a message..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
            className="flex-1"
          />
          
          <Button
            onClick={() => sendMessage()}
            disabled={!newMessage.trim() || sending}
            className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}