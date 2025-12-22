import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { 
  ArrowLeft, Send, Users, Copy, Check, Settings,
  Loader2, MessageCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export default function StudyRoomChat({ room, user, onBack }) {
  const queryClient = useQueryClient();
  const [message, setMessage] = useState("");
  const [copied, setCopied] = useState(false);
  const messagesEndRef = useRef(null);

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ['room-messages', room.id],
    queryFn: () => base44.entities.StudyRoomMessage.filter({ room_id: room.id }),
    refetchInterval: 3000 // Poll every 3 seconds for new messages
  });

  const sendMessageMutation = useMutation({
    mutationFn: (content) => base44.entities.StudyRoomMessage.create({
      room_id: room.id,
      content,
      sender_name: user.full_name || "Anonymous",
      sender_email: user.email,
      message_type: "text"
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['room-messages', room.id] });
      setMessage("");
    }
  });

  const sortedMessages = [...messages].sort((a, b) => 
    new Date(a.created_date) - new Date(b.created_date)
  );

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [sortedMessages]);

  const handleSend = (e) => {
    e.preventDefault();
    if (!message.trim()) return;
    sendMessageMutation.mutate(message.trim());
  };

  const copyInviteCode = () => {
    navigator.clipboard.writeText(room.invite_code);
    setCopied(true);
    toast.success("Invite code copied!");
    setTimeout(() => setCopied(false), 2000);
  };

  const formatTime = (date) => {
    return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="flex flex-col h-[calc(100vh-280px)] min-h-[500px] bg-white rounded-2xl border overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-gradient-to-r from-purple-50 to-indigo-50">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h2 className="font-semibold text-slate-900">{room.name}</h2>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Users className="w-3 h-3" />
              {room.member_count || 1} members
              {room.subject && (
                <Badge variant="outline" className="text-[10px] py-0">{room.subject}</Badge>
              )}
            </div>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={copyInviteCode} className="gap-2">
          {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
          {room.invite_code}
        </Button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
          </div>
        ) : sortedMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <MessageCircle className="w-12 h-12 text-slate-200 mb-3" />
            <p className="text-slate-500 text-sm">No messages yet</p>
            <p className="text-slate-400 text-xs">Be the first to say hello!</p>
          </div>
        ) : (
          sortedMessages.map((msg, idx) => {
            const isOwn = msg.sender_email === user?.email;
            const showAvatar = idx === 0 || sortedMessages[idx - 1]?.sender_email !== msg.sender_email;
            
            return (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`max-w-[75%] ${isOwn ? 'items-end' : 'items-start'} flex flex-col`}>
                  {showAvatar && !isOwn && (
                    <span className="text-xs text-slate-500 mb-1 ml-1">
                      {msg.sender_name || "Anonymous"}
                    </span>
                  )}
                  <div className={`px-4 py-2 rounded-2xl ${
                    isOwn 
                      ? 'bg-purple-600 text-white rounded-br-md' 
                      : 'bg-slate-100 text-slate-900 rounded-bl-md'
                  }`}>
                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  </div>
                  <span className={`text-[10px] text-slate-400 mt-0.5 ${isOwn ? 'mr-1' : 'ml-1'}`}>
                    {formatTime(msg.created_date)}
                  </span>
                </div>
              </motion.div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSend} className="p-3 border-t bg-slate-50">
        <div className="flex gap-2">
          <Input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 bg-white"
          />
          <Button 
            type="submit" 
            size="icon" 
            className="bg-purple-600 hover:bg-purple-700"
            disabled={!message.trim() || sendMessageMutation.isPending}
          >
            {sendMessageMutation.isPending 
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <Send className="w-4 h-4" />
            }
          </Button>
        </div>
      </form>
    </div>
  );
}