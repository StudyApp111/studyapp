import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { AlertCircle, ChevronRight, Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import DiagnosticLoader from '@/components/onboarding/DiagnosticLoader';
import { motion, AnimatePresence } from 'framer-motion';

export default function DiagnosticQuiz() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isLoading, setIsLoading] = useState(true);
  const [isGrading, setIsGrading] = useState(false);
  const [questions, setQuestions] = useState([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState({});
  const [error, setError] = useState('');
  const [params, setParams] = useState({});

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const school = searchParams.get('school');
    const courseCode = searchParams.get('courseCode');

    console.log('📋 DiagnosticQuiz params:', { school, courseCode });

    if (!school || !courseCode) {
      console.error('❌ Missing params, redirecting to onboarding');
      setError('Missing required information. Redirecting to onboarding...');
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
    console.log('🎯 Calling generateDiagnosticExam with:', { school, courseCode });
    try {
      const result = await base44.functions.invoke('generateDiagnosticExam', {
        school,
        courseCode
      });

      console.log('📊 generateDiagnosticExam response:', result);

      if (result.data?.success && result.data?.questions) {
        console.log('✅ Questions generated:', result.data.questions.length);
        setQuestions(result.data.questions);
      } else {
        console.error('❌ Invalid response structure:', result.data);
        throw new Error(result.data?.error || 'Failed to generate questions');
      }
    } catch (err) {
      console.error('❌ Error generating quiz:', err);
      setError(`Failed to generate your quiz: ${err.message}. Please try again.`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAnswerChange = (answer) => {
    setUserAnswers(prev => ({
      ...prev,
      [currentQuestionIndex]: answer
    }));
  };

  const handleNext = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    }
  };

  const handleSubmit = async () => {
    if (Object.keys(userAnswers).length !== questions.length) {
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
      console.error('❌ Error grading quiz:', err);
      setError(`Failed to grade your quiz: ${err.message}. Please try again.`);
      setIsGrading(false);
    }
  };

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
  const isAnswered = userAnswers[currentQuestionIndex] !== undefined;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">
            Diagnostic Quiz
          </h1>
          <p className="text-slate-400 text-sm">
            {params.courseCode} • {params.school}
          </p>
        </div>

        {/* Progress indicator */}
        <div className="mb-6">
          <div className="flex items-center justify-center gap-2 mb-2">
            {questions.map((_, idx) => (
              <div
                key={idx}
                className={`h-2 w-12 rounded-full transition-all ${
                  idx === currentQuestionIndex
                    ? 'bg-purple-500 scale-110'
                    : userAnswers[idx]
                    ? 'bg-purple-500/50'
                    : 'bg-slate-700'
                }`}
              />
            ))}
          </div>
          <p className="text-center text-slate-400 text-sm">
            Question {currentQuestionIndex + 1} of {questions.length}
          </p>
        </div>

        {/* Error */}
        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Question Card - Single Question View */}
        <AnimatePresence mode="wait">
          {currentQuestion && (
            <motion.div
              key={currentQuestionIndex}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="bg-slate-800/60 backdrop-blur-sm rounded-2xl p-6 md:p-8 border border-slate-700/50"
            >
              <h3 className="text-lg md:text-xl font-semibold text-white mb-6">
                {currentQuestion.question_text}
              </h3>

              <RadioGroup
                value={userAnswers[currentQuestionIndex] || ''}
                onValueChange={handleAnswerChange}
                className="space-y-3"
              >
                {currentQuestion.options.map((option, oIndex) => (
                  <div
                    key={oIndex}
                    className={`flex items-center space-x-3 p-4 rounded-xl border-2 transition-all cursor-pointer ${
                      userAnswers[currentQuestionIndex] === option
                        ? 'border-purple-500 bg-purple-600/20'
                        : 'border-slate-600 hover:border-slate-500 bg-slate-700/30'
                    }`}
                    onClick={() => handleAnswerChange(option)}
                  >
                    <RadioGroupItem value={option} id={`q${currentQuestionIndex}-o${oIndex}`} />
                    <Label
                      htmlFor={`q${currentQuestionIndex}-o${oIndex}`}
                      className="flex-1 text-white cursor-pointer text-sm md:text-base"
                    >
                      {option}
                    </Label>
                  </div>
                ))}
              </RadioGroup>

              {/* Navigation */}
              <div className="flex justify-end mt-8">
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
  );
}