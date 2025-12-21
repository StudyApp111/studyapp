import React, { useState, useRef, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Loader2, Sparkles, X, Minimize2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { motion, AnimatePresence } from "framer-motion";

export default function AITutorModal({ open, onOpenChange }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [userName, setUserName] = useState("");
  const messagesEndRef = useRef(null);
  const [isMinimized, setIsMinimized] = useState(false);

  useEffect(() => {
    const initializeChat = async () => {
      if (open && messages.length === 0) {
        try {
          const user = await base44.auth.me();
          const firstName = user.full_name?.split(' ')[0] || 'there';
          setUserName(firstName);
          setMessages([{
            role: "assistant",
            content: `Hey ${firstName}! 👋 I'm Polli, your AI study buddy. What can I help you learn today?`
          }]);
        } catch (error) {
          setMessages([{
            role: "assistant",
            content: `Hey there! 👋 I'm Polli, your AI study buddy. What can I help you learn today?`
          }]);
        }
      }
    };
    initializeChat();
  }, [open]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setIsLoading(true);

    try {
      const response = await base44.functions.invoke('aiTutorChat', {
        messages: [...messages, { role: "user", content: userMessage }],
        lessonContext: {}
      });

      if (response.data.error) {
        throw new Error(response.data.error);
      }

      setMessages((prev) => [...prev, {
        role: "assistant",
        content: response.data.reply
      }]);
    } catch (error) {
      console.error("Tutor error:", error);
      setMessages((prev) => [...prev, {
        role: "assistant",
        content: "Sorry, I encountered an error. Please try again."
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => onOpenChange(false)}
            className="fixed inset-0 bg-black/20 md:backdrop-blur-sm z-50"
          />

          {/* Chat Widget */}
          <motion.div
            initial={{ y: "100%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 md:bottom-6 md:right-6 md:left-auto md:w-[400px] bg-white rounded-t-3xl md:rounded-3xl shadow-2xl z-50 flex flex-col max-h-[85vh] md:max-h-[600px]"
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-purple-600 to-purple-700 rounded-t-3xl md:rounded-t-3xl px-4 py-3 flex items-center justify-between shadow-lg">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">Polli</h3>
                  <p className="text-xs text-white/80">Your AI study buddy</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setIsMinimized(!isMinimized)}
                  className="w-8 h-8 flex items-center justify-center hover:bg-white/10 rounded-full transition-colors"
                >
                  <Minimize2 className="w-4 h-4 text-white" />
                </button>
                <button
                  onClick={() => onOpenChange(false)}
                  className="w-8 h-8 flex items-center justify-center hover:bg-white/10 rounded-full transition-colors"
                >
                  <X className="w-4 h-4 text-white" />
                </button>
              </div>
            </div>

            {!isMinimized && (
              <>
                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gradient-to-b from-purple-50/30 to-white">
                  {messages.map((msg, idx) => (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ duration: 0.2 }}
                      className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
                          msg.role === 'user'
                            ? 'bg-gradient-to-br from-purple-600 to-purple-700 text-white shadow-md'
                            : 'bg-white text-slate-900 shadow-sm border border-slate-200'
                        }`}
                      >
                        {msg.role === 'assistant' ? (
                          <ReactMarkdown className="text-sm leading-relaxed prose prose-sm max-w-none [&>p]:my-0.5 [&>ul]:my-1 [&>ol]:my-1">
                            {msg.content}
                          </ReactMarkdown>
                        ) : (
                          <p className="text-sm leading-relaxed">{msg.content}</p>
                        )}
                      </div>
                    </motion.div>
                  ))}
                  {isLoading && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex justify-start"
                    >
                      <div className="bg-white rounded-2xl px-4 py-3 shadow-sm border border-slate-200">
                        <div className="flex gap-1">
                          <motion.div
                            animate={{ scale: [1, 1.2, 1] }}
                            transition={{ repeat: Infinity, duration: 0.6, delay: 0 }}
                            className="w-2 h-2 bg-purple-600 rounded-full"
                          />
                          <motion.div
                            animate={{ scale: [1, 1.2, 1] }}
                            transition={{ repeat: Infinity, duration: 0.6, delay: 0.2 }}
                            className="w-2 h-2 bg-purple-600 rounded-full"
                          />
                          <motion.div
                            animate={{ scale: [1, 1.2, 1] }}
                            transition={{ repeat: Infinity, duration: 0.6, delay: 0.4 }}
                            className="w-2 h-2 bg-purple-600 rounded-full"
                          />
                        </div>
                      </div>
                    </motion.div>
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <div className="p-4 bg-white border-t border-slate-200 rounded-b-3xl md:rounded-b-3xl">
                  <div className="flex gap-2">
                    <Input
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                      placeholder="Ask me anything..."
                      disabled={isLoading}
                      className="flex-1 border-slate-200 focus-visible:ring-purple-500 text-sm rounded-xl"
                    />
                    <Button
                      onClick={handleSend}
                      disabled={isLoading || !input.trim()}
                      size="icon"
                      className="bg-gradient-to-br from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 rounded-xl shadow-md"
                    >
                      <Send className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}