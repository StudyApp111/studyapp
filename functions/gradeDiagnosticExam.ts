import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { GoogleGenerativeAI } from 'npm:@google/generative-ai';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    const { school, courseCode, questions, userAnswers } = await req.json();

    if (!school || !courseCode || !questions || !userAnswers) {
      return Response.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    const apiKey = Deno.env.get('GEMINIAPIKEY');
    if (!apiKey) {
      return Response.json({ error: 'API key not configured' }, { status: 500 });
    }

    // Build grading context
    const questionContext = questions.map((q, idx) => {
      const userAnswer = userAnswers.find(a => a.question_index === idx);
      return {
        question: q.question_text,
        correct_answer: q.correct_answer,
        user_answer: userAnswer?.answer || 'Not answered',
        is_correct: userAnswer?.answer === q.correct_answer,
        assessed_competencies: q.assessed_competencies
      };
    }).map((q, idx) => `Q${idx + 1}: ${q.question}\nCorrect: ${q.correct_answer}\nUser: ${q.user_answer}\nResult: ${q.is_correct ? '✓' : '✗'}\nCompetencies: ${q.assessed_competencies.join(', ')}`).join('\n\n');

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-flash-latest'
    });

    const prompt = `You are an expert educational grader. A student studying "${courseCode}" (${subject}) at "${school}" has completed a diagnostic assessment.

STUDENT PERFORMANCE:
${questionContext}

Use Google Search to understand the typical curriculum for this course and the expected competency levels.

Based on this performance, provide:
1. Predicted letter grade (A+, A, A-, B+, B, B-, C+, C, C-, D+, D, F)
2. Strong areas (what they got right)
3. Weak areas (what they need to improve)
4. Estimated study time in days to reach A+ (realistic estimate)

OUTPUT FORMAT (strict JSON):
{
  "predicted_grade": "B-",
  "strong_areas": ["Basic concepts (Q1 correct)", "Problem-solving (Q2 correct)"],
  "weak_areas": ["Advanced calculus (Q3 incorrect)"],
  "estimated_study_time_days": 14
}

Provide your assessment now.`;

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      tools: [{
        googleSearch: {}
      }],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 8000,
        responseMimeType: "application/json",
        responseSchema: {
          type: "object",
          properties: {
            predicted_grade: { type: "string" },
            strong_areas: { type: "array", items: { type: "string" } },
            weak_areas: { type: "array", items: { type: "string" } },
            estimated_study_time_days: { type: "number" }
          },
          required: ["predicted_grade", "strong_areas", "weak_areas", "estimated_study_time_days"]
        }
      }
    });

    const response = result.response;
    const text = response.text();
    
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (parseError) {
      console.error("Failed to parse AI response:", text);
      return Response.json({ error: 'Failed to grade exam' }, { status: 500 });
    }

    return Response.json({
      success: true,
      ...parsed
    });

  } catch (error) {
    console.error('Error grading diagnostic exam:', error);
    return Response.json({ 
      error: error.message || 'Failed to grade diagnostic exam' 
    }, { status: 500 });
  }
});