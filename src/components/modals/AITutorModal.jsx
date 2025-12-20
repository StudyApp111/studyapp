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
      <DialogContent className="max-w-sm h-[85vh] p-0 bg-white/70 backdrop-blur-2xl border-2 border-purple-300/60 shadow-2xl mx-4">
        <div className="flex flex-col h-full rounded-xl overflow-hidden border border-purple-200/40">
          <div className="bg-gradient-to-r from-purple-600/90 to-purple-800/90 backdrop-blur-sm text-white p-5 flex items-center gap-3 border-b border-purple-400/30">
            <div className="w-9 h-9 bg-white/20 rounded-full flex items-center justify-center">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-base tracking-tight" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>AI Tutor</h3>
              <p className="text-xs text-purple-100 font-light">Ask me anything</p>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-3 bg-gradient-to-b from-white/40 to-white/20">
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${
                    msg.role === 'user'
                      ? 'bg-gradient-to-r from-purple-600/95 to-purple-700/95 text-white shadow-sm'
                      : 'bg-white/80 text-slate-900 shadow-sm border border-purple-100/50'
                  }`}
                  style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}
                >
                  {msg.role === 'assistant' ? (
                    <ReactMarkdown className="text-[15px] leading-relaxed prose prose-sm max-w-none prose-p:my-1.5 prose-headings:my-2 prose-p:leading-relaxed">
                      {msg.content}
                    </ReactMarkdown>
                  ) : (
                    <p className="text-[15px] leading-relaxed">{msg.content}</p>
                  )}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-white/80 rounded-2xl px-4 py-2.5 shadow-sm border border-purple-100/50">
                  <Loader2 className="w-5 h-5 animate-spin text-purple-600" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="p-4 border-t border-purple-200/40 bg-white/50 backdrop-blur-sm">
            <div className="flex gap-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                placeholder="Ask a question..."
                disabled={isLoading}
                className="flex-1 bg-white/90 border-purple-200/60 focus:border-purple-400/80 text-[15px]"
                style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}
              />
              <Button
                onClick={handleSend}
                disabled={isLoading || !input.trim()}
                className="bg-gradient-to-r from-purple-600 to-purple-800 hover:from-purple-700 hover:to-purple-900 shadow-md"
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