import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { GoogleGenerativeAI } from 'npm:@google/generative-ai';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    const { school, courseCode, documentContent } = await req.json();

    if (!school || !courseCode) {
      return Response.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    const apiKey = Deno.env.get('GEMINIAPIKEY');
    if (!apiKey) {
      return Response.json({ error: 'API key not configured' }, { status: 500 });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    
    const hasDocumentContent = documentContent && documentContent.trim().length > 0;
    
    // Always use JSON mode for reliable parsing
    const model = genAI.getGenerativeModel({ model: 'gemini-flash-lite-latest' });
    
    // If no document content, do a search call first to gather course context
    let searchContext = '';
    if (!hasDocumentContent) {
      try {
        const searchModel = genAI.getGenerativeModel({
          model: 'gemini-flash-lite-latest',
          tools: [{ googleSearch: {} }]
        });
        const searchResult = await searchModel.generateContent({
          contents: [{ role: 'user', parts: [{ text: `Find the syllabus, typical exam questions, and learning outcomes for the course "${courseCode}" at "${school}". Summarize the key topics, assessment methods, and competencies covered. Be concise.` }] }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 2000 }
        });
        searchContext = searchResult.response.text();
        console.log("Search context length:", searchContext.length);
      } catch (searchErr) {
        console.warn("Search step failed, proceeding without:", searchErr.message);
      }
    }

    const prompt = `You are an expert assessment designer. Generate a 5-question exam-authentic DIAGNOSTIC worksheet for ${courseCode}. 
This exam establishes an accurate learning baseline and must reflect how the course is ACTUALLY assessed.

Do NOT rely on prior diagnostics.

────────────────────────────
Input Context

Course / Unit Name: ${courseCode}
School: ${school}

Content Summary (OCR notes):
${documentContent || 'Not provided'}

${searchContext ? `Research Context (from web search about this course):\n${searchContext}` : ''}

If Content Summary is NOT empty, all questions MUST be grounded in the Content Summary.
If Content Summary is empty but Research Context is provided, ground questions in the Research Context.
If both are empty, rely on general knowledge of the course.

────────────────────────────
Internal Rules (Do NOT Output)

• Topic Lock:
If content specifies a concrete skill/topic (e.g., "factoring", "photosynthesis", "short story analysis"),
ALL questions must stay strictly within it.
Only broaden scope if the user explicitly requests review or exam prep.

• TASK-FORM ENFORCEMENT (CRITICAL):
Questions MUST require the student to PERFORM the skill, not describe it.

Examples:
- English / Humanities:
  Use short passages, excerpts, scenarios, or claims.
  Test analysis, interpretation, or argument by asking the student to respond TO the material.
  DO NOT ask for definitions of literary or analytical terms.

- Math / Sciences:
  Use problems, data, equations, diagrams, or experimental setups.
  DO NOT ask conceptual description-only questions unless the course explicitly assesses them.

- Computer Science / Engineering:
  Use code snippets, logic traces, outputs, or system behavior.
  DO NOT ask “what is” or “explain the concept” unless required by curriculum.

- Business / Economics:
  Use case scenarios, numbers, or decisions.
  DO NOT test abstract definitions without application.

• Difficulty Progression:
Q1–2: Moderate
Q3–4: Challenging
Q5: Challenging → High Challenge (depth, edge cases, or precision—not new content)

────────────────────────────
QUESTION-TYPE RULES (STRICT)

Choose question_type for EACH of the 5 question:
Multiple Choice

• Multiple Choice → EXACTLY 4 options (A–D)

MCQ cue phrases are FORBIDDEN in non-MCQ questions.
If violated, auto-convert to Multiple Choice.

CRITICAL ANSWER FORMAT:
• For Multiple Choice: correct_answer MUST be ONLY the letter (A, B, C, or D) - NOT the full option text

────────────────────────────
Output Requirements

Generate EXACTLY 5 questions.
Each must include:
question_type, question_text, options, difficulty_index

Then include an answer key with:
correct_answer, explanation (MAX 2 sentences explaining to the student why this answer is correct and the others are wrong.),
assessed_competencies, targeted_misconception

Output Format
Return ONE valid JSON object matching the required schema.
No extra text.

{
  "questions": [
    {
      "question_type": "Multiple Choice",
      "question_text": "Question with context if needed",
      "options": ["A. First option", "B. Second option", "C. Third option", "D. Fourth option"],
      "difficulty_index": "Easy",
      "correct_answer": "A",
      "explanation": "Why A is correct. Why B, C, D are wrong.",
      "assessed_competencies": ["Specific competency 1", "Specific competency 2"],
      "targeted_misconception": "Specific common error this tests"
    }
  ]
}

────────────────────────────
Generate 5 authentic ${courseCode} diagnostic questions now.`;

    // Always use JSON mode now - search is done separately
    const generationConfig = {
      temperature: 0.5,
      maxOutputTokens: 16000,
      responseMimeType: "application/json"
    };
    
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig
    });

    const response = result.response;
    const text = response.text();
    
    console.log("Raw response length:", text.length);
    
    let parsed;
    try {
      parsed = JSON.parse(text.trim());
    } catch (parseError) {
      console.error("JSON parse failed:", text.substring(0, 500));
      return Response.json({ error: 'Failed to generate questions. Please try again.' }, { status: 500 });
    }

    return Response.json({
      success: true,
      questions: parsed.questions || []
    });

  } catch (error) {
    console.error('Error generating diagnostic exam:', error);
    return Response.json({ 
      error: error.message || 'Failed to generate diagnostic exam' 
    }, { status: 500 });
  }
});