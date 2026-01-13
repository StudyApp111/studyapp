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

Content Summary:
${contentDescription}

OBJECTIVE:
Generate 5 foundational concept cards that test deep understanding through explanation. Each card should:
1. Ask the student to EXPLAIN a core concept in their own words
2. Focus on WHY/HOW rather than memorization
3. Cover different foundational concepts from the material
4. Be answerable in 3-5 sentences

CARD TYPES (mix these):
- "Explain in your own words: What is [concept] and why is it important?"
- "How would you teach [concept] to someone who has never heard of it?"
- "What's the relationship between [concept A] and [concept B]?"
- "Why does [phenomenon] happen? Explain the underlying mechanism."
- "What problem does [concept/method] solve and how does it work?"

RULES:
- Questions must be foundational (not trivial facts)
- Each card should test a DIFFERENT concept
- Model answers should be clear, 3-5 sentences, explaining the concept thoroughly
- Use everyday language, not jargon-heavy

OUTPUT:
Return exactly 5 cards. Each with question and model_answer fields.`;

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
      <div className="p-4">
        <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200 p-6 text-center">
          <Lightbulb className="w-16 h-16 text-blue-600 mx-auto mb-4" />
          <h3 className="text-2xl font-bold text-slate-900 mb-2">Teach It to Master It</h3>
          <p className="text-slate-600 mb-6 max-w-md mx-auto">
            The best way to learn is to teach. Explain concepts in your own words and get instant feedback.
          </p>
          <Button
            onClick={generateCards}
            className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
          >
            <Sparkles className="w-4 h-4 mr-2" />
            Generate Cards
          </Button>
        </Card>
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

      <div className="p-4 max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Lightbulb className="w-7 h-7 text-yellow-500" />
              Teach It
            </h2>
            <p className="text-sm text-slate-600">
              Card {currentCardIndex + 1} of {cards.length} • {completedCount} completed
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRegenerate}
            className="gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            New Cards
          </Button>
        </div>

        {/* Progress Bar */}
        <div className="h-2 bg-slate-200 rounded-full mb-6 overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-blue-600 to-indigo-600"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>

        {/* Card */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentCardIndex}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
          >
            <Card className="bg-white border-slate-200 p-6 mb-4">
              <div className="mb-6">
                <Badge className="mb-3 bg-blue-100 text-blue-700">Explain This Concept</Badge>
                <h3 className="text-xl font-semibold text-slate-900 leading-relaxed">
                  {currentCard.question}
                </h3>
              </div>

              {!showFeedback ? (
                <>
                  <Textarea
                    value={userAnswer}
                    onChange={(e) => setUserAnswer(e.target.value)}
                    placeholder="Type your explanation here... (3-5 sentences)"
                    className="min-h-[200px] mb-4 text-base"
                    disabled={isGrading}
                  />
                  <Button
                    onClick={gradeAnswer}
                    disabled={!userAnswer.trim() || isGrading}
                    className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
                  >
                    {isGrading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Grading...
                      </>
                    ) : (
                      "Submit Answer"
                    )}
                  </Button>
                </>
              ) : (
                <div className="space-y-4">
                  {/* Score */}
                  <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                    <span className="font-semibold text-slate-700">Your Score</span>
                    <Badge className={`text-lg px-4 py-1 ${
                      currentCard.score >= 90 ? 'bg-emerald-600' :
                      currentCard.score >= 75 ? 'bg-blue-600' :
                      currentCard.score >= 60 ? 'bg-yellow-600' :
                      'bg-red-600'
                    } text-white`}>
                      {currentCard.score}/100
                    </Badge>
                  </div>

                  {/* Your Answer */}
                  <div>
                    <h4 className="font-semibold text-slate-700 mb-2">Your Answer:</h4>
                    <div className="p-3 bg-slate-50 rounded-lg text-slate-700">
                      {currentCard.user_answer}
                    </div>
                  </div>

                  {/* Feedback */}
                  <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <h4 className="font-semibold text-blue-900 mb-2">Feedback</h4>
                    <p className="text-slate-700">{currentCard.feedback}</p>
                  </div>

                  {/* Strengths */}
                  {currentCard.strengths?.length > 0 && (
                    <div>
                      <h4 className="font-semibold text-slate-700 mb-2 flex items-center gap-2">
                        <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                        What You Did Well:
                      </h4>
                      <ul className="space-y-1">
                        {currentCard.strengths.map((strength, idx) => (
                          <li key={idx} className="flex items-start gap-2 text-slate-700">
                            <span className="text-emerald-600 mt-0.5">•</span>
                            <span>{strength}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Gaps */}
                  {currentCard.gaps?.length > 0 && (
                    <div>
                      <h4 className="font-semibold text-slate-700 mb-2 flex items-center gap-2">
                        <AlertCircle className="w-5 h-5 text-amber-600" />
                        Areas to Review:
                      </h4>
                      <ul className="space-y-1">
                        {currentCard.gaps.map((gap, idx) => (
                          <li key={idx} className="flex items-start gap-2 text-slate-700">
                            <span className="text-amber-600 mt-0.5">•</span>
                            <span>{gap}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Model Answer */}
                  <div className="p-4 bg-indigo-50 rounded-lg border border-indigo-200">
                    <h4 className="font-semibold text-indigo-900 mb-2">Model Answer:</h4>
                    <p className="text-slate-700">{currentCard.model_answer}</p>
                  </div>
                </div>
              )}
            </Card>
          </motion.div>
        </AnimatePresence>

        {/* Navigation */}
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={handlePrevious}
            disabled={currentCardIndex === 0}
            className="flex-1"
          >
            Previous
          </Button>
          <Button
            onClick={handleNext}
            disabled={currentCardIndex === cards.length - 1}
            className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
          >
            Next Card
          </Button>
        </div>
      </div>
    </>
  );
}