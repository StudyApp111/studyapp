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

    const responseSchema = {
      type: "object",
      properties: {
        predicted_grade: { type: "string" },
        predicted_percentage: { type: "number" },
        confidence_level: { type: "string" },
        strong_areas: {
          type: "array",
          items: { type: "string" }
        },
        weak_areas_detailed: {
          type: "array",
          items: {
            type: "object",
            properties: {
              topic: { type: "string" },
              related_competency: { type: "string" },
              severity: { type: "string" },
              grade_impact: { type: "string" },
              assessment_context: { type: "string" },
              recommended_tool: { type: "string" },
              tool_reason: { type: "string" },
              specific_fix: { type: "string" }
            },
            required: ["topic", "severity", "recommended_tool"]
          }
        },
        preview_question: {
          type: "object",
          properties: {
            topic: { type: "string" },
            related_competency: { type: "string" },
            assessment_format: { type: "string" },
            question_text: { type: "string" },
            question_type: { type: "string" },
            correct_answer: { type: "string" },
            why_this_matters: { type: "string" },
            impact_statement: { type: "string" }
          }
        },
        estimated_study_time_days: { type: "number" },
        study_intensity: { type: "string" },
        grade_trajectory: {
          type: "object",
          properties: {
            current: { type: "string" },
            week_1_target: { type: "string" },
            week_1_percentage: { type: "number" },
            week_1_description: { type: "string" },
            week_2_target: { type: "string" },
            week_2_percentage: { type: "number" },
            week_2_description: { type: "string" },
            week_3_target: { type: "string" },
            week_3_percentage: { type: "number" },
            week_3_description: { type: "string" },
            final_target: { type: "string" }
          }
        },
        personalized_message_line1: { type: "string" },
        personalized_message_line2: { type: "string" },
        personalized_message_line3: { type: "string" },
        urgency_timeline: {
          type: "object",
          properties: {
            start_today: { type: "string" },
            wait_5_days: { type: "string" },
            wait_10_days: { type: "string" }
          }
        },
        top_priority_action: { type: "string" },
        toolkit_social_proof: {
          type: "object",
          properties: {
            teach_it_cards: {
              type: "object",
              properties: {
                testimonial: { type: "string" },
                testimonial_author: { type: "string" },
                stats: { type: "string" }
              }
            },
            practice_questions: {
              type: "object",
              properties: {
                testimonial: { type: "string" },
                testimonial_author: { type: "string" },
                stats: { type: "string" }
              }
            },
            ai_tutor: {
              type: "object",
              properties: {
                testimonial: { type: "string" },
                testimonial_author: { type: "string" },
                stats: { type: "string" }
              }
            }
          }
        }
      },
      required: [
        "predicted_grade",
        "predicted_percentage",
        "confidence_level",
        "strong_areas",
        "weak_areas_detailed",
        "preview_question",
        "estimated_study_time_days",
        "study_intensity",
        "grade_trajectory",
        "personalized_message_line1",
        "personalized_message_line2",
        "personalized_message_line3",
        "urgency_timeline",
        "top_priority_action",
        "toolkit_social_proof"
      ]
    };

    const prompt = `Expert educator for ${courseCode} at ${school}. Analyze diagnostic performance using curriculum map to predict grade as if you were teaching this course.

STUDENT INFORMATION:
- Name: ${studentName || 'Student'}
- Course: ${courseCode} at ${school}
- Actual Score: ${correctCount} out of ${totalQuestions} questions correct
- Actual Percentage: ${actualPercentage}%

${curriculumContext}

ACTUAL STUDENT RESPONSES (ANALYZE THESE EXACTLY):
${questionContext}

YOUR TASK: Analyze the ACTUAL performance data above and return ONLY valid JSON matching the provided schema.

Prediction Algorithm:
1) Per-item scoring: base=1.0(correct) or 0.0(wrong). Apply difficulty: Easy×1.0, Moderate×1.2, Challenging×1.5.
2) Calculate: (total_weighted_correct / total_weighted_possible) × 100 = percentage.
3) Map to grade: A+(97-100), A(93-96), A-(90-92), B+(87-89), B(83-86), B-(80-82), C+(77-79), C(73-76), C-(70-72), D+(67-69), D(63-66), D-(60-62), F(0-59).
4) Confidence: (answered/total × 50) + 30. Range: [30,80]. Level: <50="Medium", ≥50="High".
5) EDGE CASES: If 0/5 correct→cap at 15% max (never 0%). If 5/5 correct→cap at 92% max (never 95%+, account for untested material).
6) Round to the nearest whole number, no decimals. 

Confidence Level: Given users are only given 5 questions and relevancy is dependant on type of course and if they uploaded material. We need to be careful with confidence. 
Confidence should be outputted as a percentage between 20-65%. Put yourself in the shoes of a teacher for ${courseCode} at ${school}. 

Competency Analysis (use curriculum map[${curriculumContext}]):
- Map wrong answers to curriculum competencies
- Weight by assessment_weightings (e.g., "Final Paper - 40%" = higher impact)
- Match preview question to assessment_formats style
- Reference high_yield_focal_points for weak areas

Weak Areas Requirements:
- If 0-2 correct: Identify fundamental competencies missing from wrong answers
- If 3-4 correct: Identify specific topics from wrong answers
- If 5/5 correct: Identify 3 high-yield untested topics from curriculum map
- grade_impact: If score >90%→max 10% per weak area. If score <30%→20-25% per area.
- Assign tool: Conceptual→"Teach It Cards", Application→"Practice Questions", Complex→"AI Tutor"

Preview Question:
- Test the #1 weak area (highest impact)
- Match course assessment format if curriculum available
- Different question than diagnostic
- Include complete model answer

Grade Trajectory Rules (CRITICAL - MUST BE REALISTIC):
Based on starting percentage, calculate realistic weekly improvements:
- If 0-30%: +8-12%/week (Week3→C max)
- If 31-50%: +10-15%/week (Week3→C+ max)
- If 51-70%: +8-12%/week (Week3→B max)
- If 71-85%: +5-10%/week (Week3→A- max)
- If 86-95%: +3-5%/week (Week3→A+ max)
- If 96-100%: Should not occur (capped at 92%). If happens, maintain A- (descriptions focus on untested topics).

DO NOT promise A+ from F in 3 weeks. Be realistic based on ACTUAL starting grade.

Personalized Message Rules:
- Line 1: Use ACTUAL calculated percentage (not placeholder)
- Line 2: If 0-30%→"reach C", 31-70%→"reach B", 71-92%→"reach A", 86-92%→"maintain mastery by studying untested topics"
- Line 3: If low→"This is fixable", if high→"Stay sharp on untested material"

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
        responseMimeType: "application/json",
        responseSchema: responseSchema
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