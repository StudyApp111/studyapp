import React, { useState, useRef, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Send, Loader2, Sparkles } from "lucide-react";
import ReactMarkdown from "react-markdown";

export default function AITutorModal({ open, onOpenChange }) {
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content: `Hi! I'm your AI tutor. Ask me anything about your studies and I'll help explain concepts, answer questions, and guide your learning. 🎓`
    }
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

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
    setMessages(prev => [...prev, { role: "user", content: userMessage }]);
    setIsLoading(true);

    try {
      const response = await base44.functions.invoke('aiTutorChat', {
        messages: [...messages, { role: "user", content: userMessage }],
        lessonContext: {}
      });

      if (response.data.error) {
        throw new Error(response.data.error);
      }

      setMessages(prev => [...prev, { 
        role: "assistant", 
        content: response.data.reply 
      }]);
    } catch (error) {
      console.error("Tutor error:", error);
      setMessages(prev => [...prev, { 
        role: "assistant", 
        content: "Sorry, I encountered an error. Please try again." 
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md h-[80vh] p-0 bg-white/30 backdrop-blur-xl border border-white/40 shadow-2xl mx-4 rounded-3xl overflow-hidden">
        <div className="flex flex-col h-full">
          <div className="bg-gradient-to-r from-purple-600/60 to-purple-700/60 backdrop-blur-md text-white px-6 py-4 flex items-center gap-3 border-b border-white/20">
            <div className="w-10 h-10 bg-white/25 rounded-full flex items-center justify-center backdrop-blur-sm">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-lg">AI Tutor</h3>
              <p className="text-xs text-white/90">Ask me anything</p>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 backdrop-blur-md ${
                    msg.role === 'user'
                      ? 'bg-purple-600/85 text-white shadow-lg'
                      : 'bg-white/60 text-slate-900 shadow-md border border-white/30'
                  }`}
                >
                  {msg.role === 'assistant' ? (
                    <ReactMarkdown className="text-[15px] leading-relaxed prose prose-sm max-w-none prose-p:my-1 prose-headings:my-2">
                      {msg.content}
                    </ReactMarkdown>
                  ) : (
                    <p className="text-[15px] leading-relaxed font-medium">{msg.content}</p>
                  )}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-white/60 backdrop-blur-md rounded-2xl px-4 py-3 shadow-md border border-white/30">
                  <Loader2 className="w-5 h-5 animate-spin text-purple-600" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="px-5 py-4 bg-white/20 backdrop-blur-md border-t border-white/20">
            <div className="flex gap-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                placeholder="Type your question..."
                disabled={isLoading}
                className="flex-1 bg-white/70 backdrop-blur-sm border-white/40 focus:border-purple-400/60 text-[15px] placeholder:text-slate-500/70"
              />
              <Button
                onClick={handleSend}
                disabled={isLoading || !input.trim()}
                className="bg-purple-600/90 hover:bg-purple-700/90 backdrop-blur-sm shadow-lg"
                size="icon"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}