import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageCircle, Send, Loader2 } from "lucide-react";
import ReactMarkdown from "react-markdown";

export default function AITutorTab({ lesson, extractedContent }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [contextData, setContextData] = useState(null);
  const scrollRef = useRef(null);

  useEffect(() => {
    initializeContext();
  }, [lesson?.id]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const initializeContext = async () => {
    try {
      const user = await base44.auth.me();
      const profile = await base44.entities.LearningProfile.filter({
        id: user.learning_profile_id
      });
      const learningProfile = profile[0] || {};

      // Compress content if needed
      let content = extractedContent || lesson?.description || "";
      if (content.length > 1000) {
        const { data: compressed } = await base44.functions.invoke('compressDocument', {
          content: content
        });
        content = compressed.compressed_content || content;
      }

      setContextData({
        school: learningProfile.school || "N/A",
        grade: learningProfile.grade || "N/A",
        course: lesson?.course_name || "N/A",
        content: content
      });

      setMessages([{
        role: "assistant",
        content: "Hi! I'm your AI tutor. I've reviewed your course material and I'm ready to help you understand it better. What would you like to learn about?"
      }]);
    } catch (error) {
      console.error("Error initializing:", error);
      setMessages([{
        role: "assistant",
        content: "Hi! I'm your AI tutor. Ask me anything about your course material!"
      }]);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userInput = input.trim();
    const userMessage = { role: "user", content: userInput };
    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const systemPrompt = `You are an expert AI tutor helping a ${contextData?.grade || 'student'} at ${contextData?.school || 'their school'} with ${contextData?.course || 'their course'}.

Course Material:
${contextData?.content || 'No content available'}

---

Your role:
- Answer questions clearly and concisely for the student's grade level
- Use the course material as your primary reference
- Break down complex concepts into simple explanations
- Provide examples and analogies
- Encourage understanding, not just memorization
- Be supportive and patient

Student's question: ${userInput}`;

      const response = await base44.integrations.Core.InvokeLLM({
        prompt: systemPrompt,
        add_context_from_internet: true
      });

      const aiMessage = {
        role: "assistant",
        content: response
      };

      setMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      console.error("Error sending message:", error);
      setMessages(prev => [...prev, {
        role: "assistant",
        content: "Sorry, I encountered an error. Please try again."
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-200px)] bg-white/90 border border-purple-200 backdrop-blur-xl rounded-xl shadow-xl">
      <div className="border-b border-purple-200 px-6 py-4">
        <div className="flex items-center gap-2 text-slate-900 font-semibold">
          <MessageCircle className="w-5 h-5" />
          AI Tutor
        </div>
      </div>

      <ScrollArea className="flex-1 p-6" ref={scrollRef}>
        <div className="space-y-4">
          {messages.map((message, index) => (
            <div
              key={index}
              className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-lg p-3 ${
                  message.role === "user"
                    ? "bg-purple-600 text-white"
                    : "bg-slate-100 text-slate-900"
                }`}
              >
                {message.role === "assistant" ? (
                  <ReactMarkdown className="prose prose-sm prose-slate max-w-none">
                    {message.content}
                  </ReactMarkdown>
                ) : (
                  <p className="text-sm">{message.content}</p>
                )}
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-slate-100 text-slate-900 rounded-lg p-3">
                <Loader2 className="w-4 h-4 animate-spin" />
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      <div className="border-t border-purple-200 p-4">
        <div className="flex gap-2">
          <Input
            placeholder="Ask a question about your course..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
            className="flex-1"
            disabled={isLoading}
          />
          <Button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="bg-purple-600 hover:bg-purple-700"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}