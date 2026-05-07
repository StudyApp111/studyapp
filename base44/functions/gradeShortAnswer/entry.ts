import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        // Try to get user but allow guests (grading doesn't require user context)
        let user = null;
        try {
            user = await base44.auth.me();
        } catch (authError) {
            console.log('ℹ️ No user authentication - proceeding as guest');
        }

        const { 
            question_text,
            question_type,
            difficulty_index,
            correct_answer,
            explanation,
            assessed_competencies,
            targeted_misconception,
            student_answer,
            student_grade_level,
            course_name
        } = await req.json();

        // Validate required fields
        if (!question_text || !student_answer || !explanation) {
            return Response.json({ 
                error: 'Missing required fields',
                required: ['question_text', 'student_answer', 'explanation']
            }, { status: 400 });
        }

        const apiKey = Deno.env.get("API_KEY");
        if (!apiKey) {
            return Response.json({ error: 'API_KEY not configured' }, { status: 500 });
        }

        // Construct the grading prompt
        const gradingPrompt = `You are a fair, generous teacher for ${course_name} at grade ${student_grade_level} grading a student's work.

Your PRIMARY goal: determine whether the student's answer is factually and conceptually CORRECT — not whether it matches the exemplar word-for-word.

GRADING PHILOSOPHY (read carefully):
• The "explanation" is a REFERENCE answer — one valid way to answer. The student's answer does NOT need to match it in length, wording, or structure.
• If the student's answer is factually accurate and addresses the question, award FULL credit (9–10) — even if it is shorter, uses different words, gives equivalent terminology, or omits non-essential detail.
• Synonyms, paraphrases, and equivalent expressions are CORRECT. Examples: "ATP production" = "energy production"; "Calvin cycle" = "light-independent reactions"; "H2O" = "water".
• For Fill-in-the-Blank: accept any answer that means the same thing as the expected term. Minor spelling errors that are clearly the right concept = CORRECT.
• Do NOT penalize brevity. A one-line correct answer earns the same as a paragraph correct answer.
• Only mark down for ACTUAL errors: factually wrong claims, contradictions to course content, or genuinely missing the core concept the question asks about.

INPUT (single JSON object):
{
  "question_text": "${question_text.replace(/"/g, '\\"')}",
  "question_type": "${question_type}",
  "difficulty_index": "${difficulty_index}",
  "correct_answer": "${correct_answer ? correct_answer.replace(/"/g, '\\"') : 'N/A'}",
  "explanation": "${explanation.replace(/"/g, '\\"')}", 
  "assessed_competencies": ${JSON.stringify(assessed_competencies || [])},
  "targeted_misconception": "${targeted_misconception || 'N/A'}",
  "student_answer": "${student_answer.replace(/"/g, '\\"')}",
  "student_grade_level": "${student_grade_level}",
  "course_name": "${course_name}"
}

TASK
1. Identify the CORE concept(s) the question is asking about.
2. Check whether the student's answer correctly conveys that concept — using ANY valid wording.
3. If yes → "Correct" verdict, score 9–10.
4. If the student gets the main idea right but has a small inaccuracy or missing nuance → "Partially Correct" verdict, score 6.5–8.5.
5. If the student is fundamentally wrong, off-topic, or shows the targeted misconception → "Incorrect" verdict, score 0–4.
6. Keep rationale to ONE short sentence. Be encouraging.

OUTPUT
Return ONLY a strict JSON object with these fields:
{
  "score_out_of_10": <number 0–10, allow one decimal>, 
  "verdict": "Correct" | "Partially Correct" | "Incorrect",
  "rationale_short": "<one concise sentence>",
  "keypoints_hit": ["<brief phrase>", "..."],
  "keypoints_missed": ["<brief phrase>", "..."],
  "misconception_detected": true/false
}

SCORING ANCHORS (be generous — when in doubt, score higher):
• Conceptually correct, any wording/length: 9–10 (verdict: Correct)
• Mostly right, minor gap or imprecision: 7–8.5 (verdict: Partially Correct)
• Right idea but significant gap: 5–6.5 (verdict: Partially Correct)
• Wrong concept or off-topic: 0–4 (verdict: Incorrect)

Do not include extra commentary, markdown, or text outside the JSON.`;

        // Call Gemini 2.5 Flash API with JSON schema
        const requestBody = {
            contents: [{
                parts: [{
                    text: gradingPrompt
                }]
            }],
            generationConfig: {
                temperature: 0.2,
                topP: 0.95,
                maxOutputTokens: 2048,
                responseMimeType: "application/json",
                responseSchema: {
                    type: "object",
                    properties: {
                        score_out_of_10: { 
                            type: "number",
                            description: "Score from 0 to 10, allowing one decimal place"
                        },
                        verdict: { 
                            type: "string",
                            enum: ["Correct", "Partially Correct", "Incorrect"]
                        },
                        rationale_short: { 
                            type: "string",
                            description: "One concise sentence explaining the score"
                        },
                        keypoints_hit: {
                            type: "array",
                            items: { type: "string" },
                            description: "What the student did well"
                        },
                        keypoints_missed: {
                            type: "array",
                            items: { type: "string" },
                            description: "What was missing or flawed"
                        },
                        misconception_detected: {
                            type: "boolean",
                            description: "Whether the targeted misconception was present"
                        }
                    },
                    required: ["score_out_of_10", "verdict", "rationale_short", "keypoints_hit", "keypoints_missed", "misconception_detected"]
                }
            }
        };

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody)
            }
        );

        if (!response.ok) {
            const errorData = await response.text();
            console.error('Gemini API Error:', errorData);
            return Response.json({ 
                error: 'Gemini API request failed', 
                details: errorData 
            }, { status: response.status });
        }

        const data = await response.json();
        const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text;
        
        if (!generatedText) {
            console.error('No content generated from Gemini:', data);
            return Response.json({ 
                error: 'No content generated', 
                details: data 
            }, { status: 500 });
        }

        try {
            const parsedResponse = JSON.parse(generatedText);
            
            // Validate the response structure
            if (typeof parsedResponse.score_out_of_10 !== 'number' || 
                !parsedResponse.verdict || 
                !parsedResponse.rationale_short) {
                throw new Error('Invalid response structure from AI');
            }

            return Response.json(parsedResponse);
        } catch (parseError) {
            console.error('Failed to parse JSON:', parseError);
            return Response.json({ 
                error: 'Failed to parse AI response', 
                raw_text: generatedText 
            }, { status: 500 });
        }

    } catch (error) {
        console.error('Error in gradeShortAnswer:', error);
        return Response.json({ 
            error: error.message 
        }, { status: 500 });
    }
});