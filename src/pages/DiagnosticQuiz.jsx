import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { AlertCircle, ChevronRight, CheckCircle, Lightbulb, X, Star } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import DiagnosticLoader from '@/components/onboarding/DiagnosticLoader';
import { motion, AnimatePresence } from 'framer-motion';
import MathText from '@/components/math/MathText';
import ConfettiEffect from '@/components/gamification/ConfettiEffect';

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
  
  // Animation states
  const [showConfetti, setShowConfetti] = useState(false);
  const [showWrongPulse, setShowWrongPulse] = useState(false);
  const [showCorrectBurst, setShowCorrectBurst] = useState(false);
  const [questionStartTime, setQuestionStartTime] = useState(Date.now());
  const [elapsedTime, setElapsedTime] = useState(0);

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const name = searchParams.get('name');
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

    setParams({ name, school, courseCode });
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

  // Determine question type
  const getQuestionType = (question) => {
    const type = (question.question_type || '').toLowerCase();
    if (type.includes('multiple choice') || type.includes('multiple_choice') || type.includes('mcq')) return 'mcq';
    if (type.includes('true') && type.includes('false') || type.includes('true_false')) return 'truefalse';
    if (type.includes('fill') && type.includes('blank') || type.includes('fill_blank')) return 'fillblank';
    if (type.includes('short answer') || type.includes('short_answer')) return 'shortanswer';
    // Default to MCQ if has options
    if (question.options && question.options.length > 0) return 'mcq';
    return 'shortanswer';
  };

  // Check if answer is correct
  const checkAnswer = (question, userAnswer) => {
    const questionType = getQuestionType(question);
    const correctAnswer = question.correct_answer;
    
    if (!userAnswer || !correctAnswer) return false;
    
    if (questionType === 'mcq') {
      // For MCQ, correct_answer should be just a letter (A, B, C, D)
      // User answer is the full option text, we need to extract the letter
      const userTrimmed = userAnswer.trim();
      const correctTrimmed = correctAnswer.trim().toUpperCase();
      
      // If correct answer is just a letter
      if (/^[A-D]$/i.test(correctTrimmed)) {
        // Extract letter from user's selection
        const letterMatch = userTrimmed.match(/^([A-D])[\.\)\s]/i);
        if (letterMatch) {
          return letterMatch[1].toUpperCase() === correctTrimmed;
        }
        // Find option index and compare
        const optionIndex = question.options?.findIndex(opt => opt === userAnswer);
        if (optionIndex !== -1) {
          const userLetter = String.fromCharCode(65 + optionIndex);
          return userLetter === correctTrimmed;
        }
      }
      // Fallback: direct comparison
      return userTrimmed.toLowerCase() === correctAnswer.toLowerCase();
    }
    
    if (questionType === 'truefalse') {
      return userAnswer.toLowerCase() === correctAnswer.toLowerCase();
    }
    
    if (questionType === 'fillblank') {
      return userAnswer.trim().toLowerCase() === correctAnswer.trim().toLowerCase();
    }
    
    // Short answer - don't auto-grade
    return null;
  };

  const handleAnswerSelect = (answer) => {
    if (answeredQuestions[currentQuestionIndex]) return; // Lock after answering
    
    const question = questions[currentQuestionIndex];
    const questionType = getQuestionType(question);
    
    setUserAnswers(prev => ({
      ...prev,
      [currentQuestionIndex]: answer
    }));
    
    // For short answer, don't auto-grade
    if (questionType === 'shortanswer') {
      return;
    }
    
    const isCorrect = checkAnswer(question, answer);
    
    setAnsweredQuestions(prev => ({
      ...prev,
      [currentQuestionIndex]: { answer, isCorrect }
    }));
    
    // Trigger animations
    if (isCorrect) {
      setShowConfetti(true);
      setShowCorrectBurst(true);
      setTimeout(() => setShowCorrectBurst(false), 1500);
    } else {
      setShowWrongPulse(true);
      setTimeout(() => setShowWrongPulse(false), 800);
    }
  };

  // Auto-submit for fill-blank and short-answer after typing
  useEffect(() => {
    const questionType = currentQuestion ? getQuestionType(currentQuestion) : 'mcq';
    if ((questionType === 'fillblank' || questionType === 'shortanswer') && !isAnswered) {
      const answer = userAnswers[currentQuestionIndex];
      if (answer?.trim()) {
        const timeout = setTimeout(() => {
          if (questionType === 'fillblank') {
            handleAnswerSelect(answer);
          } else {
            setAnsweredQuestions(prev => ({
              ...prev,
              [currentQuestionIndex]: { answer, isCorrect: null }
            }));
          }
        }, 1500);
        return () => clearTimeout(timeout);
      }
    }
  }, [userAnswers[currentQuestionIndex], isAnswered, currentQuestion]);

  const handleNext = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
      setQuestionStartTime(Date.now());
      setElapsedTime(0);
    }
  };

  // Timer effect
  useEffect(() => {
    if (!isAnswered) {
      const timer = setInterval(() => {
        setElapsedTime(Math.floor((Date.now() - questionStartTime) / 1000));
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [isAnswered, questionStartTime]);

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
          name: params.name || '',
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
  const questionType = currentQuestion ? getQuestionType(currentQuestion) : 'mcq';

  // Get option style based on answer state
  const getOptionStyle = (option, optionIndex) => {
    const isSelected = userAnswers[currentQuestionIndex] === option;
    
    if (!isAnswered) {
      return isSelected
        ? 'border-purple-500 bg-purple-600/20'
        : 'border-slate-600 bg-slate-700/30 hover:border-purple-500/50 hover:bg-purple-600/10';
    }
    
    // After answering
    const correctAnswer = currentQuestion.correct_answer?.trim().toUpperCase();
    const optionLetter = String.fromCharCode(65 + optionIndex);
    const isThisCorrect = optionLetter === correctAnswer;
    
    if (isThisCorrect) {
      return 'border-emerald-500 bg-emerald-500/20';
    }
    if (isSelected && !isThisCorrect) {
      return 'border-red-400 bg-red-500/20';
    }
    return 'border-slate-600 bg-slate-700/20 opacity-50';
  };

  const renderMCQOptions = () => (
    <RadioGroup
      value={userAnswers[currentQuestionIndex] || ''}
      onValueChange={handleAnswerSelect}
      className="space-y-3"
    >
      {currentQuestion.options.map((option, oIndex) => {
        const optionLetter = String.fromCharCode(65 + oIndex);
        const isSelected = userAnswers[currentQuestionIndex] === option;
        const correctAnswer = currentQuestion.correct_answer?.trim().toUpperCase();
        const isThisCorrect = optionLetter === correctAnswer;
        
        // Strip leading letter prefix if present
        const displayText = option.replace(/^[A-D][\.\)\s]+/i, '').trim();

        return (
          <label
            key={oIndex}
            className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all cursor-pointer ${getOptionStyle(option, oIndex)} ${isAnswered ? 'cursor-default' : ''}`}
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
                <MathText className="text-sm text-white leading-relaxed">{displayText}</MathText>
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
  );

  const renderTrueFalseOptions = () => (
    <RadioGroup
      value={userAnswers[currentQuestionIndex] || ''}
      onValueChange={handleAnswerSelect}
      className="space-y-3"
    >
      {["True", "False"].map((option, oIndex) => {
        const isSelected = userAnswers[currentQuestionIndex] === option;
        const isThisCorrect = option.toLowerCase() === currentQuestion.correct_answer?.toLowerCase();

        return (
          <label
            key={option}
            className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all cursor-pointer ${
              !isAnswered
                ? isSelected
                  ? 'border-purple-500 bg-purple-600/20'
                  : 'border-slate-600 bg-slate-700/30 hover:border-purple-500/50'
                : isThisCorrect
                  ? 'border-emerald-500 bg-emerald-500/20'
                  : isSelected
                    ? 'border-red-400 bg-red-500/20'
                    : 'border-slate-600 bg-slate-700/20 opacity-50'
            } ${isAnswered ? 'cursor-default' : ''}`}
            onClick={(e) => {
              e.preventDefault();
              if (!isAnswered) handleAnswerSelect(option);
            }}
          >
            <RadioGroupItem value={option} id={`tf-${option}`} disabled={isAnswered} className="pointer-events-none" />
            <span className="text-sm text-white font-medium">{option}</span>
            {isAnswered && isThisCorrect && <CheckCircle className="w-5 h-5 text-emerald-400 ml-auto" />}
            {isAnswered && isSelected && !isThisCorrect && <X className="w-5 h-5 text-red-400 ml-auto" />}
          </label>
        );
      })}
    </RadioGroup>
  );

  const renderFillBlankInput = () => (
    <div className="space-y-3">
      <Input
        type="text"
        value={userAnswers[currentQuestionIndex] || ''}
        onChange={(e) => {
          if (!isAnswered) {
            setUserAnswers(prev => ({ ...prev, [currentQuestionIndex]: e.target.value }));
          }
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !isAnswered && userAnswers[currentQuestionIndex]?.trim()) {
            handleAnswerSelect(userAnswers[currentQuestionIndex]);
          }
        }}
        placeholder="Type your answer..."
        disabled={isAnswered}
        className="h-14 text-lg bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500"
      />
    </div>
  );

  const renderShortAnswerInput = () => (
    <div className="space-y-3">
      <Textarea
        value={userAnswers[currentQuestionIndex] || ''}
        onChange={(e) => {
          if (!isAnswered) {
            setUserAnswers(prev => ({ ...prev, [currentQuestionIndex]: e.target.value }));
          }
        }}
        placeholder="Type your answer..."
        disabled={isAnswered}
        className="min-h-[120px] text-sm bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500"
      />
    </div>
  );

  const renderInput = () => {
    switch (questionType) {
      case 'mcq': return renderMCQOptions();
      case 'truefalse': return renderTrueFalseOptions();
      case 'fillblank': return renderFillBlankInput();
      case 'shortanswer': return renderShortAnswerInput();
      default: return renderMCQOptions();
    }
  };

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 z-[9999] overflow-y-auto">
      <ConfettiEffect show={showConfetti} onComplete={() => setShowConfetti(false)} />
      
      {/* Correct answer celebration overlay */}
      <AnimatePresence>
        {showCorrectBurst && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.2 }}
            className="fixed inset-0 pointer-events-none z-[10000] flex items-center justify-center"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: [0, 1.2, 1], rotate: [0, 10, -10, 0] }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-full p-6 shadow-2xl shadow-emerald-500/50"
            >
              <CheckCircle className="w-12 h-12 text-white" />
            </motion.div>
            {[...Array(6)].map((_, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: 0, y: 0 }}
                animate={{ 
                  opacity: [0, 1, 0],
                  x: Math.cos(i * 60 * Math.PI / 180) * 100,
                  y: Math.sin(i * 60 * Math.PI / 180) * 100,
                  scale: [0, 1, 0.5]
                }}
                transition={{ duration: 0.8, delay: 0.1 * i }}
                className="absolute"
              >
                <Star className="w-6 h-6 text-yellow-400 fill-yellow-400" />
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="min-h-screen flex flex-col">
        {/* Header with StudyApp branding */}
        <div className="p-4 border-b border-white/10 bg-slate-900/80 backdrop-blur-sm">
          <div className="max-w-2xl mx-auto">
            {/* StudyApp Logo */}
            <div className="text-center mb-3">
              <h1 className="text-xl md:text-2xl font-black">
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">Study</span>
                <span className="text-white">App</span>
              </h1>
            </div>
            
            <div className="text-center mb-3">
              <p className="text-purple-300 font-medium text-sm">Diagnostic Quiz</p>
              <p className="text-slate-400 text-xs">
                {params.courseCode} • {params.school}
              </p>
            </div>

            {/* Progress indicator */}
            <div className="flex items-center justify-center gap-2">
              {questions.map((_, idx) => (
                <div
                  key={idx}
                  className={`h-2 w-8 md:w-10 rounded-full transition-all ${
                    idx === currentQuestionIndex
                      ? 'bg-gradient-to-r from-purple-500 to-pink-500 scale-110'
                      : answeredQuestions[idx]
                      ? answeredQuestions[idx].isCorrect === true
                        ? 'bg-emerald-500'
                        : answeredQuestions[idx].isCorrect === false
                          ? 'bg-red-400'
                          : 'bg-purple-400'
                      : 'bg-slate-700'
                  }`}
                />
              ))}
            </div>
            <p className="text-center text-purple-300 font-medium text-sm mt-2">
              {questions.length - currentQuestionIndex} Question{questions.length - currentQuestionIndex !== 1 ? 's' : ''} Away From Predicted Grade...
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

        {/* Question Card */}
        <div className="flex-1 flex items-center justify-center p-4">
          <AnimatePresence mode="wait">
            {currentQuestion && (
              <motion.div
                key={currentQuestionIndex}
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ 
                  opacity: 1, 
                  scale: 1, 
                  y: 0,
                  x: showWrongPulse ? [0, -8, 8, -8, 8, -4, 4, 0] : 0
                }}
                exit={{ opacity: 0, scale: 0.95, y: -20 }}
                transition={{ duration: 0.2 }}
                className={`w-full max-w-2xl bg-slate-800/90 backdrop-blur-xl rounded-2xl border border-purple-500/30 shadow-2xl shadow-purple-500/10 overflow-hidden ${showWrongPulse ? 'ring-2 ring-red-400/60' : ''}`}
              >
                {/* Wrong answer flash overlay */}
                <AnimatePresence>
                  {showWrongPulse && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: [0, 0.15, 0] }}
                      transition={{ duration: 0.5 }}
                      className="absolute inset-0 bg-red-500 rounded-2xl pointer-events-none z-10"
                    />
                  )}
                </AnimatePresence>

                {/* Purple Gradient Header with Timer and Metadata */}
                <div className="bg-gradient-to-r from-purple-600 via-purple-700 to-indigo-700 p-4 md:p-5">
                  <div className="flex items-center justify-between mb-3">
                    {/* Timer */}
                    <div className="flex items-center gap-2 bg-white/10 rounded-lg px-3 py-1.5">
                      <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <circle cx="12" cy="12" r="10" strokeWidth="2" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6l4 2" />
                      </svg>
                      <span className="text-white font-mono text-sm font-semibold">
                        {Math.floor(elapsedTime / 60)}:{(elapsedTime % 60).toString().padStart(2, '0')}
                      </span>
                    </div>
                    
                    {/* Question Type */}
                    <Badge className="text-xs px-2.5 py-1 bg-white/15 text-white border-white/30">
                      {(currentQuestion.question_type || 'Multiple Choice').replace(/_/g, ' ')}
                    </Badge>
                  </div>
                  
                  {/* Difficulty and Competencies */}
                  <div className="flex flex-wrap items-center gap-2">
                    {currentQuestion.difficulty_index && (
                      <Badge className="text-xs px-2.5 py-1 bg-amber-500/30 text-amber-100 border-amber-400/30 font-medium">
                        {currentQuestion.difficulty_index}
                      </Badge>
                    )}
                    {currentQuestion.assessed_competencies?.slice(0, 2).map((comp, idx) => (
                      <Badge key={idx} className="text-xs px-2.5 py-1 bg-emerald-500/30 text-emerald-100 border-emerald-400/30">
                        {comp}
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* Question Text */}
                <div className="p-4 md:p-6 border-b border-white/10">
                  <MathText className="text-base md:text-lg font-semibold text-white leading-relaxed">
                    {currentQuestion.question_text}
                  </MathText>
                </div>

                {/* Options */}
                <div className="p-4 md:p-6 space-y-2 md:space-y-3">
                  {renderInput()}
                </div>

                {/* Feedback Section - Shows after answering */}
                {isAnswered && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="border-t border-white/10"
                  >
                    <div className={`p-6 ${
                      isCorrect === true 
                        ? 'bg-emerald-500/10' 
                        : isCorrect === false 
                          ? 'bg-amber-500/10' 
                          : 'bg-purple-500/10' // Short answer
                    }`}>
                      <div className="flex items-start gap-3">
                        {isCorrect === true ? (
                          <div className="w-8 h-8 bg-emerald-500 rounded-full flex items-center justify-center flex-shrink-0">
                            <CheckCircle className="w-5 h-5 text-white" />
                          </div>
                        ) : isCorrect === false ? (
                          <div className="w-8 h-8 bg-amber-500 rounded-full flex items-center justify-center flex-shrink-0">
                            <Lightbulb className="w-5 h-5 text-white" />
                          </div>
                        ) : (
                          <div className="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center flex-shrink-0">
                            <CheckCircle className="w-5 h-5 text-white" />
                          </div>
                        )}
                        <div className="flex-1">
                          <p className={`font-bold text-sm ${
                            isCorrect === true 
                              ? 'text-emerald-400' 
                              : isCorrect === false 
                                ? 'text-amber-400' 
                                : 'text-purple-400'
                          }`}>
                            {isCorrect === true 
                              ? '🎉 Excellent!' 
                              : isCorrect === false 
                                ? 'Keep learning!' 
                                : 'Answer submitted!'
                            }
                          </p>
                          {isCorrect === false && currentQuestion.correct_answer && (
                            <p className="text-emerald-300 text-sm mt-1">
                              <span className="font-medium">Correct answer:</span>{' '}
                              {questionType === 'mcq' && /^[A-D]$/i.test(currentQuestion.correct_answer.trim())
                                ? (() => {
                                    const letter = currentQuestion.correct_answer.trim().toUpperCase();
                                    const idx = letter.charCodeAt(0) - 65;
                                    const optText = currentQuestion.options?.[idx];
                                    const cleanText = optText ? optText.replace(/^[A-D][\.\)\s]+/i, '').trim() : '';
                                    return `${letter}. ${cleanText}`;
                                  })()
                                : currentQuestion.correct_answer
                              }
                            </p>
                          )}
                          {questionType === 'shortanswer' && currentQuestion.correct_answer && (
                            <p className="text-purple-300 text-sm mt-1">
                              <span className="font-medium">Model answer:</span> {currentQuestion.correct_answer}
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
                <div className="p-4 md:p-6 border-t border-white/10 flex justify-end">
                  {isLastQuestion ? (
                    <Button
                      onClick={handleSubmit}
                      disabled={!isAnswered}
                      className="h-11 md:h-12 px-6 md:px-8 text-sm md:text-base font-semibold bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white disabled:opacity-50 shadow-lg shadow-purple-500/30"
                    >
                      Submit Quiz
                    </Button>
                  ) : (
                    <Button
                      onClick={handleNext}
                      disabled={!isAnswered}
                      className="h-11 md:h-12 px-6 md:px-8 text-sm md:text-base font-semibold bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white disabled:opacity-50 shadow-lg shadow-purple-500/30"
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