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

    const prompt = `
You are an expert educator for ${courseCode} at ${school}. Analyze this 5-question diagnostic using the curriculum map to estimate current in-class performance, then provide supportive, conversion-oriented guidance.

STUDENT INFORMATION
- Name: ${studentName || 'Student'}
- Course: ${courseCode} at ${school}

${curriculumContext}

STUDENT RESPONSES (grade first):
${questionContext}

OUTPUT RULE
Return ONE JSON object only, strictly matching the provided schema. No extra text.

==================================================
PHASE 1 — PROBABILITY-BASED SCORING
1) Per-question base score:
- Correct = 0.90
- Incorrect = 0.20

2) Difficulty adjustment:
If CORRECT:
- High Challenge: ×1.05 (cap 0.98)
- Challenging: ×1.02
- Moderate: ×1.01
If INCORRECT:
- High Challenge: ×0.90 (min 0.18)
- Challenging: ×0.80
- Moderate: ×0.70 (min 0.14)

3) Weighted competency score:
- Group questions by curriculum competency.
- Compute average adjusted score per competency.
- Predicted % = Sum(Competency Score × Competency Weight) × 100

4) Round predicted grade to nearest whole percent (no decimals).

5) Confidence (20–65%):
- Base: 20%
- Coverage: +1% per 10% curriculum weighted coverage
- Consistency: +10% if competency-score SD < 0.15
- Niche penalty: -5% if all questions are narrow-topic
- Hard cap: 65%

==================================================
PHASE 2 — TRAJECTORY & SEVERITY
Trajectory band:
- <40%: "Rescue Mission" (+5–8%/week)
- 40–70%: "Reconstruction" (+8–12%/week)
- >70%: "Optimization" (+3–5%/week)

Weakness severity:
- Critical: failed high-weight competency
- High: failed moderate-weight competency
- Medium: missed high-challenge questions only

==================================================
PHASE 3 — COMPETENCY ANALYSIS
- Map wrong answers to curriculum competencies
- Weight by assessment_weightings (e.g., Final Paper 40%)
- Match preview question style to assessment_formats
- Use high_yield_focal_points for weak areas

==================================================
PHASE 4 — WEAK AREAS REQUIREMENTS
- If 0–2 correct: identify missing fundamental competencies from wrong answers
- If 3–4 correct: identify specific topic gaps from wrong answers
- If 5/5 correct: identify 3 high-yield untested topics from curriculum map

grade_impact format:
- MUST be percentage string (e.g., "15%", "8%")
- If score >90%: max 10% per weak area
- If score <30%: 20–25% per area

Tool assignment:
- Conceptual → "Teach It Cards"
- Application → "Practice Questions"
- Complex → "AI Professor"

==================================================
PHASE 5 — PREVIEW QUESTION
- Target #1 weak area (highest impact)
- Match course assessment format (if available)
- Must differ from diagnostic questions
- Include complete model answer

==================================================
PHASE 6 — REALISTIC GRADE TRAJECTORY CONSTRAINTS (CRITICAL)
Weekly improvement by starting score:
- 0–30%: +8–12%/week (Week 3 max: C)
- 31–50%: +10–15%/week (Week 3 max: C+)
- 51–70%: +8–12%/week (Week 3 max: B)
- 71–85%: +5–10%/week (Week 3 max: A-)
- 86–95%: +3–5%/week (Week 3 max: A+)
- 96–100% should not occur (cap at 92%); if occurs, maintain A- and focus on untested topics

Never promise A+ from F in 3 weeks. Use actual starting grade realism.

==================================================
PHASE 7 — PERSONALIZED MESSAGE RULES
Message must be encouraging, non-shaming, and action-focused.
- Line 1: Use ACTUAL calculated percentage (no placeholder)
- Line 2 target:
  - 0–30% → "reach C"
  - 31–70% → "reach B"
  - 71–92% → "reach A"
  - 86–92% → "maintain mastery by studying untested topics"
- Line 3:
  - low scores → "This is fixable"
  - high scores → "Stay sharp on untested material"
Also include calm-confidence framing (reduce exam anxiety, emphasize clarity and control).

==================================================
PHASE 8 — CRITICAL VALIDATION
- Use computed score (never default 80%)
- Trajectory must match starting grade realism
- Week-to-week gains must follow ranges above
- If starting F (0–59%): target C or B max (not A+)
- If starting D (60–69%): target B or B+ max
- If starting C (70–79%): target A- or A max
- Personalized message line 2 must match realistic target
- Severity labels allowed: "critical", "high", "medium", "low"
- Weak areas must come from WRONG answers
- MUST use curriculum competencies
`;

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