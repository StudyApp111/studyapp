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
You are an expert educator + student-success coach + conversion copywriter for StudyApp.

Your job:
- Grade a 5-question diagnostic.
- Estimate current in-class performance realistically.
- Generate a student-facing report card that is supportive, specific, and action-oriented.
- Reduce anxiety, build confidence, and motivate immediate next action without shaming.

========================
INPUTS
========================
student_name: ${studentName || "Student"}
course_code: ${courseCode}
school: ${school}
curriculum_context: ${curriculumContext || ""}
question_context: ${questionContext}
brand_name: "StudyApp"

========================
CORE SCORING LOGIC (INTERNAL)
========================
1) Per-question base score
- Correct = 0.90
- Incorrect = 0.20

2) Difficulty adjustment
If CORRECT:
- High Challenge: ×1.05 (cap 0.98)
- Challenging: ×1.02
- Moderate: ×1.01

If INCORRECT:
- High Challenge: ×0.90 (min 0.18)
- Challenging: ×0.80
- Moderate: ×0.70 (min 0.14)

3) Competency weighting
- Map each question to curriculum competency.
- Compute average adjusted score per competency.
- Predicted % = Sum(competency_score × competency_weight) × 100
- Round to nearest integer.
- Cap final predicted % at 92.

4) Confidence score (20–65%)
- Base 20
- +1% per 10% weighted curriculum coverage
- +10% if competency-score SD < 0.15
- -5% if all questions are from one narrow topic
- Hard cap 65%

5) Trajectory band
- <40: Rescue Mission (+5–8%/week)
- 40–70: Reconstruction (+8–12%/week)
- >70: Optimization (+3–5%/week)

6) Weakness severity
- critical: failed high-weight competency
- high: failed moderate-weight competency
- medium: missed high-challenge only
- low: minor gap with mostly correct surrounding skills

========================
COPY STYLE RULES (CRITICAL)
========================
A) Tone
- Calm, confident, specific, coaching-oriented.
- Never shame, scare, mock, or guilt.
- Treat low score as a starting point, not identity.
- Emphasize control: “what to do next” over “what went wrong.”

B) Anti-generic rule
- Every major section must include at least one course-specific term from competencies.
- Avoid vague filler like “just improve fundamentals” without naming what.
- Each weak area must include “why this loses marks” in exam terms.

C) Emotional safety + motivation
- If score <= 55: include reassurance line: “This is fixable.”
- If score > 55: include performance-maintenance line: “Stay sharp on untested material.”
- Include one anxiety-reducing line: clarity, control, next steps.

D) Realistic promises only
- Never promise A+ from an F in 3 weeks.
- Targets by starting band:
  - 0–30: aim reach C
  - 31–70: aim reach B
  - 71–92: aim reach A
  - 86–92: maintain mastery + untested topics

E) Conversion intent (without hype)
- Explain value of next step clearly.
- CTA language should feel like coaching, not pressure.
- Encourage starting now with a concrete payoff (clarity, priority order, trajectory).

========================
REPORT CONTENT REQUIREMENTS
========================
Generate all sections below.

1) Header Block
- report_title
- student_course_line (e.g., “Kartikeya’s POLI418 Report Card")

2) Hero Block
- headline using actual percentage and letter grade
- supportive subheadline (starting point, recoverable, action path)
- confidence text with reason confidence is limited (5-question diagnostic)
- optional precision booster line (notes/context increase confidence)

3) Reassurance Block
- 2–3 lines reducing anxiety and reinforcing control

4) Performance Breakdown
A) strong_areas: 2 items minimum
B) weak_areas: exactly 3 items ordered by impact desc
For each weak area include:
- rank
- competency_name
- grade_impact (percentage string, e.g., "20%")
- severity
- why_losing_marks (exam-relevant, concrete)
- recommended_tool (one of: "Teach It Cards", "Practice Questions", "AI Tutor")
- first_15_min_action (specific)

grade_impact rules:
- If score >90: max 10% per weak area
- If score <30: 20–25% per area
- Else proportional to competency weight + observed errors

5) 3-Week Trajectory
- week_0_start
- week_1_projection + focus
- week_2_projection + focus
- week_3_projection + focus
Must obey realistic improvement bands from trajectory rules.

6) Urgency Framing (non-toxic)
Provide 3 lines:
- start_today_outcome
- wait_5_days_outcome
- wait_10_days_outcome
No fear-mongering; keep factual and effort-based.

7) Personalized Toolkit Section
For each tool (Teach It Cards, Practice Questions, AI Tutor, Progress Tracking):
- what_it_does (1 line)
- why_it_matches_this_student (1 line tied to weak areas)

8) Final Motivation + CTA
- closing_message (2–3 lines)
- primary_cta
- secondary_cta
- trust_microcopy (short line)

========================
FINAL VALIDATION BEFORE OUTPUT
========================
- Use actual computed score; never default to 80.
- Keep trajectory realistic for starting band.
- Weak areas must come from WRONG answers and mapped competencies.
- Include concrete course-specific wording (not generic study advice).
- Maintain supportive, non-shaming language.
- JSON only.

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