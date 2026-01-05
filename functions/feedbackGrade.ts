import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    console.log('=== feedbackGrade Function Start ===');
    try {
        const base44 = createClientFromRequest(req);
        console.log('✅ Base44 client created');
        
        const user = await base44.auth.me();
        console.log('✅ User authenticated:', user?.email);

        if (!user) {
            console.error('❌ Authentication failed - no user');
            return Response.json({ error: 'Unauthorized', code: 'AUTH_001' }, { status: 401 });
        }

        const { examNumber, examPerformanceData, curriculumMap, learningProfile, courseName, response_json_schema } = await req.json();
        console.log('✅ Request body parsed');
        console.log('📝 Exam number:', examNumber);
        console.log('📝 Performance data items:', examPerformanceData?.length);
        console.log('📋 Schema provided:', !!response_json_schema);

        if (!examPerformanceData || !curriculumMap) {
            console.error('❌ Missing required data');
            return Response.json({ error: 'Performance data and curriculum map are required', code: 'PARAM_001' }, { status: 400 });
        }

        const apiKey = Deno.env.get("API_KEY");
        if (!apiKey) {
            console.error('❌ CRITICAL: API_KEY not found in environment');
            return Response.json({ error: 'Service configuration error', code: 'CONFIG_001' }, { status: 500 });
        }
        console.log('✅ API key found');

        // Build the feedback prompt
        const curriculumStr = JSON.stringify(curriculumMap, null, 2);
        const performanceStr = JSON.stringify(examPerformanceData, null, 2);
        
        const prompt = `You are an expert educator for ${courseName} (grade: ${learningProfile.grade || "N/A"}). Analyze the student's exam performance and predict their final exam grade.

Student Grade: ${learningProfile.grade || "N/A"}
Course: ${courseName}
Exam: ${examNumber} of 6

Curriculum:
${curriculumStr}

Performance:
${performanceStr}

Each worksheet item may include:
question_number, question_type, difficulty_index, question_text,
options, student_answer, correct_answer, explanation,
assessed_competencies[], targeted_misconception, is_correct,
ai_grading { score_out_of_10, verdict, rationale, keypoints_hit[], keypoints_missed[] }.
Ignore missing fields; do not invent values.

────────────────────────────────
INTERNAL SCORING LOGIC (DO NOT OUTPUT)

Edge Handling (must be deterministic)
- If correct_count = 0/10 → predicted_exam_score_percentage = "Not Calculable" (insufficient baseline); still produce strengths/weaknesses + plan.
- If correct_count = 10/10 → still compute; cap realism at 95–100 unless evidence suggests weaker explanations/partial-credit patterns.

1) Item Mastery Score (bounded, teacher-realistic)
For each item, compute mastery ∈ [0.05, 0.98] using:
- correctness (primary)
- partial credit if ai_grading exists (strong secondary)
- difficulty_index (harder correct = higher mastery; harder wrong = lower mastery)
- misconception penalty if targeted_misconception present and wrong
- explanation quality signal: if ai_grading verdict ≠ "Correct" OR keypoints_missed non-empty → reduce mastery slightly
Do NOT over-reward lucky correctness: if correct but ai_grading shows weak rationale/low score, keep mastery moderate.

2) Competency Mastery
For each curriculum competency:
- mastery = mean(item mastery for items tagged with that competency)
- if competency unassessed → set 0.50 and mark as low-evidence internally

3) Weighted Aggregate (curriculum-aligned)
- Parse curriculum competency weightings (normalize to sum=1)
- Preliminary = Σ(competency_mastery × weight) × 100

4) Exam-Format Realism Modifier (bounded)
Apply a single bounded modifier in [-8, +4] based on:
- Format mismatch risk: weak performance on high-frequency exam formats (from curriculum_map.question_formats)
- Coverage risk: any competency weight ≥25% with <2 assessed items → reliability penalty
- Consistency: large gap between correctness and ai_grading partial credit/explanations → reduce optimism
Purpose: keep predictions teacher-realistic given only 10 items.

5) Final Prediction
- If not edge case: predicted = round(clamp(Preliminary + Modifier, 0, 100)) + "%"
- Ensure the prediction reflects school-style grading realism (avoid systematic inflation).

────────────────────────────────
PLANNING (DO NOT OUTPUT INTERNAL SIGNALS)
Derive 5 sessions that directly target:
- the bottom 2–3 weighted competencies
- recurring misconceptions (or most damaging misconceptions)
- high-frequency exam formats where the student underperformed
Each session must specify a concrete practice focus (what to drill + what to change).

────────────────────────────────
OUTPUT RULES (STRICT)
Return ONE JSON object with EXACTLY these fields (and no others):

- feedback_session_title: "Exam ${examNumber} Performance & Grade Prediction"
- predicted_exam_score_percentage: string with "%" OR "Not Calculable"
- overall_performance_summary_text: 1–2 sentences (empathetic, teacher-like, clear next focus)
- identified_strengths_list: 2–3 items grounded in observed evidence (competency or format)
- key_areas_for_improvement_list: 2–3 items grounded in observed evidence (competency/misconception/format)
- suggested_future_sessions_plan: 5 objects:
    session_number: ${examNumber + 1} ... ${examNumber + 5}
    session_name: short, specific
    session_focus_description: 1–2 sentences describing what to practice, what to fix, and what "good" looks like

No extra fields. No prose outside JSON. All percentages must be strings.`;

        console.log('📝 Generated prompt length:', prompt.length);

        const requestBody = {
            contents: [{
                parts: [{
                    text: prompt
                }]
            }],
            generationConfig: {
                temperature: 0.1,
                topP: 0.9,
                maxOutputTokens: 8192
            },
            safetySettings: [
                { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_ONLY_HIGH" },
                { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_ONLY_HIGH" },
                { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_ONLY_HIGH" },
                { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_ONLY_HIGH" }
            ]
        };

        if (response_json_schema) {
            requestBody.generationConfig.responseMimeType = "application/json";
            requestBody.generationConfig.responseSchema = response_json_schema;
        }

        console.log('⏳ Calling Gemini API for feedback grading...');
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

        console.log('📥 Gemini API response status:', response.status);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ Gemini API error:', response.status, errorText);
            return Response.json({ 
                error: 'Gemini API error',
                code: 'API_001',
                details: errorText.substring(0, 500)
            }, { status: 502 });
        }

        const data = await response.json();
        console.log('✅ Gemini API response received');
        const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text;
        
        if (!generatedText) {
            console.error('❌ No content generated:', JSON.stringify(data).substring(0, 500));
            return Response.json({ 
                error: 'No content generated',
                code: 'API_002',
                details: 'Empty response from Gemini'
            }, { status: 503 });
        }

        console.log('✅ Generated text extracted, length:', generatedText.length);

        if (response_json_schema) {
            try {
                // Validate JSON completeness before parsing
                if (!generatedText.trim().endsWith('}') && !generatedText.trim().endsWith(']')) {
                    console.error('❌ Incomplete JSON detected - missing closing bracket');
                    console.error('Last 200 chars:', generatedText.slice(-200));
                    return Response.json({ 
                        error: 'Incomplete JSON response from AI',
                        code: 'JSON_001',
                        details: 'Response was truncated or incomplete',
                        textPreview: generatedText.substring(0, 1000)
                    }, { status: 504 });
                }

                const parsedResponse = JSON.parse(generatedText);
                
                // Validate required fields
                const requiredFields = [
                    'feedback_session_title',
                    'predicted_exam_score_percentage',
                    'overall_performance_summary_text',
                    'identified_strengths_list',
                    'key_areas_for_improvement_list',
                    'suggested_future_sessions_plan'
                ];
                
                const missingFields = requiredFields.filter(field => !parsedResponse[field]);
                
                if (missingFields.length > 0) {
                    console.error('❌ Missing required fields:', missingFields);
                    return Response.json({ 
                        error: 'Incomplete feedback data',
                        code: 'JSON_002',
                        details: `Missing fields: ${missingFields.join(', ')}`,
                        partialData: parsedResponse
                    }, { status: 505 });
                }
                
                console.log('✅ JSON parsed successfully');
                console.log('✅ All required fields present');
                console.log('=== feedbackGrade Function Complete ===');
                return Response.json(parsedResponse);
            } catch (parseError) {
                console.error('=== JSON PARSE ERROR ===');
                console.error('Error message:', parseError.message);
                console.error('Error position:', parseError.message.match(/position (\d+)/)?.[1]);
                console.error('Full text length:', generatedText.length);
                console.error('Full text:', generatedText);
                
                return Response.json({ 
                    error: 'Failed to parse JSON response',
                    code: 'JSON_003',
                    details: parseError.message,
                    textPreview: generatedText.substring(0, 1000),
                    textEnd: generatedText.slice(-200)
                }, { status: 506 });
            }
        }

        console.log('=== feedbackGrade Function Complete ===');
        return Response.json({ text: generatedText });

    } catch (error) {
        console.error('❌ CRITICAL ERROR in feedbackGrade:', error.message);
        console.error('Error stack:', error.stack);
        return Response.json({ 
            error: 'Internal server error',
            code: 'INTERNAL_001',
            details: error.message
        }, { status: 507 });
    }
});