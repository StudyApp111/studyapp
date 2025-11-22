import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

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

        const apiKey = Deno.env.get("API_KEY");
        if (!apiKey) {
            return Response.json({ error: 'Service configuration error' }, { status: 500 });
        }

        const gradingPrompt = `You are a teacher for ${course_name} at grade ${student_grade_level} grading a student's work.

Grade a single SHORT or LONG answer fairly and succinctly using the provided context.
Base your judgment primarily on the "explanation" (authoritative exemplar) and "assessed_competencies" (key concepts). 
Award partial credit when the student meaningfully covers some—but not all—required ideas or reasoning steps. 
Use "difficulty_index" only to judge expected rigor.

IMPORTANT SAFETY RULES:
• A meaningful, relevant answer MUST NOT receive a score of 0. 
• Only answers that are blank, irrelevant, or nonsense may receive 0.
• If the student's answer directly responds to the question and aligns with the exemplar’s core ideas, score must be ≥8.

INPUT (single JSON object):
{
  "question_text": ${JSON.stringify(question_text)},
  "question_type": "${question_type}",
  "difficulty_index": "${difficulty_index}",
  "correct_answer": ${JSON.stringify(correct_answer || "N/A")},
  "explanation": ${JSON.stringify(explanation)},
  "assessed_competencies": ${JSON.stringify(assessed_competencies || [])},
  "targeted_misconception": "${targeted_misconception || 'N/A'}",
  "student_answer": ${JSON.stringify(student_answer)},
  "student_grade_level": "${student_grade_level}",
  "course_name": "${course_name}"
}

TASK
• Read the question, exemplar explanation, competencies, and the student's answer.
• Judge content accuracy, reasoning soundness, and coverage of key competencies.
• If the targeted misconception appears, reflect that in the score and note it.
• Keep the rationale short (one sentence). Do not reveal a full solution.

CONSTRAINTS
• Be consistent and proportional: full coverage and correct reasoning ≈ 9–10; solid but incomplete ≈ 7–8.5; partial/fragmentary ≈ 4–6.5; minimal/relevant fragments ≈ 1–3.5; off-topic/incorrect = 0.
• Keep language age-appropriate for the student_grade_level.
• Do not include extra commentary, markdown, or text outside the JSON.

OUTPUT
Return ONLY a strict JSON object with these fields:
{
  "score_out_of_10": <number 0–10, allow one decimal>, 
  "verdict": "Correct" | "Partially Correct" | "Incorrect",
  "rationale_short": "<one concise sentence>",
  "keypoints_hit": ["<brief phrase>", "..."],
  "keypoints_missed": ["<brief phrase>", "..."],
  "misconception_detected": true/false
}`;

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