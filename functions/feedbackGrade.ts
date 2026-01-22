import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

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

        const { prompt, response_json_schema, exam_id, lesson_id } = await req.json();
        console.log('✅ Request body parsed');
        console.log('📝 Prompt length:', prompt?.length);
        console.log('📋 Schema provided:', !!response_json_schema);
        console.log('📋 Exam ID:', exam_id);
        console.log('📋 Lesson ID:', lesson_id);

        // If exam_id and lesson_id provided, build the prompt internally
        let finalPrompt = prompt;
        if (exam_id && lesson_id && !prompt) {
            // Fetch exam and lesson data to build prompt
            const exams = await base44.entities.Exam.filter({ id: exam_id });
            const lessons = await base44.entities.Lesson.filter({ id: lesson_id });
            const exam = exams[0];
            const lesson = lessons[0];
            
            if (!exam || !lesson) {
                return Response.json({ error: 'Exam or lesson not found' }, { status: 400 });
            }

            // Get learning profile
            const profiles = await base44.entities.LearningProfile.filter({ id: user.learning_profile_id });
            const learningProfile = profiles[0] || {};

            // Build exam performance data
            const examPerformanceData = (exam.questions || []).map(q => ({
                question_number: q.question_number,
                question_type: q.question_type,
                difficulty_index: q.difficulty_index,
                question_text: q.question_text,
                options: q.options || [],
                student_answer: q.user_answer || "No answer provided",
                correct_answer: q.correct_answer,
                explanation: q.explanation,
                assessed_competencies: q.assessed_competencies,
                targeted_misconception: q.targeted_misconception,
                is_correct: q.is_correct,
                ai_grading: q.ai_score_out_of_10 !== undefined ? {
                    score_out_of_10: q.ai_score_out_of_10,
                    verdict: q.ai_verdict,
                    rationale: q.ai_rationale_short,
                    keypoints_hit: q.ai_keypoints_hit,
                    keypoints_missed: q.ai_keypoints_missed
                } : null
            }));

            finalPrompt = \`Expert educator for \${lesson.course_name} (grade \${learningProfile.grade || "N/A"}). Analyze exam performance using curriculum map to predict grade as if you were a teacher at this school teaching this course.

Input: Grade \${learningProfile.grade || "N/A"}, \${lesson.course_name}, Exam \${exam.exam_number}/6
Curriculum: \${JSON.stringify(lesson.curriculum_map || {}, null, 2)}
Performance: \${JSON.stringify(examPerformanceData, null, 2)}

Fields: question_number, question_type, difficulty_index, question_text, options, student_answer, correct_answer, explanation, assessed_competencies[], targeted_misconception, is_correct, ai_grading{score_out_of_10, verdict, rationale, keypoints_hit[], keypoints_missed[]}.

Prediction Algorithm:
1) Per-item: base=0.90(correct) or 0.20. Blend w/ai_grading partial=(score/10). Apply difficulty multipliers: Correct→High×1.05(cap 0.98), Challenging×1.02(cap 0.96), Moderate×1.01(cap 0.92); Incorrect→High×0.90(floor 0.10), Challenging×0.80(floor 0.08), Moderate×0.70(floor 0.05). Misconception penalty -0.05/-0.07/-0.09. Clamp [0.05,0.98].
2) Competency mastery: mean scores per competency from curriculum_map.core_competencies; if none→0.50.
3) Weighted aggregate: parse competency_weightings ("30%"→0.30), normalize, Σ(mastery×weight)×100.
4) Question-type adjust: AvgTypeScore vs curriculum_map.question_formats frequency. If <0.40 & ≥30%→-3 to -6; if ≥0.80 & ≥30%→+0 to +2. Cap [-8,+4].
5) Coverage: competency weight≥25% & <2 items→-2 each (max -4); ≥80% assessed→+1 to +2. Cap [-8,+4].
6) Final: round(aggregate+modifier) [0,100]+"%". If 0/10→"Not Calculable".

JSON Output (exact schema):
- feedback_session_title: "Exam \${exam.exam_number} Performance & Grade Prediction"
- predicted_exam_score_percentage: "%"|"Not Calculable"\`;
        }

        if (!finalPrompt) {
            console.error('❌ Missing prompt in request');
            return Response.json({ error: 'Prompt is required', code: 'PARAM_001' }, { status: 400 });
        }

        const apiKey = Deno.env.get("GEMINIAPIKEY");
        if (!apiKey) {
            console.error('❌ CRITICAL: API_KEY not found in environment');
            return Response.json({ error: 'Service configuration error', code: 'CONFIG_001' }, { status: 500 });
        }
        console.log('✅ API key found');

        const requestBody = {
            contents: [{
                parts: [{
                    text: finalPrompt
                }]
            }],
            generationConfig: {
                temperature: 0.2,
                topP: 0.95,
                maxOutputTokens: 16384
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
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`,
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
                
                console.log('✅ JSON parsed successfully');
                console.log('📋 Response fields:', Object.keys(parsedResponse));
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