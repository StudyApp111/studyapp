import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { GoogleGenerativeAI } from 'npm:@google/generative-ai';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    const { school, courseCode, questions, userAnswers, studentName } = await req.json();

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
      return `Q${idx + 1}: ${q.question_text}
Correct: ${q.correct_answer}
User: ${userAnswer?.answer || 'Not answered'}
Result: ${userAnswer?.answer === q.correct_answer ? '✓' : '✗'}
Competencies: ${(q.assessed_competencies || []).join(', ')}`;
    }).join('\n\n');

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-flash-latest'
    });

    const prompt = `You are an expert educational assessment analyst. A student named "${studentName || 'Student'}" studying "${courseCode}" at "${school}" has completed a diagnostic assessment.

STUDENT PERFORMANCE:
${questionContext}

ANALYSIS REQUIREMENTS:

1. PREDICTED GRADE CALCULATION
   - Analyze performance across all questions
   - Calculate predicted letter grade (A+, A, A-, B+, B, B-, C+, C, C-, D+, D, F)
   - Calculate predicted percentage (0-100)
   - Consider difficulty weighting of questions

2. WEAK AREAS ANALYSIS (Critical - This drives the entire report)
   - Identify 3-5 specific weak topics (not generic statements)
   - Rank by severity and impact on grade
   - Calculate realistic grade impact for each (as percentage points)
   - Select which learning tool will fix each weakness

3. PREVIEW QUESTION SELECTION
   - Choose THE MOST IMPACTFUL weak topic (highest grade impact)
   - Generate ONE preview question for this topic that:
     * Tests the specific skill they're missing
     * Is authentic to ${courseCode} at ${school}
     * Has a clear correct answer
     * Would appear on their actual exam
   - Provide the correct answer (will be shown after signup)

4. PERSONALIZATION
   - Write a brief, encouraging message about their performance
   - Reference their specific strengths and ONE key weakness
   - Create urgency based on realistic exam timeline

LEARNING TOOLS AVAILABLE:
- "Teach It Cards": Student explains concepts back to AI (best for theories, frameworks, conceptual understanding)
- "Practice Questions": Adaptive questions targeting weak spots (best for calculations, problem-solving, application)
- "AI Tutor": 24/7 chat support (best for getting unstuck, clarifying confusion)
- "Note Generator": Creates comprehensive notes (best for organizing information)

TOOL SELECTION LOGIC:
- If weakness is conceptual/theoretical → "Teach It Cards"
- If weakness is calculation/problem-solving → "Practice Questions"  
- If weakness is application/analysis → "Practice Questions"
- If weakness is understanding complex topics → "AI Tutor"
- Default to "Teach It Cards" when uncertain (it's most effective)

OUTPUT FORMAT:
You MUST respond with ONLY valid JSON (no markdown, no backticks, no explanation):

{
  "predicted_grade": "B-",
  "predicted_percentage": 80,
  "confidence_level": "high",
  "strong_areas": [
    "Basic understanding of IPE institutions",
    "Identifying major economic theories"
  ],
  "weak_areas_detailed": [
    {
      "topic": "Core IPE theoretical motivations (realism vs liberalism)",
      "severity": "high",
      "grade_impact": "15%",
      "recommended_tool": "Teach It Cards",
      "tool_reason": "Explaining theoretical differences solidifies conceptual understanding"
    },
    {
      "topic": "IMF lending practice calculations",
      "severity": "high",
      "grade_impact": "12%",
      "recommended_tool": "Practice Questions",
      "tool_reason": "Calculation problems require repetition to master"
    },
    {
      "topic": "Applying Hegemonic Stability Theory to current geopolitics",
      "severity": "medium",
      "grade_impact": "8%",
      "recommended_tool": "Practice Questions",
      "tool_reason": "Application scenarios need practice with feedback"
    }
  ],
  "preview_question": {
    "topic": "Core IPE theoretical motivations (realism vs liberalism)",
    "question_text": "Explain how realist theory would view the IMF's role in the 2008 financial crisis, focusing on state-centric motivations.",
    "question_type": "Short Answer",
    "correct_answer": "Realists would argue that the IMF serves the interests of powerful states (particularly the US) rather than being a neutral institution. In the 2008 crisis, realist theory would emphasize how dominant states used the IMF to protect their own economic interests and maintain hegemonic power, with lending conditions designed to preserve the existing global power structure rather than purely economic recovery.",
    "why_this_matters": "This concept appears in 15% of exam questions and tests your ability to apply theory to real-world scenarios"
  },
  "estimated_study_time_days": 21,
  "study_intensity": "15-20 min/day",
  "grade_trajectory": {
    "current": "B-",
    "week_1_target": "B",
    "week_2_target": "B+",
    "week_3_target": "A-",
    "final_target": "A+"
  },
  "personalized_message": "You have a solid foundation in IPE concepts and can identify major institutions and theories. Your main challenge is applying theoretical frameworks to real-world scenarios and performing calculations. The good news: these are skills that improve quickly with targeted practice.",
  "urgency_message": "Based on typical ${courseCode} schedules, your exam is likely 3-4 weeks away. Starting today gives you a realistic path to A+. Waiting just 5 days makes B+ more realistic.",
  "top_priority_action": "Start with 'Core IPE theoretical motivations' - this single topic is worth 15% of your grade and can be mastered in 3 days with Teach It Cards."
}

VALIDATION CHECKLIST:
□ Predicted grade matches percentage (80% = B-)
□ Weak areas are SPECIFIC (not "needs improvement in general")
□ Grade impacts add up to reasonable total (not exceeding 50%)
□ Preview question is course-authentic and tests the #1 weakness
□ Personalized message references their ACTUAL performance
□ Tool recommendations match weakness type
□ Timeline is realistic (not overpromising)

Generate the comprehensive assessment now.`;

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 16000
      }
    });

    const response = result.response;
    const text = response.text();
    
    // Clean up the response - remove markdown code blocks if present
    let cleanedText = text.trim();
    if (cleanedText.startsWith('```json')) {
      cleanedText = cleanedText.slice(7);
    } else if (cleanedText.startsWith('```')) {
      cleanedText = cleanedText.slice(3);
    }
    if (cleanedText.endsWith('```')) {
      cleanedText = cleanedText.slice(0, -3);
    }
    cleanedText = cleanedText.trim();
    
    let parsed;
    try {
      parsed = JSON.parse(cleanedText);
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