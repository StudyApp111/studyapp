import React, { useRef, useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Sparkles, FileText, HelpCircle, List, Lightbulb } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { motion } from "framer-motion";

export default function AITutorPanel({ messages, setMessages, input, setInput, isLoading, setIsLoading, lesson }) {
  const messagesEndRef = useRef(null);
  const [showQuickActions, setShowQuickActions] = useState(true);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Add welcome message on mount or when lesson changes
  useEffect(() => {
    const loadWelcomeMessage = async () => {
      if (lesson) {
        const courseName = lesson.course_name || "your course";
        
        // Check for lesson-specific Polly prediction data from StudyPlan (not user profile)
        let pollyInsight = '';
        try {
          const plans = await base44.entities.StudyPlan.filter({ 
            lesson_id: lesson.id, 
            status: 'active' 
          });
          if (plans.length > 0 && plans[0].current_predicted_grade) {
            const plan = plans[0];
            const velocityEmoji = plan.learning_velocity === 'Accelerating' ? '📈' : 
                                   plan.learning_velocity === 'Declining' ? '📉' : '➡️';
            pollyInsight = `\n\n🔮 **Current Prediction:** ${plan.current_predicted_grade} (${plan.current_confidence || 45}% confidence) ${velocityEmoji}`;
            if (plan.mastery_gap) {
              pollyInsight += `\n💡 Focus area: *${plan.mastery_gap}*`;
            }
          }
        } catch (err) {
          // Silent fail - just don't show Polly insight
        }
        
        setMessages([{
          role: "assistant",
          content: `👋 Hi! I'm Polly, your AI study assistant for **${courseName}**.${pollyInsight}\n\nI can help you:\n• Summarize key concepts\n• Quiz you on the material\n• Explain confusing topics\n• Check your progress`
        }]);
      }
    };
    loadWelcomeMessage();
  }, [lesson?.id]);

  // Listen for "Ask AI" button clicks from exam/flashcard components
  useEffect(() => {
    const handleAskAI = (event) => {
      const contextData = event.detail;
      if (contextData?.initialPrompt) {
        setShowQuickActions(false);
        handleSend(contextData.initialPrompt);
      }
    };

    window.addEventListener('askAIFromContext', handleAskAI);
    return () => window.removeEventListener('askAIFromContext', handleAskAI);
  }, [messages]);

  const handleSend = async (customMessage) => {
    const messageToSend = customMessage || input.trim();
    if (!messageToSend || isLoading) return;

    if (!customMessage) setInput("");
    setMessages((prev) => [...prev, { role: "user", content: messageToSend }]);
    setIsLoading(true);
    setShowQuickActions(false);

    try {
      const docContent = lesson?.extracted_content || '';
      
      // Use pollyChat function - single source of truth
      const { data: response } = await base44.functions.invoke('pollyChat', {
        messages: [...messages, { role: 'user', content: messageToSend }],
        lessonContext: lesson,
        documentContent: docContent
      });

      setMessages((prev) => [...prev, {
        role: "assistant",
        content: response.reply || "I'm sorry, I couldn't generate a response. Please try again."
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

  const quickActions = [
    { label: "Explain like I'm 5", icon: Lightbulb, prompt: "Explain this material like I'm 5 years old - super simple!" },
    { label: "Give me an example", icon: FileText, prompt: "Give me a real-world example of the main concept" },
    { label: "Why is this important?", icon: HelpCircle, prompt: "Why is this material important? When would I use it?" },
    { label: "Quiz Me", icon: List, prompt: "Quiz me with 3 questions on this material" },
    { label: "🔮 Grade Prediction", icon: Sparkles, prompt: "What's my current predicted grade and what should I focus on to improve?" },
  ];

  const hasDocument = lesson?.extracted_content || lesson?.file_url;

  return (
    <div className="flex-1 bg-white rounded-xl shadow-xl border-2 border-purple-200 flex flex-col overflow-hidden" style={{ height: '100%' }}>
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-purple-700 rounded-t-xl px-4 py-3 flex items-center gap-3 shadow-lg flex-shrink-0">
        <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
          <Sparkles className="w-4 h-4 text-white" />
        </div>
        <div>
          <h3 className="font-bold text-white text-sm">Polly</h3>
          <p className="text-xs text-white/80">Your AI study buddy</p>
        </div>
      </div>

      {/* Quick Actions - Always visible above input as pills */}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5 bg-gradient-to-b from-purple-50/30 to-white">
        {messages.map((msg, idx) => (
          <motion.div
            key={idx}
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.2 }}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-3 py-2 ${
                msg.role === 'user'
                  ? 'bg-gradient-to-br from-purple-600 to-purple-700 text-white shadow-md'
                  : 'bg-white text-slate-900 shadow-sm border border-slate-200'
              }`}
            >
              {msg.role === 'assistant' ? (
                <ReactMarkdown className="text-xs leading-relaxed prose prose-xs max-w-none [&>p]:my-0.5 [&>ul]:my-1 [&>ul]:ml-3 [&>ol]:my-1 [&>ol]:ml-3 [&>li]:my-0.5">
                  {msg.content}
                </ReactMarkdown>
              ) : (
                <p className="text-xs leading-relaxed">{msg.content}</p>
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

      {/* Input with Quick Action Pills */}
      <div className="p-3 bg-white border-t border-slate-200 rounded-b-xl flex-shrink-0 space-y-2">
        {/* Quick Actions Pills - Always visible */}
        {hasDocument && (
          <div className="flex flex-wrap gap-1.5">
            {quickActions.map((action) => (
              <button
                key={action.label}
                onClick={() => handleSend(action.prompt)}
                disabled={isLoading}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-purple-50 border border-purple-200 hover:bg-purple-100 hover:border-purple-300 transition-all text-[10px] font-medium text-purple-700 whitespace-nowrap"
              >
                <action.icon className="w-3 h-3" />
                {action.label}
              </button>
            ))}
          </div>
        )}
        
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
            placeholder={hasDocument ? "Ask about your document..." : "Ask me anything..."}
            disabled={isLoading}
            className="flex-1 border-slate-200 focus-visible:ring-purple-500 text-xs rounded-xl h-9"
          />
          <Button
            onClick={() => handleSend()}
            disabled={isLoading || !input.trim()}
            size="icon"
            className="bg-gradient-to-br from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 rounded-xl shadow-md h-9 w-9"
          >
            <Send className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}