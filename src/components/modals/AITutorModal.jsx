import React, { useState, useRef, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Send, Loader2, Sparkles } from "lucide-react";
import ReactMarkdown from "react-markdown";

export default function AITutorModal({ open, onOpenChange }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [userName, setUserName] = useState("");
  const messagesEndRef = useRef(null);

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
      <DialogContent className="max-w-[340px] h-[75vh] p-0 bg-gradient-to-b from-purple-600/50 to-purple-700/40 backdrop-blur-2xl border border-white/30 shadow-2xl mx-auto rounded-[32px] overflow-hidden">
        <div className="flex flex-col h-full p-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-11 h-11 bg-white/30 rounded-full flex items-center justify-center backdrop-blur-sm shadow-lg">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-white text-lg">Polli</h3>
              <p className="text-xs text-white/80">Your AI study buddy</p>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto space-y-3 mb-4">
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-3xl px-4 py-3 backdrop-blur-md ${
                    msg.role === 'user'
                      ? 'bg-purple-700/90 text-white shadow-lg'
                      : 'bg-white/80 text-slate-900 shadow-md'
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
                <div className="bg-white/80 backdrop-blur-md rounded-3xl px-4 py-3 shadow-md">
                  <Loader2 className="w-5 h-5 animate-spin text-purple-600" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
              placeholder="Type your question..."
              disabled={isLoading}
              className="flex-1 bg-white/80 backdrop-blur-sm border-0 focus:ring-2 focus:ring-white/40 text-[15px] placeholder:text-slate-500/70 rounded-full px-5"
            />
            <Button
              onClick={handleSend}
              disabled={isLoading || !input.trim()}
              className="bg-white/90 hover:bg-white text-purple-700 backdrop-blur-sm shadow-lg rounded-full w-11 h-11 p-0"
            >
              <Send className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}