import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { GoogleGenerativeAI } from 'npm:@google/generative-ai';

Deno.serve(async (req) => {
  console.log("=== gradeDiagnosticExam FUNCTION INVOKED ===");
  
  try {
    const base44 = createClientFromRequest(req);
    
    const body = await req.json();
    console.log("=== RECEIVED gradeDiagnosticExam REQUEST ===");
    console.log("Total questions:", body.questions?.length);
    console.log("Total userAnswers:", body.userAnswers?.length);

    const { school, courseCode, questions, userAnswers, studentName, curriculumData } = body;

    // CRITICAL DEBUG: Log what we received
    console.log("First question correct_answer:", questions[0]?.correct_answer);
    console.log("First userAnswer:", JSON.stringify(userAnswers[0], null, 2));
    console.log("All userAnswers:", JSON.stringify(userAnswers, null, 2));

    if (!school || !courseCode || !questions || !userAnswers) {
      console.error("Missing required parameters:", { school, courseCode, hasQuestions: !!questions, hasUserAnswers: !!userAnswers });
      return Response.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    const apiKey = Deno.env.get('GEMINIAPIKEY');
    if (!apiKey) {
      console.error("GEMINIAPIKEY not configured");
      return Response.json({ error: 'API key not configured' }, { status: 500 });
    }

    // Calculate correct/total for context
    const totalQuestions = questions.length;
    let correctCount = 0;

    console.log(`Total questions: ${totalQuestions}`);

    // Build grading context with proper answer comparison
    const questionContext = questions.map((q, idx) => {
      const userAnswer = userAnswers.find(a => a.question_index === idx);
      const userAnswerText = userAnswer?.answer || 'Not answered';
      const correctAnswerText = q.correct_answer?.trim().toUpperCase() || '';

      // For MCQ, compare letters (A, B, C, D)
      let isCorrect = false;
      if (userAnswerText && correctAnswerText) {
        if (q.question_type?.toLowerCase().includes('multiple') || q.options?.length > 0) {
          // MCQ - compare just letters
          const userLetter = userAnswerText.trim().toUpperCase();
          isCorrect = userLetter === correctAnswerText;
        } else {
          // Other types - direct comparison
          isCorrect = userAnswerText.trim().toLowerCase() === correctAnswerText.toLowerCase();
        }
      }

      if (isCorrect) correctCount++;

      return `Q${idx + 1}: ${q.question_text}
    Correct: ${correctAnswerText}
    User: ${userAnswerText}
    Result: ${isCorrect ? '✓' : '✗'}
    Competencies: ${(q.assessed_competencies || []).join(', ')}`;
    }).join('\n\n');

    console.log(`Correct answers: ${correctCount}/${totalQuestions}`);

    const actualPercentage = Math.round((correctCount / totalQuestions) * 100);
    console.log(`Calculated percentage: ${actualPercentage}%`);

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
      model: 'gemini-flash-latest'
    });

    const prompt = `Expert educator for ${courseCode} at ${school}. Analyze diagnostic performance using curriculum map to predict grade as if you were teaching this course.

STUDENT INFORMATION:
- Name: ${studentName || 'Student'}
- Course: ${courseCode} at ${school}
- Actual Score: ${correctCount} out of ${totalQuestions} questions correct
- Actual Percentage: ${actualPercentage}%

${curriculumContext}

ACTUAL STUDENT RESPONSES (ANALYZE THESE EXACTLY):
${questionContext}

YOUR TASK: Analyze the ACTUAL performance data above and return ONLY valid JSON (no markdown, no tables, no extra text).

Prediction Algorithm:
1) Per-item scoring: base=1.0(correct) or 0.0(wrong). Apply difficulty: Easy×1.0, Moderate×1.2, Challenging×1.5.
2) Calculate: (total_weighted_correct / total_weighted_possible) × 100 = percentage.
3) Map to grade: A+(97-100), A(93-96), A-(90-92), B+(87-89), B(83-86), B-(80-82), C+(77-79), C(73-76), C-(70-72), D+(67-69), D(63-66), D-(60-62), F(0-59).
4) Confidence: (answered/total × 50) + 30. Range: [30,80]. Level: <50="Medium", ≥50="High".
5) Users should never get 0% or 100%. Grade the work as if you were a teacher at their school. 
6) Round to the nearest whole number, no decimals. 

Confidence Level: Given users are only given 5 questions and relevancy is dependant on type of course and if they uploaded material. We need to be careful with confidence. 
Confidence should be outputted as a percentage between 20-65%. Put yourself in the shoes of a teacher for ${courseCode} at ${school}. 

Competency Analysis (use curriculum map[${curriculumContext}]):
- Map wrong answers to curriculum competencies
- Weight by assessment_weightings (e.g., "Final Paper - 40%" = higher impact)
- Match preview question to assessment_formats style
- Reference high_yield_focal_points for weak areas

Weak Areas Requirements:
- Identify 3 specific topics from WRONG answers
- Align with curriculum competencies if available
- Calculate grade_impact based on assessment weights
- Assign tool: Conceptual→"Teach It Cards", Application→"Practice Questions", Complex→"AI Tutor"

Preview Question:
- Test the #1 weak area (highest impact)
- Match course assessment format if curriculum available
- Different question than diagnostic
- Include complete model answer

Grade Trajectory Rules (CRITICAL - MUST BE REALISTIC):
Based on starting percentage, calculate realistic weekly improvements:
- If 0-30% (F): +8-12% per week max (Week 1→D-, Week 2→D+, Week 3→C)
- If 31-50% (F/D): +10-15% per week (Week 1→D, Week 2→C-, Week 3→C+)
- If 51-70% (D/C): +8-12% per week (Week 1→C+, Week 2→B-, Week 3→B)
- If 71-85% (C/B): +5-10% per week (Week 1→B, Week 2→B+, Week 3→A-)
- If 86-95% (B/A): +3-5% per week (Week 1→A-, Week 2→A, Week 3→A+)
- If 96-100% (A+): Already at peak, focus on maintenance

DO NOT promise A+ from F in 3 weeks. Be realistic based on ACTUAL starting grade.

Personalized Message Rules:
- Line 1: Use ACTUAL calculated percentage (not placeholder)
- Line 2: Reference realistic target based on starting grade (if F→aim for C, not A+)
- Line 3: Encouraging reframe appropriate to their situation



REQUIRED JSON OUTPUT (respond with ONLY this JSON, nothing else):

{
  "predicted_grade": "string (e.g. B-, A, F)",
  "predicted_percentage": ${actualPercentage},
  "confidence_level": "string with % (e.g. 60%)",
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

Critical Rules:
- Use ACTUAL score for percentage (don't default to 80%)
- Grade trajectory MUST be realistic based on starting grade
- Week-to-week improvements follow the ranges above
- If starting F (0-59%), target C or B max (not A+)
- If starting D (60-69%), target B or B+ max
- If starting C (70-79%), target A- or A max
- Personalized message line 2 must reference realistic target
- Severity levels: "critical" (for F/D students), "high", "medium", "low"
- Weak areas must match WRONG answers
- Use curriculum competencies if available`;

    console.log("Sending request to Gemini...");
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
    console.log("Raw Gemini response (first 500 chars):", text.substring(0, 500));
    
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
      console.log("Successfully parsed JSON response");
      console.log("Predicted grade:", parsed.predicted_grade);
      console.log("Predicted percentage:", parsed.predicted_percentage);
    } catch (parseError) {
      console.error("Failed to parse AI response:", parseError.message);
      console.error("Raw text:", text.substring(0, 500));
      return Response.json({ 
        error: 'Failed to parse grading response', 
        details: parseError.message,
        raw_response: text.substring(0, 500)
      }, { status: 500 });
    }

    console.log("=== gradeDiagnosticExam COMPLETED SUCCESSFULLY ===");
    return Response.json({
      success: true,
      ...parsed
    });

  } catch (error) {
    console.error('=== ERROR in gradeDiagnosticExam ===');
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    return Response.json({ 
      error: error.message || 'Failed to grade diagnostic exam' 
    }, { status: 500 });
  }
});