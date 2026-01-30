import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { AlertCircle, ChevronRight, CheckCircle, Lightbulb, X } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import DiagnosticLoader from '@/components/onboarding/DiagnosticLoader';
import { motion, AnimatePresence } from 'framer-motion';
import MathText from '@/components/math/MathText';

export default function DiagnosticQuiz() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isLoading, setIsLoading] = useState(true);
  const [isGrading, setIsGrading] = useState(false);
  const [questions, setQuestions] = useState([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState({});
  const [answeredQuestions, setAnsweredQuestions] = useState({});
  const [error, setError] = useState('');
  const [params, setParams] = useState({});

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const school = searchParams.get('school');
    const courseCode = searchParams.get('courseCode');

    if (!school || !courseCode) {
      setError('Missing required information. Redirecting...');
      setTimeout(() => {
        navigate(createPageUrl("Onboarding"), { replace: true });
      }, 2000);
      setIsLoading(false);
      return;
    }

    setParams({ school, courseCode });
    generateQuestions(school, courseCode);
  }, [location.search, navigate]);

  const generateQuestions = async (school, courseCode) => {
    try {
      const result = await base44.functions.invoke('generateDiagnosticExam', {
        school,
        courseCode
      });

      if (result.data?.success && result.data?.questions) {
        setQuestions(result.data.questions);
      } else {
        throw new Error(result.data?.error || 'Failed to generate questions');
      }
    } catch (err) {
      console.error('Error generating quiz:', err);
      setError(`Failed to generate your quiz: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAnswerSelect = (answer) => {
    if (answeredQuestions[currentQuestionIndex]) return; // Lock after answering
    
    const question = questions[currentQuestionIndex];
    const isCorrect = answer === question.correct_answer;
    
    setUserAnswers(prev => ({
      ...prev,
      [currentQuestionIndex]: answer
    }));
    
    setAnsweredQuestions(prev => ({
      ...prev,
      [currentQuestionIndex]: { answer, isCorrect }
    }));
  };

  const handleNext = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    }
  };

  const handleSubmit = async () => {
    if (Object.keys(answeredQuestions).length !== questions.length) {
      setError('Please answer all questions before submitting.');
      return;
    }

    setIsGrading(true);
    setError('');

    try {
      const formattedAnswers = Object.entries(userAnswers).map(([index, answer]) => ({
        question_index: parseInt(index),
        answer
      }));

      const result = await base44.functions.invoke('gradeDiagnosticExam', {
        school: params.school,
        courseCode: params.courseCode,
        questions,
        userAnswers: formattedAnswers
      });

      if (result.data?.success) {
        const queryParams = new URLSearchParams({
          grade: result.data.predicted_grade,
          strongAreas: JSON.stringify(result.data.strong_areas || []),
          weakAreas: JSON.stringify(result.data.weak_areas || []),
          studyDays: result.data.estimated_study_time_days || '14',
          school: params.school,
          courseCode: params.courseCode
        });

        navigate(createPageUrl('PredictedGradeDisplay') + `?${queryParams.toString()}`, { replace: true });
      } else {
        throw new Error('Failed to grade exam');
      }
    } catch (err) {
      console.error('Error grading quiz:', err);
      setError(`Failed to grade your quiz: ${err.message}`);
      setIsGrading(false);
    }
  };

  // Full screen loaders without any navigation
  if (isLoading) {
    return <DiagnosticLoader mode="generating" />;
  }

  if (isGrading) {
    return <DiagnosticLoader mode="grading" />;
  }

  if (error && questions.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
        <Alert variant="destructive" className="max-w-md">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  const currentQuestion = questions[currentQuestionIndex];
  const isLastQuestion = currentQuestionIndex === questions.length - 1;
  const currentAnswerState = answeredQuestions[currentQuestionIndex];
  const isAnswered = !!currentAnswerState;
  const isCorrect = currentAnswerState?.isCorrect;

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 z-50 overflow-y-auto">
      <div className="min-h-screen flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-white/10">
          <div className="max-w-2xl mx-auto">
            <div className="text-center mb-4">
              <h1 className="text-xl md:text-2xl font-bold text-white">
                Diagnostic Quiz
              </h1>
              <p className="text-slate-400 text-sm">
                {params.courseCode} • {params.school}
              </p>
            </div>

            {/* Progress indicator */}
            <div className="flex items-center justify-center gap-2">
              {questions.map((_, idx) => (
                <div
                  key={idx}
                  className={`h-2 w-10 rounded-full transition-all ${
                    idx === currentQuestionIndex
                      ? 'bg-purple-500 scale-110'
                      : answeredQuestions[idx]
                      ? answeredQuestions[idx].isCorrect
                        ? 'bg-emerald-500'
                        : 'bg-red-400'
                      : 'bg-slate-700'
                  }`}
                />
              ))}
            </div>
            <p className="text-center text-slate-400 text-sm mt-2">
              Question {currentQuestionIndex + 1} of {questions.length}
            </p>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="px-4 pt-4">
            <Alert variant="destructive" className="max-w-2xl mx-auto">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          </div>
        )}

        {/* Question Card - Modal Style like ExamQuestion */}
        <div className="flex-1 flex items-center justify-center p-4">
          <AnimatePresence mode="wait">
            {currentQuestion && (
              <motion.div
                key={currentQuestionIndex}
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -20 }}
                transition={{ duration: 0.2 }}
                className="w-full max-w-2xl bg-slate-800/80 backdrop-blur-xl rounded-2xl border border-white/10 shadow-2xl overflow-hidden"
              >
                {/* Question Header */}
                <div className="p-6 border-b border-white/10">
                  <MathText className="text-lg md:text-xl font-semibold text-white leading-relaxed">
                    {currentQuestion.question_text}
                  </MathText>
                </div>

                {/* Options */}
                <div className="p-6 space-y-3">
                  <RadioGroup
                    value={userAnswers[currentQuestionIndex] || ''}
                    onValueChange={handleAnswerSelect}
                    className="space-y-3"
                  >
                    {currentQuestion.options.map((option, oIndex) => {
                      const optionLetter = String.fromCharCode(65 + oIndex);
                      const isSelected = userAnswers[currentQuestionIndex] === option;
                      const isThisCorrect = option === currentQuestion.correct_answer;
                      
                      let optionStyle = 'border-slate-600 bg-slate-700/30 hover:border-purple-500/50 hover:bg-purple-600/10';
                      
                      if (isAnswered) {
                        if (isThisCorrect) {
                          optionStyle = 'border-emerald-500 bg-emerald-500/20';
                        } else if (isSelected && !isThisCorrect) {
                          optionStyle = 'border-red-400 bg-red-500/20';
                        } else {
                          optionStyle = 'border-slate-600 bg-slate-700/20 opacity-50';
                        }
                      } else if (isSelected) {
                        optionStyle = 'border-purple-500 bg-purple-600/20';
                      }

                      return (
                        <label
                          key={oIndex}
                          className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all cursor-pointer ${optionStyle} ${isAnswered ? 'cursor-default' : ''}`}
                          onClick={(e) => {
                            e.preventDefault();
                            if (!isAnswered) handleAnswerSelect(option);
                          }}
                        >
                          <RadioGroupItem 
                            value={option} 
                            id={`q${currentQuestionIndex}-o${oIndex}`} 
                            disabled={isAnswered}
                            className="pointer-events-none"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start gap-2">
                              <span className="font-bold text-slate-300 text-sm">{optionLetter}.</span>
                              <MathText className="text-sm text-white leading-relaxed">{option}</MathText>
                            </div>
                          </div>
                          {isAnswered && isThisCorrect && (
                            <CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                          )}
                          {isAnswered && isSelected && !isThisCorrect && (
                            <X className="w-5 h-5 text-red-400 flex-shrink-0" />
                          )}
                        </label>
                      );
                    })}
                  </RadioGroup>
                </div>

                {/* Feedback Section - Shows after answering */}
                {isAnswered && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="border-t border-white/10"
                  >
                    <div className={`p-6 ${isCorrect ? 'bg-emerald-500/10' : 'bg-amber-500/10'}`}>
                      <div className="flex items-start gap-3">
                        {isCorrect ? (
                          <div className="w-8 h-8 bg-emerald-500 rounded-full flex items-center justify-center flex-shrink-0">
                            <CheckCircle className="w-5 h-5 text-white" />
                          </div>
                        ) : (
                          <div className="w-8 h-8 bg-amber-500 rounded-full flex items-center justify-center flex-shrink-0">
                            <Lightbulb className="w-5 h-5 text-white" />
                          </div>
                        )}
                        <div className="flex-1">
                          <p className={`font-bold text-sm ${isCorrect ? 'text-emerald-400' : 'text-amber-400'}`}>
                            {isCorrect ? '🎉 Excellent!' : 'Keep learning!'}
                          </p>
                          {!isCorrect && (
                            <p className="text-emerald-300 text-sm mt-1">
                              Correct answer: {currentQuestion.correct_answer}
                            </p>
                          )}
                          {currentQuestion.explanation && (
                            <MathText className="text-slate-300 text-sm mt-2 leading-relaxed">
                              {currentQuestion.explanation}
                            </MathText>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Navigation Footer */}
                <div className="p-6 border-t border-white/10 flex justify-end">
                  {isLastQuestion ? (
                    <Button
                      onClick={handleSubmit}
                      disabled={!isAnswered}
                      className="h-12 px-8 text-base bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 disabled:opacity-50"
                    >
                      Submit Quiz
                    </Button>
                  ) : (
                    <Button
                      onClick={handleNext}
                      disabled={!isAnswered}
                      className="h-12 px-8 text-base bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 disabled:opacity-50"
                    >
                      Next
                      <ChevronRight className="w-5 h-5 ml-1" />
                    </Button>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}