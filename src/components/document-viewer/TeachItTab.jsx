import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Lightbulb, CheckCircle2, AlertCircle, Sparkles, RefreshCw } from "lucide-react";
import EducationalLoader from "@/components/ui/EducationalLoader";
import { awardDailyXP } from "@/components/utils/dailyReset";
import XPGainToast from "@/components/gamification/XPGainToast";

export default function TeachItTab({ lesson }) {
  const [cards, setCards] = useState([]);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [userAnswer, setUserAnswer] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGrading, setIsGrading] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [xpToast, setXpToast] = useState({ show: false, xp: 0, reason: '' });

  useEffect(() => {
    if (lesson?.id) {
      loadCards();
    }
  }, [lesson?.id]);

  const loadCards = async () => {
    try {
      const existingCards = await base44.entities.TeachItCard.filter({ 
        lesson_id: lesson.id 
      });
      
      if (existingCards?.length > 0) {
        setCards(existingCards);
        // Find first incomplete card
        const incompleteIndex = existingCards.findIndex(c => !c.completed);
        setCurrentCardIndex(incompleteIndex >= 0 ? incompleteIndex : 0);
      } else {
        await generateCards();
      }
    } catch (error) {
      console.error("Error loading cards:", error);
    }
  };

  const generateCards = async () => {
    setIsGenerating(true);
    try {
      const user = await base44.auth.me();
      const profile = await base44.entities.LearningProfile.filter({ 
        id: user.learning_profile_id 
      });
      const learningProfile = profile[0] || {};

      let contentDescription = "";
      if (lesson.input_type === "description" && lesson.description) {
        contentDescription = lesson.description;
      } else if (lesson.compressed_content) {
        contentDescription = lesson.compressed_content;
      } else if (lesson.extracted_content) {
        contentDescription = lesson.extracted_content;
      } else {
        contentDescription = lesson.description || "N/A";
      }

      const prompt = `You are an expert educator creating "Teach It" cards for ${lesson.course_name}.

CONTEXT:
Student Grade: ${learningProfile.grade || "N/A"}
Course: ${lesson.course_name}
School: ${learningProfile.school || "N/A"}

ACTUAL LESSON CONTENT (Read Carefully):
${contentDescription}

CRITICAL INSTRUCTION:
Extract 5 SPECIFIC concepts, theories, formulas, or processes that are EXPLICITLY MENTIONED in the content above. Do NOT create generic "why study this subject" questions.

OBJECTIVE:
Generate 5 cards testing deep understanding of SPECIFIC content concepts. Each card must:
1. Reference a CONCRETE concept/topic that appears in the lesson content
2. Ask students to explain it in their own words (HOW it works, WHAT it means, WHY it matters)
3. Be directly answerable using information from the provided content
4. Test understanding, not memorization of definitions

QUESTION PATTERNS (adapt to actual content):
- "Explain how [specific process from content] works."
- "What is [specific concept from content] and how does it relate to [another concept]?"
- "Describe the steps involved in [specific method from content]."
- "Why is [specific principle from content] important? Explain with an example."
- "How would you explain [specific theory/formula from content] to someone unfamiliar with it?"

STRICT RULES:
- ONLY use concepts that are EXPLICITLY in the content
- NO generic questions about the subject in general
- Each card = different specific concept from the material
- Model answers: 3-5 sentences, explain the concept clearly using content details
- Avoid meta questions like "why do we study X" or "what problem does analyzing X solve"

OUTPUT:
Return exactly 5 cards with question and model_answer fields.`;

      const { data: cardsData } = await base44.functions.invoke('generateTeachItCards', {
        prompt,
        response_json_schema: {
          type: "object",
          properties: {
            cards: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  question: { type: "string" },
                  model_answer: { type: "string" }
                }
              }
            }
          }
        }
      });

      const generatedCards = cardsData?.cards || [];
      if (generatedCards.length === 0) {
        throw new Error("No cards generated");
      }

      const savedCards = await Promise.all(
        generatedCards.map(card =>
          base44.entities.TeachItCard.create({
            lesson_id: lesson.id,
            question: card.question,
            model_answer: card.model_answer,
            completed: false
          })
        )
      );

      setCards(savedCards);
      setCurrentCardIndex(0);
    } catch (error) {
      console.error("Error generating cards:", error);
      alert("Failed to generate cards. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  const gradeAnswer = async () => {
    if (!userAnswer.trim()) return;

    setIsGrading(true);
    try {
      const currentCard = cards[currentCardIndex];

      const prompt = `You are grading a student's explanation of a concept.

QUESTION:
${currentCard.question}

MODEL ANSWER:
${currentCard.model_answer}

STUDENT'S ANSWER:
${userAnswer}

GRADING CRITERIA:
1. Conceptual Understanding (40%): Does the student grasp the core concept?
2. Explanation Quality (30%): Is it clear and well-articulated?
3. Completeness (30%): Did they cover the key points?

SCORING:
- 90-100: Excellent - Deep understanding, clear explanation, all key points covered
- 75-89: Good - Solid understanding, mostly clear, covered most points
- 60-74: Fair - Basic understanding, some gaps or unclear explanations
- Below 60: Needs improvement - Missing key concepts or significant misunderstandings

OUTPUT:
Return a score (0-100), feedback (2-3 sentences), strengths array (what they did well), and gaps array (what they missed or misunderstood).`;

      const { data: gradingResult } = await base44.functions.invoke('gradeTeachItAnswer', {
        prompt,
        response_json_schema: {
          type: "object",
          properties: {
            score: { type: "number" },
            feedback: { type: "string" },
            strengths: { type: "array", items: { type: "string" } },
            gaps: { type: "array", items: { type: "string" } }
          }
        }
      });

      const updatedCard = await base44.entities.TeachItCard.update(currentCard.id, {
        user_answer: userAnswer,
        score: gradingResult.score,
        feedback: gradingResult.feedback,
        strengths: gradingResult.strengths,
        gaps: gradingResult.gaps,
        completed: true
      });

      const updatedCards = [...cards];
      updatedCards[currentCardIndex] = updatedCard;
      setCards(updatedCards);
      setShowFeedback(true);

      // Award XP
      const xpAmount = gradingResult.score >= 90 ? 20 : gradingResult.score >= 75 ? 15 : 10;
      await awardDailyXP(xpAmount, "Taught a concept!");
      setXpToast({ show: true, xp: xpAmount, reason: "Taught a concept!" });
    } catch (error) {
      console.error("Error grading answer:", error);
      alert("Failed to grade answer. Please try again.");
    } finally {
      setIsGrading(false);
    }
  };

  const handleNext = () => {
    if (currentCardIndex < cards.length - 1) {
      setCurrentCardIndex(currentCardIndex + 1);
      setUserAnswer(cards[currentCardIndex + 1].user_answer || "");
      setShowFeedback(cards[currentCardIndex + 1].completed);
    }
  };

  const handlePrevious = () => {
    if (currentCardIndex > 0) {
      setCurrentCardIndex(currentCardIndex - 1);
      setUserAnswer(cards[currentCardIndex - 1].user_answer || "");
      setShowFeedback(cards[currentCardIndex - 1].completed);
    }
  };

  const handleRegenerate = async () => {
    if (confirm("Regenerate all cards? Current progress will be lost.")) {
      try {
        await Promise.all(cards.map(card => base44.entities.TeachItCard.delete(card.id)));
        setCards([]);
        setCurrentCardIndex(0);
        setUserAnswer("");
        setShowFeedback(false);
        await generateCards();
      } catch (error) {
        console.error("Error regenerating cards:", error);
      }
    }
  };

  if (isGenerating) {
    return (
      <EducationalLoader
        title="Creating Teach It Cards"
        description="Generating foundational concept questions based on your material..."
      />
    );
  }

  if (cards.length === 0) {
    return (
      <div className="h-full flex items-center justify-center p-4 bg-gradient-to-br from-purple-50 via-pink-50/30 to-purple-100/40">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
        >
          <Card className="bg-white/95 backdrop-blur-xl border-2 border-purple-200 shadow-2xl overflow-hidden max-w-md">
            <div className="bg-gradient-to-r from-purple-600 via-purple-700 to-pink-600 px-6 py-8 text-center">
              <motion.div
                animate={{ rotate: [0, -10, 10, -10, 0] }}
                transition={{ duration: 0.6, delay: 0.2 }}
              >
                <Lightbulb className="w-20 h-20 text-yellow-300 mx-auto mb-4 drop-shadow-lg" />
              </motion.div>
              <h3 className="text-2xl md:text-3xl font-black text-white mb-2">Teach It to Master It</h3>
              <p className="text-purple-100 text-sm">
                The best way to learn is to teach
              </p>
            </div>
            <div className="p-6 text-center">
              <p className="text-slate-600 mb-6 leading-relaxed">
                Explain concepts in your own words and get instant AI feedback on your understanding.
              </p>
              <Button
                onClick={generateCards}
                className="w-full h-14 bg-gradient-to-r from-purple-600 via-purple-700 to-pink-600 hover:from-purple-700 hover:via-purple-800 hover:to-pink-700 text-white font-bold text-lg rounded-xl shadow-xl"
              >
                <Sparkles className="w-5 h-5 mr-2" />
                Generate 5 Cards
              </Button>
            </div>
          </Card>
        </motion.div>
      </div>
    );
  }

  const currentCard = cards[currentCardIndex];
  const progress = ((currentCardIndex + 1) / cards.length) * 100;
  const completedCount = cards.filter(c => c.completed).length;

  return (
    <>
      <XPGainToast
        xpGained={xpToast.xp}
        reason={xpToast.reason}
        show={xpToast.show}
        onComplete={() => setXpToast({ show: false, xp: 0, reason: '' })}
      />

      <div className="h-full flex flex-col bg-gradient-to-br from-purple-50 via-pink-50/30 to-purple-100/40 md:rounded-2xl overflow-hidden">
        {/* Mobile-optimized sticky header */}
        <div className="flex-shrink-0 bg-gradient-to-r from-purple-600 via-purple-700 to-pink-600 px-3 py-3 md:px-6 md:py-4 sticky top-0 z-10 shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 md:w-12 md:h-12 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center">
                <Lightbulb className="w-5 h-5 md:w-6 md:h-6 text-yellow-300" />
              </div>
              <div>
                <h2 className="text-lg md:text-2xl font-bold text-white">Teach It</h2>
                <p className="text-xs text-purple-100">
                  {currentCardIndex + 1}/{cards.length} • {completedCount} ✓
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRegenerate}
              className="gap-1.5 bg-white/10 hover:bg-white/20 text-white border-white/20 h-8 px-3"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span className="hidden md:inline text-xs">New</span>
            </Button>
          </div>

          {/* Progress Bar */}
          <div className="h-1.5 bg-white/20 rounded-full overflow-hidden backdrop-blur-sm">
            <motion.div
              className="h-full bg-gradient-to-r from-yellow-400 via-pink-400 to-yellow-300 shadow-lg"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.3, ease: "easeOut" }}
            />
          </div>
        </div>

        {/* Scrollable content area */}
        <div className="flex-1 overflow-y-auto overscroll-contain">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentCardIndex}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.25 }}
              className="h-full flex items-center px-3 py-4 md:px-6"
            >
              <div className="w-full max-w-2xl mx-auto"
            >
              <Card className="bg-white/95 backdrop-blur-xl border-2 border-purple-200/50 shadow-2xl overflow-hidden">
                {/* Card header with gradient */}
                <div className="bg-gradient-to-r from-purple-500 to-pink-500 px-4 py-4 md:px-6 md:py-5">
                  <Badge className="mb-2 bg-white/20 text-white border-white/30 backdrop-blur-sm text-xs">
                    <Sparkles className="w-3 h-3 mr-1" />
                    Explain This Concept
                  </Badge>
                  <h3 className="text-lg md:text-xl font-bold text-white leading-relaxed">
                    {currentCard.question}
                  </h3>
                </div>

                <div className="p-4 md:p-6">
                  {!showFeedback ? (
                    <>
                      <Textarea
                        value={userAnswer}
                        onChange={(e) => setUserAnswer(e.target.value)}
                        placeholder="Type your explanation here... (3-5 sentences)"
                        className="min-h-[220px] md:min-h-[200px] mb-4 text-sm md:text-base border-2 border-purple-200 focus:border-purple-400 rounded-xl resize-none"
                        disabled={isGrading}
                      />
                      <Button
                        onClick={gradeAnswer}
                        disabled={!userAnswer.trim() || isGrading}
                        className="w-full h-12 md:h-14 bg-gradient-to-r from-purple-600 via-purple-700 to-pink-600 hover:from-purple-700 hover:via-purple-800 hover:to-pink-700 text-white font-semibold rounded-xl shadow-lg text-base md:text-lg"
                      >
                        {isGrading ? (
                          <>
                            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                            Grading Your Answer...
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="w-5 h-5 mr-2" />
                            Submit Answer
                          </>
                        )}
                      </Button>
                    </>
                  ) : (
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.2 }}
                      className="space-y-4"
                    >
                      {/* Score Badge */}
                      <motion.div 
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: "spring", delay: 0.3 }}
                        className="flex items-center justify-center"
                      >
                        <div className={`px-8 py-4 rounded-2xl ${
                          currentCard.score >= 90 ? 'bg-gradient-to-r from-emerald-500 to-green-600' :
                          currentCard.score >= 75 ? 'bg-gradient-to-r from-purple-500 to-indigo-600' :
                          currentCard.score >= 60 ? 'bg-gradient-to-r from-yellow-500 to-orange-600' :
                          'bg-gradient-to-r from-red-500 to-pink-600'
                        } shadow-2xl`}>
                          <p className="text-white/80 text-xs font-medium mb-1 text-center">Your Score</p>
                          <p className="text-white text-4xl font-black text-center">{currentCard.score}<span className="text-2xl">/100</span></p>
                        </div>
                      </motion.div>

                      {/* Your Answer */}
                      <div className="bg-purple-50/50 border-2 border-purple-200/50 rounded-xl p-4">
                        <h4 className="font-bold text-purple-900 mb-2 flex items-center gap-2 text-sm">
                          <NotebookPen className="w-4 h-4" />
                          Your Answer
                        </h4>
                        <p className="text-slate-700 text-sm leading-relaxed">{currentCard.user_answer}</p>
                      </div>

                      {/* Feedback */}
                      <div className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 border-2 border-purple-300/50 rounded-xl p-4">
                        <h4 className="font-bold text-purple-900 mb-2 text-sm">💡 AI Feedback</h4>
                        <p className="text-slate-700 text-sm leading-relaxed">{currentCard.feedback}</p>
                      </div>

                      {/* Strengths */}
                      {currentCard.strengths?.length > 0 && (
                        <div className="bg-emerald-50/50 border-2 border-emerald-200/50 rounded-xl p-4">
                          <h4 className="font-bold text-emerald-900 mb-2 flex items-center gap-2 text-sm">
                            <CheckCircle2 className="w-4 h-4" />
                            What You Did Well
                          </h4>
                          <ul className="space-y-2">
                            {currentCard.strengths.map((strength, idx) => (
                              <motion.li 
                                key={idx}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.5 + idx * 0.1 }}
                                className="flex items-start gap-2 text-slate-700 text-sm"
                              >
                                <span className="text-emerald-600 font-bold">✓</span>
                                <span>{strength}</span>
                              </motion.li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Gaps */}
                      {currentCard.gaps?.length > 0 && (
                        <div className="bg-amber-50/50 border-2 border-amber-200/50 rounded-xl p-4">
                          <h4 className="font-bold text-amber-900 mb-2 flex items-center gap-2 text-sm">
                            <AlertCircle className="w-4 h-4" />
                            Areas to Review
                          </h4>
                          <ul className="space-y-2">
                            {currentCard.gaps.map((gap, idx) => (
                              <motion.li 
                                key={idx}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.6 + idx * 0.1 }}
                                className="flex items-start gap-2 text-slate-700 text-sm"
                              >
                                <span className="text-amber-600 font-bold">→</span>
                                <span>{gap}</span>
                              </motion.li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Model Answer */}
                      <div className="bg-gradient-to-br from-indigo-50 to-purple-50 border-2 border-indigo-200/50 rounded-xl p-4">
                        <h4 className="font-bold text-indigo-900 mb-2 text-sm">🎯 Model Answer</h4>
                        <p className="text-slate-700 text-sm leading-relaxed">{currentCard.model_answer}</p>
                      </div>
                    </motion.div>
                  )}
                </div>
              </Card>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Fixed navigation footer */}
        <div className="flex-shrink-0 bg-white/95 backdrop-blur-xl border-t border-purple-200 px-3 py-3 md:px-6 md:py-4 sticky bottom-0">
          <div className="flex gap-2 md:gap-3 max-w-2xl mx-auto">
            <Button
              variant="outline"
              onClick={handlePrevious}
              disabled={currentCardIndex === 0}
              className="flex-1 h-12 rounded-xl border-2 border-purple-300 hover:bg-purple-50 disabled:opacity-30 font-semibold"
            >
              Previous
            </Button>
            <Button
              onClick={handleNext}
              disabled={currentCardIndex === cards.length - 1}
              className="flex-1 h-12 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-xl shadow-lg disabled:opacity-30 font-semibold"
            >
              Next Card
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}