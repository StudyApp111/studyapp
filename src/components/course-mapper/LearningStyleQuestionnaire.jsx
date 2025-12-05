import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { ArrowRight, Check, ChevronLeft, BookOpen, Brain, Clock, Target, Calculator, FlaskConical, PenTool, Code, BarChart } from "lucide-react";

const questions = {
  general: [
    {
      id: "q1",
      text: "When you study, which approach feels most natural?",
      subtext: "Choose up to 2",
      type: "multiselect",
      maxSelect: 2,
      options: [
        "I start by looking at examples",
        "I start by reading explanations",
        "I need to try doing it myself quickly",
        "I break things down into steps",
        "I look for the big idea/theme first",
        "I rely on intuition unless I get stuck"
      ]
    },
    {
      id: "q2",
      text: "What usually causes you to lose marks?",
      subtext: "Choose 1–2",
      type: "multiselect",
      maxSelect: 2,
      options: [
        "Misreading questions",
        "Rushing and making small mistakes",
        "Not knowing how to start",
        "Running out of time",
        "Forgetting information",
        "Not fully understanding underlying ideas"
      ]
    },
    {
      id: "q3",
      text: "How do you respond when you’re stuck?",
      type: "single",
      options: [
        "I guess and move on",
        "I search for a similar example",
        "I reread the question",
        "I break it into smaller parts",
        "I freeze until I figure it out"
      ]
    },
    {
      id: "q4",
      text: "How confident are you about succeeding in this course?",
      type: "scale",
      min: 1,
      max: 5,
      labels: { 1: "Not confident", 5: "Very confident" }
    },
    {
      id: "q5",
      text: "What’s your biggest challenge when learning something new?",
      type: "single",
      options: [
        "Understanding the concept",
        "Applying it to real problems",
        "Remembering it later",
        "Explaining it to someone",
        "Staying focused",
        "Knowing whether I really “get it”"
      ]
    }
  ],
  "Written & Interpretive Subjects (Humanities / Social Sciences)": [
    {
      id: "h1",
      text: "What slows you down most when writing essays?",
      type: "single",
      options: [
        "Formulating a thesis",
        "Organizing arguments",
        "Integrating readings/evidence",
        "Writing clearly",
        "Time pressure"
      ]
    },
    {
      id: "h2",
      text: "How do you usually read assigned texts?",
      type: "single",
      options: [
        "I skim for the main idea",
        "I annotate actively",
        "I read slowly and thoroughly",
        "I rely on summaries or class lectures"
      ]
    }
  ],
  "Problem-Solving & Conceptual Subjects (Math / Physics / Engineering)": [
    {
      id: "m1",
      text: "What usually causes errors in problem-solving?",
      type: "single",
      options: [
        "Forgetting a rule/formula",
        "Algebraic manipulation mistakes",
        "Not understanding what the question wants",
        "Setting up the problem incorrectly",
        "Misinterpreting diagrams/graphs"
      ]
    },
    {
      id: "m2",
      text: "Which part of a multi-step problem is hardest?",
      type: "single",
      options: [
        "The first step",
        "Keeping track of steps",
        "Applying the right concept",
        "Checking work",
        "Interpreting the final answer"
      ]
    }
  ],
  "Applied & Empirical Subjects (Biology / Chemistry / Earth Sciences / Health Sciences)": [
    {
      id: "s1",
      text: "What part of scientific learning do you struggle with?",
      type: "single",
      options: [
        "Memorizing terminology",
        "Understanding processes/mechanisms",
        "Interpreting experiments",
        "Applying concepts to new scenarios",
        "Data/graph interpretation"
      ]
    },
    {
      id: "s2",
      text: "When reviewing scientific material, what helps most?",
      type: "single",
      options: [
        "Diagrams/visuals",
        "Practice questions",
        "Flashcards",
        "Reading explanations",
        "Teaching it to someone else"
      ]
    }
  ],
  "Computational & Logical Subjects (Computer Science / Programming / Data Structures)": [
    {
      id: "c1",
      text: "When debugging, what describes you best?",
      type: "single",
      options: [
        "I tweak code until it works",
        "I trace the logic step-by-step",
        "I Google error messages",
        "I rewrite from scratch",
        "I compare to working examples"
      ]
    },
    {
      id: "c2",
      text: "What’s your biggest challenge in CS?",
      type: "single",
      options: [
        "Thinking in algorithms",
        "Translating ideas into code",
        "Understanding abstract concepts (recursion, pointers)",
        "Managing complexity in bigger programs",
        "Time constraints"
      ]
    }
  ],
  "Quantitative Applied Subjects (Statistics / Economics / Finance / Business Analytics)": [
    {
      id: "qas1",
      text: "Which part of quantitative reasoning challenges you most?",
      type: "single",
      options: [
        "Understanding model assumptions",
        "Interpreting graphs/tables",
        "Applying formulas correctly",
        "Explaining results",
        "Connecting theory to real-world cases"
      ]
    },
    {
      id: "qas2",
      text: "How comfortable are you with numerical problem-solving?",
      type: "single",
      options: [
        "Very",
        "Moderate",
        "Slight discomfort",
        "High discomfort"
      ]
    }
  ],
  universal: [
    {
      id: "q8",
      text: "What is your target grade and how many hours/week can you commit?",
      type: "structured",
      fields: [
        { name: "target_grade", label: "Target Grade", type: "select", options: ["A", "B", "C"] },
        { name: "weekly_hours", label: "Weekly Hours", type: "number" },
        { name: "weeks_until_exam", label: "Weeks Until Exam", type: "number" }
      ]
    }
  ]
};

const getSubjectIcon = (subject) => {
  if (subject?.includes("Humanities")) return PenTool;
  if (subject?.includes("Math")) return Calculator;
  if (subject?.includes("Biology")) return FlaskConical;
  if (subject?.includes("Computer")) return Code;
  if (subject?.includes("Statistics")) return BarChart;
  return BookOpen;
};

export default function LearningStyleQuestionnaire({ subjectCategory, onComplete }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState({});
  
  const subjectQuestions = questions[subjectCategory] || questions["Written & Interpretive Subjects (Humanities / Social Sciences)"];
  const allQuestions = [...questions.general, ...subjectQuestions, ...questions.universal];
  
  const currentQ = allQuestions[currentStep];
  const SubjectIcon = getSubjectIcon(subjectCategory);

  const handleAnswer = (value) => {
    setAnswers(prev => ({ ...prev, [currentQ.id]: value }));
  };

  const handleMultiSelect = (value) => {
    setAnswers(prev => {
      const current = prev[currentQ.id] || [];
      if (current.includes(value)) {
        return { ...prev, [currentQ.id]: current.filter(v => v !== value) };
      }
      if (current.length >= currentQ.maxSelect) {
        return prev;
      }
      return { ...prev, [currentQ.id]: [...current, value] };
    });
  };

  const handleStructuredChange = (field, value) => {
    setAnswers(prev => ({
      ...prev,
      [currentQ.id]: {
        ...(prev[currentQ.id] || {}),
        [field]: value
      }
    }));
  };

  const canProceed = () => {
    const ans = answers[currentQ.id];
    if (currentQ.type === "multiselect") return ans && ans.length > 0;
    if (currentQ.type === "structured") return ans && ans.target_grade && ans.weekly_hours && ans.weeks_until_exam;
    return ans !== undefined && ans !== null && ans !== "";
  };

  const handleNext = () => {
    if (currentStep < allQuestions.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      onComplete(answers);
    }
  };

  const progress = ((currentStep + 1) / allQuestions.length) * 100;

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="mb-8 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-purple-100 mb-4">
          <SubjectIcon className="w-8 h-8 text-purple-600" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900">Learning Style Profile</h2>
        <p className="text-slate-500">Help us personalize your study plan</p>
      </div>

      <div className="mb-6">
        <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
          <motion.div 
            className="h-full bg-purple-600"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
        <div className="flex justify-between mt-2 text-xs text-slate-400 font-medium uppercase tracking-wider">
          <span>Question {currentStep + 1} of {allQuestions.length}</span>
          <span>{Math.round(progress)}% Complete</span>
        </div>
      </div>

      <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm overflow-hidden">
        <CardContent className="p-6 md:p-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentQ.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              <div className="mb-6">
                <h3 className="text-xl font-semibold text-slate-800 mb-2">{currentQ.text}</h3>
                {currentQ.subtext && (
                  <p className="text-sm text-slate-500 font-medium bg-slate-50 inline-block px-3 py-1 rounded-full">
                    {currentQ.subtext}
                  </p>
                )}
              </div>

              <div className="space-y-4">
                {currentQ.type === "single" && (
                  <RadioGroup 
                    value={answers[currentQ.id]} 
                    onValueChange={handleAnswer}
                    className="space-y-3"
                  >
                    {currentQ.options.map((opt) => (
                      <div key={opt} className={`
                        flex items-center space-x-3 p-4 rounded-xl border-2 cursor-pointer transition-all
                        ${answers[currentQ.id] === opt 
                          ? 'border-purple-600 bg-purple-50 shadow-sm' 
                          : 'border-slate-200 hover:border-purple-200 hover:bg-slate-50'}
                      `}>
                        <RadioGroupItem value={opt} id={opt} />
                        <Label htmlFor={opt} className="flex-1 cursor-pointer font-medium text-slate-700">
                          {opt}
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                )}

                {currentQ.type === "multiselect" && (
                  <div className="space-y-3">
                    {currentQ.options.map((opt) => {
                      const isSelected = (answers[currentQ.id] || []).includes(opt);
                      return (
                        <div 
                          key={opt}
                          onClick={() => handleMultiSelect(opt)}
                          className={`
                            flex items-center space-x-3 p-4 rounded-xl border-2 cursor-pointer transition-all select-none
                            ${isSelected 
                              ? 'border-purple-600 bg-purple-50 shadow-sm' 
                              : 'border-slate-200 hover:border-purple-200 hover:bg-slate-50'}
                          `}
                        >
                          <div className={`
                            w-5 h-5 rounded border flex items-center justify-center transition-colors
                            ${isSelected ? 'bg-purple-600 border-purple-600' : 'border-slate-400 bg-white'}
                          `}>
                            {isSelected && <Check className="w-3 h-3 text-white" />}
                          </div>
                          <span className="flex-1 font-medium text-slate-700">{opt}</span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {currentQ.type === "scale" && (
                  <div className="py-8 px-4">
                    <Slider
                      value={[answers[currentQ.id] || 3]}
                      min={currentQ.min}
                      max={currentQ.max}
                      step={1}
                      onValueChange={([val]) => handleAnswer(val)}
                      className="mb-8"
                    />
                    <div className="flex justify-between text-sm font-medium text-slate-600">
                      <span>{currentQ.labels[currentQ.min]}</span>
                      <span className="text-2xl font-bold text-purple-600 bg-purple-50 w-12 h-12 rounded-full flex items-center justify-center -mt-6 shadow-sm">
                        {answers[currentQ.id] || 3}
                      </span>
                      <span>{currentQ.labels[currentQ.max]}</span>
                    </div>
                  </div>
                )}

                {currentQ.type === "structured" && (
                  <div className="grid gap-6 md:grid-cols-2">
                    {currentQ.fields.map((field) => (
                      <div key={field.name} className="space-y-2">
                        <Label className="text-sm font-semibold text-slate-700 uppercase tracking-wide">
                          {field.label}
                        </Label>
                        {field.type === "select" ? (
                          <Select 
                            value={(answers[currentQ.id] || {})[field.name]} 
                            onValueChange={(val) => handleStructuredChange(field.name, val)}
                          >
                            <SelectTrigger className="h-12">
                              <SelectValue placeholder="Select..." />
                            </SelectTrigger>
                            <SelectContent>
                              {field.options.map(opt => (
                                <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <div className="relative">
                            <Input
                              type="number"
                              className="h-12 pl-4"
                              value={(answers[currentQ.id] || {})[field.name] || ""}
                              onChange={(e) => handleStructuredChange(field.name, e.target.value)}
                              placeholder="0"
                            />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex justify-between items-center mt-8 pt-6 border-t border-slate-100">
                <Button
                  variant="ghost"
                  onClick={() => setCurrentStep(prev => prev - 1)}
                  disabled={currentStep === 0}
                  className="text-slate-500 hover:text-slate-900"
                >
                  <ChevronLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>
                <Button
                  onClick={handleNext}
                  disabled={!canProceed()}
                  className="bg-purple-600 hover:bg-purple-700 text-white px-8 h-12 text-lg shadow-lg shadow-purple-500/30"
                >
                  {currentStep === allQuestions.length - 1 ? 'Complete Profile' : 'Next'}
                  {currentStep !== allQuestions.length - 1 && <ArrowRight className="w-5 h-5 ml-2" />}
                </Button>
              </div>
            </motion.div>
          </AnimatePresence>
        </CardContent>
      </Card>
    </div>
  );
}