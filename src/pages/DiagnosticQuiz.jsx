import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { AlertCircle, Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import DiagnosticLoader from '@/components/onboarding/DiagnosticLoader';

export default function DiagnosticQuiz() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isLoading, setIsLoading] = useState(true);
  const [isGrading, setIsGrading] = useState(false);
  const [questions, setQuestions] = useState([]);
  const [userAnswers, setUserAnswers] = useState({});
  const [error, setError] = useState('');
  const [params, setParams] = useState({});

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const subject = searchParams.get('subject');
    const school = searchParams.get('school');
    const courseCode = searchParams.get('courseCode');

    if (!subject || !school || !courseCode) {
      // Missing params - redirect back to onboarding
      setTimeout(() => {
        navigate(createPageUrl("Onboarding"), { replace: true });
      }, 2000);
      setError('Missing required information. Redirecting to onboarding...');
      setIsLoading(false);
      return;
    }

    setParams({ subject, school, courseCode });
    generateQuestions(subject, school, courseCode);
  }, [location.search, navigate]);

  const generateQuestions = async (subject, school, courseCode) => {
    try {
      const result = await base44.functions.invoke('generateDiagnosticExam', {
        subject,
        school,
        courseCode
      });

      if (result.data?.success && result.data?.questions) {
        setQuestions(result.data.questions);
      } else {
        throw new Error('Failed to generate questions');
      }
    } catch (err) {
      console.error('Error generating quiz:', err);
      setError('Failed to generate your quiz. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAnswerChange = (questionIndex, answer) => {
    setUserAnswers(prev => ({
      ...prev,
      [questionIndex]: answer
    }));
  };

  const handleSubmit = async () => {
    // Validate all questions are answered
    if (Object.keys(userAnswers).length !== questions.length) {
      setError('Please answer all questions before submitting.');
      return;
    }

    setIsGrading(true);
    setError('');

    try {
      // Format user answers for grading
      const formattedAnswers = Object.entries(userAnswers).map(([index, answer]) => ({
        question_index: parseInt(index),
        answer
      }));

      // Grade the exam
      const result = await base44.functions.invoke('gradeDiagnosticExam', {
        subject: params.subject,
        school: params.school,
        courseCode: params.courseCode,
        questions,
        userAnswers: formattedAnswers
      });

      if (result.data?.success) {
        // Navigate to PredictedGradeDisplay with results
        const queryParams = new URLSearchParams({
          grade: result.data.predicted_grade,
          strongAreas: JSON.stringify(result.data.strong_areas),
          weakAreas: JSON.stringify(result.data.weak_areas),
          studyDays: result.data.estimated_study_time_days,
          subject: params.subject,
          school: params.school,
          courseCode: params.courseCode
        });

        navigate(createPageUrl('PredictedGradeDisplay') + `?${queryParams.toString()}`, { replace: true });
      } else {
        throw new Error('Failed to grade exam');
      }
    } catch (err) {
      console.error('Error grading quiz:', err);
      setError('Failed to grade your quiz. Please try again.');
      setIsGrading(false);
    }
  };

  if (isLoading) {
    return <DiagnosticLoader mode="generating" />;
  }

  if (isGrading) {
    return <DiagnosticLoader mode="grading" />;
  }

  const allAnswered = Object.keys(userAnswers).length === questions.length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4 md:p-8">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">
            Your Diagnostic Quiz
          </h1>
          <p className="text-slate-300">
            {params.courseCode} • {params.subject}
          </p>
        </div>

        {/* Progress indicator */}
        <div className="mb-6">
          <div className="flex items-center justify-center gap-2">
            {questions.map((_, idx) => (
              <div
                key={idx}
                className={`h-2 w-12 rounded-full transition-all ${
                  userAnswers[idx]
                    ? 'bg-purple-500'
                    : 'bg-slate-700'
                }`}
              />
            ))}
          </div>
          <p className="text-center text-slate-400 text-sm mt-2">
            {Object.keys(userAnswers).length} of {questions.length} answered
          </p>
        </div>

        {/* Error */}
        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Questions */}
        <div className="space-y-6 mb-8">
          {questions.map((question, qIndex) => (
            <div
              key={qIndex}
              className="bg-slate-800/60 backdrop-blur-sm rounded-2xl p-6 border border-slate-700/50"
            >
              <h3 className="text-lg md:text-xl font-semibold text-white mb-4">
                Question {qIndex + 1}
              </h3>
              <p className="text-slate-200 mb-4 text-base md:text-lg">
                {question.question_text}
              </p>

              <RadioGroup
                value={userAnswers[qIndex] || ''}
                onValueChange={(value) => handleAnswerChange(qIndex, value)}
              >
                {question.options.map((option, oIndex) => (
                  <div
                    key={oIndex}
                    className={`flex items-center space-x-3 p-4 rounded-xl border-2 transition-all cursor-pointer ${
                      userAnswers[qIndex] === option
                        ? 'border-purple-500 bg-purple-600/20'
                        : 'border-slate-600 hover:border-slate-500 bg-slate-700/30'
                    }`}
                  >
                    <RadioGroupItem value={option} id={`q${qIndex}-o${oIndex}`} />
                    <Label
                      htmlFor={`q${qIndex}-o${oIndex}`}
                      className="flex-1 text-white cursor-pointer text-sm md:text-base"
                    >
                      {option}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>
          ))}
        </div>

        {/* Submit Button */}
        <div className="flex justify-center">
          <Button
            onClick={handleSubmit}
            disabled={!allAnswered}
            className="h-14 px-12 text-lg bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 disabled:opacity-50"
          >
            Submit Quiz
          </Button>
        </div>
      </div>
    </div>
  );
}