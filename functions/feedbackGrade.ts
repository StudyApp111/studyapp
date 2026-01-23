import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Retry helper with exponential backoff
async function fetchWithRetry(url, options, maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        const response = await fetch(url, options);
        if (response.ok) return response;
        
        if (response.status === 429 && attempt < maxRetries) {
            const waitTime = Math.pow(2, attempt) * 1000;
            console.log(`Rate limited (429), waiting ${waitTime}ms before retry ${attempt + 1}/${maxRetries}`);
            await new Promise(r => setTimeout(r, waitTime));
            continue;
        }
        return response;
    }
}

Deno.serve(async (req) => {
    console.log('=== feedbackGrade Function Start ===');
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { prompt, response_json_schema, exam_id, lesson_id } = await req.json();
        console.log('Exam ID:', exam_id, 'Lesson ID:', lesson_id, 'Prompt provided:', !!prompt);

        // Build prompt internally if exam_id and lesson_id provided
        let finalPrompt = prompt;
        
        if (exam_id && lesson_id && !prompt) {
            const exams = await base44.entities.Exam.filter({ id: exam_id });
            const lessons = await base44.entities.Lesson.filter({ id: lesson_id });
            const exam = exams[0];
            const lesson = lessons[0];
            
            if (!exam || !lesson) {
                return Response.json({ error: 'Exam or lesson not found' }, { status: 400 });
            }

            const profiles = await base44.entities.LearningProfile.filter({ id: user.learning_profile_id });
            const learningProfile = profiles[0] || {};

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

            const grade = learningProfile.grade || "N/A";
            const courseName = lesson.course_name;
            const examNumber = exam.exam_number;
            const curriculumJson = JSON.stringify(lesson.curriculum_map || {}, null, 2);
            const performanceJson = JSON.stringify(examPerformanceData, null, 2);

            finalPrompt = `Act as an Expert Psychometrician and Educator for ${courseName} (grade ${grade}). Your goal is to provide a high-fidelity grade prediction and a defensible "Prediction Confidence Score" based on the statistical rigor of the input data.

[CONTEXT]
Input: Grade ${grade}, ${courseName}, Exam ${examNumber}/6
Curriculum: ${curriculumJson}
Performance: ${performanceJson}

[PREDICTION ALGORITHM]
1) Per-item Analysis: base=0.90(correct) or 0.20. Blend w/ai_grading partial=(score/10). 
   - Multipliers: Correct→High×1.05(cap 0.98), Challenging×1.02(cap 0.96), Moderate×1.01(cap 0.92).
   - Multipliers: Incorrect→High×0.90(floor 0.10), Challenging×0.80(floor 0.08), Moderate×0.70(floor 0.05).
   - Misconception penalty: -0.05/-0.07/-0.09. Clamp [0.05,0.98].
2) Competency Mastery: Mean scores per competency from curriculum_map.core_competencies; if none→0.50.
3) Weighted Aggregate: Σ(mastery×normalized_weight)×100.
4) Adjustment Factors: 
   - Question-type: AvgTypeScore vs frequency. Penalty [-8, +4].
   - Coverage: Competency weight ≥25% & <2 items → -2 each (max -4).

[CONFIDENCE SCORE ALGORITHM (Defensibility Layer)]
Calculate a 'prediction_confidence_percentage' [0-100] using these 3 pillars:
1. Volume (40% weight): score = (items_assessed / 20). Cap at 1.0. (Few items = low confidence).
2. Coverage (40% weight): score = (% of curriculum competencies assessed).
3. Consistency (20% weight): If student gets 'High Difficulty' correct but 'Moderate' incorrect, reduce consistency by 0.5 (indicates guessing/anomaly).
Final Confidence = (Volume * 0.4 + Coverage * 0.4 + Consistency * 0.2) * 100.

[JSON OUTPUT SCHEMA]
{
  "feedback_session_title": "Exam ${examNumber} Performance & Grade Prediction",
  "predicted_exam_score_percentage": "XX%",
  "prediction_confidence_percentage": "XX%",
  "confidence_level": "Low" | "Medium" | "High",
  "mastery_gap": "The #1 competency the user needs to practice to increase both grade and confidence."
}`;
        }

        if (!finalPrompt) {
            return Response.json({ error: 'Prompt is required' }, { status: 400 });
        }

        const apiKey = Deno.env.get("GEMINIAPIKEY");
        if (!apiKey) {
            return Response.json({ error: 'Service configuration error' }, { status: 500 });
        }

        const requestBody = {
            contents: [{ parts: [{ text: finalPrompt }] }],
            generationConfig: {
                temperature: 0.2,
                maxOutputTokens: 16384
            }
        };

        if (response_json_schema) {
            requestBody.generationConfig.responseMimeType = "application/json";
            requestBody.generationConfig.responseSchema = response_json_schema;
        }

        console.log('Calling Gemini API with retry logic...');
        const response = await fetchWithRetry(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody)
            },
            3
        );

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Gemini API error:', response.status, errorText);
            return Response.json({ error: 'API error', details: errorText.substring(0, 200) }, { status: 502 });
        }

        const data = await response.json();
        const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text;
        
        if (!generatedText) {
            return Response.json({ error: 'No content generated' }, { status: 500 });
        }

        if (response_json_schema) {
            try {
                const parsed = JSON.parse(generatedText);
                console.log('=== feedbackGrade Complete ===');
                return Response.json(parsed);
            } catch (e) {
                console.error('JSON parse error:', e.message);
                return Response.json({ error: 'Failed to parse response' }, { status: 500 });
            }
        }

        return Response.json({ text: generatedText });

    } catch (error) {
        console.error('Error:', error.message);
        return Response.json({ error: error.message }, { status: 500 });
    }
});