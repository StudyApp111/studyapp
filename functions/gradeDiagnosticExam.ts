import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { GoogleGenerativeAI } from 'npm:@google/generative-ai';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    const { school, courseCode, questions, userAnswers, studentName, curriculumData } = await req.json();

    if (!school || !courseCode || !questions || !userAnswers) {
      return Response.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    const apiKey = Deno.env.get('GEMINIAPIKEY');
    if (!apiKey) {
      return Response.json({ error: 'API key not configured' }, { status: 500 });
    }

    // Calculate correct/total for context
    const totalQuestions = questions.length;
    let correctCount = 0;
    
    // Build grading context
    const questionContext = questions.map((q, idx) => {
      const userAnswer = userAnswers.find(a => a.question_index === idx);
      const isCorrect = userAnswer?.answer === q.correct_answer;
      if (isCorrect) correctCount++;
      
      return `Q${idx + 1}: ${q.question_text}
Correct: ${q.correct_answer}
User: ${userAnswer?.answer || 'Not answered'}
Result: ${isCorrect ? '✓' : '✗'}
Competencies: ${(q.assessed_competencies || []).join(', ')}`;
    }).join('\n\n');

    const curriculumContext = curriculumData ? `
CURRICULUM MAP DATA:
${JSON.stringify(curriculumData, null, 2)}

Use this curriculum to:
- Identify weak areas matching actual course competencies
- Calculate grade impact based on competency weightings
- Select preview questions matching assessment formats
- Reference common misconceptions
` : '';

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-flash-lite-latest'
    });

    const actualPercentage = Math.round((correctCount / totalQuestions) * 100);
    
    const prompt = `CRITICAL: You are grading a REAL student's diagnostic exam. Analyze their ACTUAL performance data below. DO NOT use placeholder values or generic examples.

STUDENT INFORMATION:
- Name: ${studentName || 'Student'}
- Course: ${courseCode} at ${school}
- Actual Score: ${correctCount} out of ${totalQuestions} questions correct
- Actual Percentage: ${actualPercentage}%

${curriculumContext}

ACTUAL STUDENT RESPONSES (ANALYZE THESE EXACTLY):
${questionContext}

YOUR TASK: Analyze the ACTUAL performance data above and return ONLY valid JSON (no markdown, no tables, no extra text).

CRITICAL RULES:
1. Use the ACTUAL percentage (${actualPercentage}%) - DO NOT use 80% or any other placeholder
2. Identify weak areas from the ACTUAL wrong answers in the performance data above
3. Strong areas must come from ACTUAL correct answers
4. All data MUST be based on THIS student's ACTUAL responses

GRADING ALGORITHM:
1. ACTUAL Grade: ${actualPercentage}% maps to letter grade:
   A+(97-100), A(93-96), A-(90-92), B+(87-89), B(83-86), B-(80-82), C+(77-79), C(73-76), C-(70-72), D+(67-69), D(63-66), D-(60-62), F(0-59)

2. WEAK AREAS - Identify 3 topics from the questions marked ✗ above:
   - Use the ACTUAL question topics from wrong answers
   - Calculate realistic grade impact
   - Assign tool: Conceptual → "Teach It Cards", Application → "Practice Questions"

3. STRONG AREAS - From questions marked ✓ above

4. REALISTIC TRAJECTORY based on ACTUAL ${actualPercentage}%:
   0-30% (F): Week1→D-, Week2→D+, Week3→C
   31-50% (F/D): Week1→D, Week2→C-, Week3→C+
   51-70% (D/C): Week1→C+, Week2→B-, Week3→B
   71-85% (C/B): Week1→B, Week2→B+, Week3→A-
   86-95% (B/A): Week1→A-, Week2→A, Week3→A+

5. PERSONALIZED MESSAGE using ${studentName || 'Student'} and ${actualPercentage}%

REQUIRED JSON OUTPUT (respond with ONLY this JSON, nothing else):

{
  "predicted_grade": "string (e.g. B-, A, F)",
  "predicted_percentage": number,
  "confidence_level": "string (High or Medium)",
  "strong_areas": ["array of strings from correct answers"],
  "weak_areas_detailed": [
    {
      "topic": "specific topic from wrong answer",
      "related_competency": "curriculum competency or null",
      "severity": "critical or high or medium",
      "grade_impact": "string with % (e.g. 20%)",
      "assessment_context": "string (e.g. Final Paper - 40%)",
      "recommended_tool": "Teach It Cards or Practice Questions or AI Tutor",
      "tool_reason": "short explanation under 15 words",
      "specific_fix": "comma-separated subtopics"
    }
  ],
  "preview_question": {
    "topic": "string matching first weak area",
    "related_competency": "string or null",
    "assessment_format": "string (Short Answer, Multiple Choice, etc)",
    "question_text": "string with new question",
    "question_type": "string",
    "correct_answer": "string with complete answer",
    "why_this_matters": "string explaining importance",
    "impact_statement": "string showing grade impact"
  },
  "estimated_study_time_days": 21,
  "study_intensity": "30-45 min/day",
  "grade_trajectory": {
    "current": "string current grade",
    "week_1_target": "string grade",
    "week_1_percentage": number,
    "week_1_description": "string",
    "week_2_target": "string grade",
    "week_2_percentage": number,
    "week_2_description": "string",
    "week_3_target": "string grade",
    "week_3_percentage": number,
    "week_3_description": "string",
    "final_target": "string grade"
  },
  "personalized_message_line1": "string with name and percentage",
  "personalized_message_line2": "string with realistic timeline",
  "personalized_message_line3": "string with positive reframe",
  "urgency_timeline": {
    "start_today": "string with realistic outcome",
    "wait_5_days": "string with degraded outcome",
    "wait_10_days": "string with poor outcome"
  },
  "top_priority_action": "string recommending first action",
  "toolkit_social_proof": {
    "teach_it_cards": {
      "testimonial": "string",
      "testimonial_author": "string",
      "stats": "string"
    },
    "practice_questions": {
      "testimonial": "string",
      "testimonial_author": "string",
      "stats": "string"
    },
    "ai_tutor": {
      "testimonial": "string",
      "testimonial_author": "string",
      "stats": "string"
    }
  }
}

CRITICAL: Respond with ONLY the JSON object above. No markdown, no code blocks, no explanatory text before or after.`;

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 16000,
        responseMimeType: "application/json"
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
      return Response.json({ 
        error: 'Failed to parse grading response', 
        details: parseError.message,
        raw_response: text.substring(0, 500)
      }, { status: 500 });
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