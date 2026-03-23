import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

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
        const gradingPrompt = `You are a teacher for ${course_name} at grade ${student_grade_level} grading a student's work.

Grade a single SHORT or LONG answer fairly and succinctly using the provided context.
Base your judgment primarily on the "explanation" (authoritative exemplar) and "assessed_competencies" (key concepts). 
Award partial credit when the student meaningfully covers some—but not all—required ideas or reasoning steps. 
Use "difficulty_index" only to judge expected rigor (don't explain the rubric math; just be proportionate and reasonable).

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
• Read the question, exemplar explanation, competencies, and the student's answer.
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
• Keep language age-appropriate for the student_grade_level.
• Do not include extra commentary, markdown, or text outside the JSON.`;

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