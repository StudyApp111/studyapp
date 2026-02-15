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

    const totalQuestions = questions.length;
    console.log(`Total questions: ${totalQuestions}`);

    // Build raw context for AI to grade
    const questionContext = questions.map((q, idx) => {
      const userAnswer = userAnswers.find(a => a.question_index === idx);
      return `Q${idx + 1}: ${q.question_text}
    Question Type: ${q.question_type || 'unknown'}
    Correct Answer: ${q.correct_answer}
    User Answer: ${userAnswer?.answer || 'Not answered'}
    Competencies: ${(q.assessed_competencies || []).join(', ')}`;
    }).join('\n\n');

    const curriculumContext = curriculumData ? `
CURRICULUM MAP DATA:
${JSON.stringify(curriculumData, null, 2)}
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
              severity: { type: "string" },
              grade_impact: { type: "string" },
              recommended_tool: { type: "string" },
              specific_fix: { type: "string" }
            },
            required: ["topic", "severity", "grade_impact", "recommended_tool"]
          }
        },
        preview_question: {
          type: "object",
          properties: {
            question_text: { type: "string" },
            question_type: { type: "string" },
            correct_answer: { type: "string" },
            why_this_matters: { type: "string" }
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
            week_2_target: { type: "string" },
            week_2_percentage: { type: "number" },
            week_3_target: { type: "string" },
            week_3_percentage: { type: "number" },
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
                stats: { type: "string" }
              }
            },
            practice_questions: {
              type: "object",
              properties: {
                testimonial: { type: "string" },
                stats: { type: "string" }
              }
            },
            ai_tutor: {
              type: "object",
              properties: {
                testimonial: { type: "string" },
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
        "estimated_study_time_days",
        "grade_trajectory",
        "personalized_message_line1",
        "personalized_message_line2",
        "personalized_message_line3",
        "top_priority_action"
      ]
    };

    const prompt = `Expert educator for ${courseCode} at ${school}. Grade this diagnostic and predict exam performance.

Student: ${studentName || 'Student'} | Course: ${courseCode} at ${school}
${curriculumContext}

RESPONSES:
${questionContext}

SCORING: Correct=0.90, Incorrect=0.20. Adjust by difficulty (High Challenge correct×1.05 max 0.98, incorrect×0.90; Challenging correct×1.02, incorrect×0.80; Moderate correct×1.01, incorrect×0.70 min 0.14). Weight by competency. Round to nearest %. Confidence: 20-65% based on coverage/consistency.

WEAK AREAS: Map wrong answers to competencies. grade_impact as percentage string (e.g. "15%"). Tool assignment: Conceptual→"Teach It Cards", Application→"Practice Questions", Complex→"AI Tutor". specific_fix: 2-3 sentence actionable advice for each weak area explaining what the student should practice and why.

TRAJECTORY (realistic): <40%→+5-8%/week max C. 40-70%→+8-12%/week max B. >70%→+3-5%/week. Never promise A+ from F.

MESSAGES: Line1=actual % context. Line2=realistic target. Line3=motivational ("fixable" if low, "stay sharp" if high).

PREVIEW QUESTION: Test #1 weak area, different from diagnostic, include model answer in correct_answer.

top_priority_action: Single sentence describing the most important thing the student should do first.`;

    console.log("Sending request to Gemini...");
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.5,
        maxOutputTokens: 32000,
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