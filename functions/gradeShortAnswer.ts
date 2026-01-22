import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
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

        if (!question_text || !student_answer || !explanation) {
            return Response.json({ 
                error: 'Missing required fields'
            }, { status: 400 });
        }

        const apiKey = Deno.env.get("GEMINIAPIKEY");
        if (!apiKey) {
            return Response.json({ error: 'Service configuration error' }, { status: 500 });
        }

        const systemPrompt = `You are a teacher grading a single SHORT or LONG answer.

Grade fairly and proportionally using:
- the exemplar explanation (authoritative intent),
- the assessed_competencies (key ideas),
- and the student’s demonstrated understanding.

Do NOT require word-for-word matching.
Award partial credit whenever the student shows correct reasoning, even if phrased differently or incomplete.

INPUT
You will receive a JSON object with:
question_text, question_type, difficulty_index,
correct_answer, explanation, assessed_competencies,
targeted_misconception, student_answer,
student_grade_level, course_name.

FORMAT & SEMANTIC TOLERANCE (CRITICAL)
- Treat answers with the same meaning as equivalent, regardless of wording or structure.
- Ignore capitalization, punctuation, and extra spacing.
- For numbers:
  • Strip currency symbols and commas
  • Treat “30” and “$30” as equivalent where context implies currency
  • Treat “50” and “50%” as equivalent where context implies percentage
- Deduct ONLY if meaning is changed (e.g., wrong units, sign error, incorrect reasoning).

GRADING RULES
- Focus on conceptual accuracy and reasoning, not phrasing.
- Use difficulty_index only to scale expectations (be reasonable, not harsh).
- If the student addresses some—but not all—required ideas, award partial credit.
- If a known misconception appears, reflect it in the score.

SCORING GUIDE
- 9–10: Conceptually correct and well-reasoned
- 7–8.5: Mostly correct, minor gaps
- 4–6.5: Partial understanding
- 1–3.5: Minimal but relevant attempt
- 0: Incorrect or off-topic

OUTPUT
Return ONLY this JSON:
{
  "score_out_of_10": number (0–10, one decimal allowed),
  "verdict": "Correct" | "Partially Correct" | "Incorrect",
  "rationale_short": "One concise sentence explaining the score",
  "keypoints_hit": ["brief phrase", "..."],
  "keypoints_missed": ["brief phrase", "..."],
  "misconception_detected": true | false
}
CONSTRAINTS
• Be consistent and proportional: full coverage and correct reasoning ≈ 9–10; solid but incomplete ≈ 7–8.5; partial/fragmentary ≈ 4–6.5; minimal/relevant fragments ≈ 1–3.5; off-topic/incorrect = 0.
• Format tolerance: If the student's answer is semantically correct but formatted differently (e.g., "$30" vs "30" for a price question), award 9-10 points, not 0.
• Keep language age-appropriate for the student_grade_level.
• Do not include extra commentary, markdown, or text outside the JSON.`;

        const gradingData = {
            question_text,
            question_type,
            difficulty_index,
            correct_answer: correct_answer || 'N/A',
            explanation,
            assessed_competencies: assessed_competencies || [],
            targeted_misconception: targeted_misconception || 'N/A',
            student_answer,
            student_grade_level,
            course_name
        };

        const userMessage = `<JSON>\n${JSON.stringify(gradingData, null, 2)}\n</JSON>`;

        const requestBody = {
            contents: [
                {
                    role: "user",
                    parts: [{ text: systemPrompt }]
                },
                {
                    role: "model",
                    parts: [{ text: "I understand. Please provide the grading data." }]
                },
                {
                    role: "user",
                    parts: [{ text: userMessage }]
                }
            ],
            generationConfig: {
                temperature: 0.2,
                topP: 0.95,
                maxOutputTokens: 2048,
                responseMimeType: "application/json",
                responseSchema: {
                    type: "object",
                    properties: {
                        score_out_of_10: { 
                            type: "number"
                        },
                        verdict: { 
                            type: "string",
                            enum: ["Correct", "Partially Correct", "Incorrect"]
                        },
                        rationale_short: { 
                            type: "string"
                        },
                        keypoints_hit: {
                            type: "array",
                            items: { type: "string" }
                        },
                        keypoints_missed: {
                            type: "array",
                            items: { type: "string" }
                        },
                        misconception_detected: {
                            type: "boolean"
                        }
                    },
                    required: ["score_out_of_10", "verdict", "rationale_short", "keypoints_hit", "keypoints_missed", "misconception_detected"]
                }
            },
            safetySettings: [
                { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_LOW_AND_ABOVE" },
                { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_LOW_AND_ABOVE" },
                { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_LOW_AND_ABOVE" },
                { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_LOW_AND_ABOVE" }
            ]
        };

        // Use AbortController for timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 25000);
        
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody),
                signal: controller.signal
            }
        );
        
        clearTimeout(timeoutId);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Gemini API error:', response.status, errorText);
            return Response.json({ 
                error: 'Failed to grade answer',
                details: errorText.substring(0, 200)
            }, { status: 500 });
        }

        const data = await response.json();
        const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text;
        
        if (!generatedText) {
            console.error('No text generated from Gemini:', JSON.stringify(data));
            return Response.json({ 
                error: 'No grading result generated',
                details: data.candidates?.[0]?.finishReason || 'unknown'
            }, { status: 500 });
        }

        try {
            const parsedResponse = JSON.parse(generatedText);
            return Response.json(parsedResponse);
        } catch (parseError) {
            return Response.json({ 
                error: 'Failed to process grading result' 
            }, { status: 500 });
        }

    } catch (error) {
        // Handle timeout specifically
        if (error.name === 'AbortError') {
            console.error('gradeShortAnswer timeout');
            return Response.json({ 
                score_out_of_10: 5,
                verdict: "Partially Correct",
                rationale_short: "Grading timed out - partial credit given",
                keypoints_hit: [],
                keypoints_missed: [],
                misconception_detected: false
            });
        }
        console.error('gradeShortAnswer error:', error.message);
        return Response.json({ 
            error: 'Internal server error',
            details: error.message
        }, { status: 500 });
    }
});