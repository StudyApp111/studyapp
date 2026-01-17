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

        const systemPrompt = `You are a teacher grading a student's work.

Grade a single SHORT or LONG answer fairly and succinctly using the provided context.
Base your judgment primarily on the "explanation" (authoritative exemplar) and "assessed_competencies" (key concepts). 
Award partial credit when the student meaningfully covers some—but not all—required ideas or reasoning steps. 
Use "difficulty_index" only to judge expected rigor (don't explain the rubric math; just be proportionate and reasonable).

The input will be provided as a JSON object containing: question_text, question_type, difficulty_index, correct_answer, explanation, assessed_competencies, targeted_misconception, student_answer, student_grade_level, course_name.

CRITICAL: FORMAT TOLERANCE
• Treat answers with different formatting but identical semantic meaning as equivalent.
• For numerical answers, normalize both the correct answer and student answer before comparison:
  - Strip currency symbols ($, €, £, ¥, etc.)
  - Remove commas in numbers (1,000 → 1000)
  - Strip percentage signs if both answers contain or omit them consistently
  - Ignore leading/trailing whitespace
  - Treat "30" and "$30" as equivalent for currency questions
  - Treat "50%" and "50" as equivalent for percentage questions if the question context implies percentage
• For text answers, ignore capitalization differences, extra spaces, and minor punctuation variations
• If the normalized student answer matches the normalized correct answer, award full credit (9-10 points)
• Only deduct for formatting if it fundamentally changes the meaning (e.g., decimal placement, sign errors, unit confusion like meters vs. kilometers)

TASK
• Read the question, exemplar explanation, competencies, and the student's answer.
• Normalize both correct_answer and student_answer for format comparison.
• Judge content accuracy, reasoning soundness, and coverage of key competencies.
• If the targeted misconception appears, reflect that in the score and note it.
• Keep the rationale short (one sentence). Do not reveal a full solution.

OUTPUT
Return ONLY a strict JSON object with these fields:
{
  "score_out_of_10": <number 0–10, allow one decimal>, 
  "verdict": "Correct" | "Partially Correct" | "Incorrect",
  "rationale_short": "<one concise sentence explaining why the score was earned>",
  "keypoints_hit": ["<brief phrase>", "..."],
  "keypoints_missed": ["<brief phrase>", "..."],
  "misconception_detected": true/false
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

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody)
            }
        );

        if (!response.ok) {
            return Response.json({ 
                error: 'Failed to grade answer' 
            }, { status: 500 });
        }

        const data = await response.json();
        const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text;
        
        if (!generatedText) {
            return Response.json({ 
                error: 'No grading result generated' 
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
        return Response.json({ 
            error: 'Internal server error' 
        }, { status: 500 });
    }
});