import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Retry helper with exponential backoff + jitter for rate limits
async function fetchWithRetry(url, options, maxRetries = 4) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const response = await fetch(url, options);
            if (response.ok) return response;
            
            if (response.status === 429 && attempt < maxRetries) {
                const baseWait = Math.pow(2, attempt) * 1000;
                const jitter = Math.random() * baseWait;
                const waitTime = baseWait + jitter;
                console.log(`Rate limited (429), waiting ${Math.round(waitTime)}ms before retry ${attempt + 1}/${maxRetries}`);
                await new Promise(r => setTimeout(r, waitTime));
                continue;
            }
            return response;
        } catch (err) {
            if (attempt === maxRetries) throw err;
            const waitTime = Math.pow(2, attempt) * 1000 + Math.random() * 1000;
            console.log(`Network error, waiting ${Math.round(waitTime)}ms before retry ${attempt + 1}/${maxRetries}`);
            await new Promise(r => setTimeout(r, waitTime));
        }
    }
}

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
            course_name,
            school_name,
            city_name
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

        const schoolContext = school_name ? `at ${school_name}` : '';
        const cityContext = city_name ? `in ${city_name}` : '';
        const locationContext = [schoolContext, cityContext].filter(Boolean).join(' ') || '';
        
        const systemPrompt = `You are a master educator${locationContext ? ` ${locationContext}` : ''}, teaching ${course_name || 'this subject'} at a ${student_grade_level || 'university'} level.

Grade fairly and proportionally using:
- the exemplar explanation (authoritative intent),
- the assessed_competencies (key ideas),
- and the student’s demonstrated understanding.

INPUT
You will receive a JSON object with:
question_text, question_type, difficulty_index,
correct_answer, explanation, assessed_competencies,
targeted_misconception, student_answer,
student_grade_level, course_name.

[SEMANTIC & DOMAIN TOLERANCE]
- SEMANTIC: Treat synonyms as identical. If a student says "the building's skeleton" and the exemplar says "structural framework," award full marks.
- NUMERIC: Award 9.5/10 for correct values with minor formatting or missing units (e.g., '300' vs '$300' or '5.2' vs '5.2m').
- NOTATION: In Stats/Actuarial/Math, accept equivalent notations (e.g., '0.5' vs '1/2').

[GRADING LOGIC]
1. CONCEPT MAPPING: Extract the 'Core Intent' of the exemplar explanation.
2. REASONING TRACEABILITY: Does the student's answer show the *process* or *logic* required by the assessed_competencies?
3. PARTIAL CREDIT: If the student identifies the "What" but misses the "How," award 6.0-7.5/10.

[DEDUCTION HIERARCHY]
- -0.5: Formatting/minor unit omission.
- -1.0 to -2.0: Significant unit error or minor logical step skipped.
- -3.0 to -5.0: Correct answer reached through lucky guessing or flawed logic.
- -5.0+: Fundamental conceptual failure or addressed the wrong question.

[SCORING ANCHORS]
- 9.0-10.0: Conceptually correct; reflects student_grade_level maturity.
- 7.0-8.9: Solid understanding with minor gaps in detail or precision.
- 4.0-6.9: Partial/fragmentary understanding; "Kind of there" logic.
- 0.0-3.9: Irrelevant or fundamentally incorrect.

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
                maxOutputTokens: 4096,
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
                { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_ONLY_HIGH" },
                { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_ONLY_HIGH" },
                { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_ONLY_HIGH" },
                { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_ONLY_HIGH" }
            ]
        };

        // Use retry logic for rate limit handling
        const response = await fetchWithRetry(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody)
            },
            3
        );

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
        console.error('gradeShortAnswer error:', error.message);
        return Response.json({ 
            error: 'Internal server error',
            details: error.message
        }, { status: 500 });
    }
});