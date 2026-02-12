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
    
    // Conditional model configuration based on whether document content exists
    const hasDocumentContent = documentContent && documentContent.trim().length > 0;
    
    const modelConfig = hasDocumentContent 
      ? {
          model: 'gemini-flash-lite-latest'
          // No tools - using JSON mode instead
        }
      : {
          model: 'gemini-flash-lite-latest',
          tools: [{
            googleSearch: {}
          }]
          // No responseMimeType - can't combine with google search
        };
    
    const model = genAI.getGenerativeModel(modelConfig);

    const prompt = `You are an expert assessment designer. Generate a 5-question exam-authentic DIAGNOSTIC worksheet for ${courseCode}. 
This exam establishes an accurate learning baseline and must reflect how the course is ACTUALLY assessed.

Do NOT rely on prior diagnostics.

────────────────────────────
Input Context

Course / Unit Name: ${courseCode}
School: ${school}

Content Summary (OCR notes):
${documentContent || 'Not provided'}


IF Content Summary is EMPTY, conduct the following first research step. If Content Summary is NOT empty then all questions MUST be grounded in Content Summary and skip the following google searches.

IF Content Summary is EMPTY, you MUST search for:
1. "${courseCode} ${school} syllabus" OR "${courseCode} syllabus"
2. "${courseCode} exam questions" OR "${courseCode} typical assessments"
3. "${courseCode} course outline" OR "${courseCode} learning outcomes"

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

Choose question_type for EACH question:
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

    // Conditional generation config
    const generationConfig = hasDocumentContent
      ? {
          temperature: 0.5,
          maxOutputTokens: 8192,
          responseMimeType: "application/json"
        }
      : {
          temperature: 0.5,
          maxOutputTokens: 8192
          // No responseMimeType when using google search
        };
    
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig
    });

    const response = result.response;
    const text = response.text();
    
    console.log("Raw response length:", text.length);
    
    let parsed;
    
    if (hasDocumentContent) {
      // JSON mode response - should be clean JSON already
      try {
        parsed = JSON.parse(text.trim());
      } catch (parseError) {
        console.error("JSON mode parse failed:", text.substring(0, 500));
        return Response.json({ error: 'Failed to generate questions' }, { status: 500 });
      }
    } else {
      // Google Search response - model may wrap in markdown or add preamble
      // Use regex to extract the JSON object containing "questions" array
      let cleanedText = text;
      
      // Strip markdown code fences first
      const codeBlockMatch = cleanedText.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (codeBlockMatch) {
        cleanedText = codeBlockMatch[1].trim();
      }
      
      // Find the outermost JSON object that contains "questions"
      // Walk through to find matching braces for a complete JSON object
      const jsonStart = cleanedText.indexOf('{"questions"');
      const altStart = jsonStart === -1 ? cleanedText.indexOf('{') : jsonStart;
      
      if (altStart === -1) {
        console.error("No JSON object found in response:", text.substring(0, 500));
        return Response.json({ error: 'Failed to generate questions' }, { status: 500 });
      }
      
      // Count brace depth to find the matching closing brace
      let depth = 0;
      let jsonEnd = -1;
      for (let i = altStart; i < cleanedText.length; i++) {
        if (cleanedText[i] === '{') depth++;
        else if (cleanedText[i] === '}') {
          depth--;
          if (depth === 0) {
            jsonEnd = i;
            break;
          }
        }
      }
      
      if (jsonEnd === -1) {
        // Truncated response - braces never balanced
        console.error("Truncated JSON response (unbalanced braces). Length:", text.length, "Preview:", text.substring(0, 500));
        return Response.json({ error: 'AI response was truncated. Please try again.' }, { status: 500 });
      }
      
      const jsonStr = cleanedText.substring(altStart, jsonEnd + 1);
      
      try {
        parsed = JSON.parse(jsonStr);
      } catch (parseError) {
        console.error("Failed to parse extracted JSON:", jsonStr.substring(0, 500));
        return Response.json({ error: 'Failed to generate questions' }, { status: 500 });
      }
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