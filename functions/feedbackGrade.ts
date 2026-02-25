import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Retry helper with exponential backoff + jitter for rate limits
async function fetchWithRetry(url, options, maxRetries = 4) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const response = await fetch(url, options);
            if (response.ok) return response;
            
            if (response.status === 429 && attempt < maxRetries) {
                // Exponential backoff with jitter: 2-4s, 4-8s, 8-16s, 16-32s
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

            // Count data points for confidence calculation
            const totalQuestions = examPerformanceData.length;
            const answeredQuestions = examPerformanceData.filter(q => q.student_answer && q.student_answer !== "No answer provided").length;
            const competenciesCovered = new Set(examPerformanceData.flatMap(q => q.assessed_competencies || [])).size;
            const totalCompetencies = (lesson.curriculum_map?.core_competencies || []).length || 1;
            
            finalPrompt = `Expert educator for ${courseName} (grade ${grade}). Analyze exam performance using curriculum map to predict grade as if you were a teacher at this school teaching this course.

Input: Grade ${grade}, ${courseName}, Exam ${examNumber}/6
Curriculum: ${curriculumJson}
Performance: ${performanceJson}

Data Points Available:
- Questions answered: ${answeredQuestions}/${totalQuestions}
- Competencies assessed: ${competenciesCovered}/${totalCompetencies}

Fields: question_number, question_type, difficulty_index, question_text, options, student_answer, correct_answer, explanation, assessed_competencies[], targeted_misconception, is_correct, ai_grading{score_out_of_10, verdict, rationale, keypoints_hit[], keypoints_missed[]}.

Prediction Algorithm:
1) Per-item: base=0.90(correct) or 0.20. Blend w/ai_grading partial=(score/10). Apply difficulty multipliers: Correct→High×1.05(cap 0.98), Challenging×1.02(cap 0.96), Moderate×1.01(cap 0.92); Incorrect→High×0.90(floor 0.10), Challenging×0.80(floor 0.08), Moderate×0.70(floor 0.05). Misconception penalty -0.05/-0.07/-0.09. Clamp [0.05,0.98].
2) Competency mastery: mean scores per competency from curriculum_map.core_competencies; if none→0.50.
3) Weighted aggregate: parse competency_weightings ("30%"→0.30), normalize, Σ(mastery×weight)×100.
4) Question-type adjust: AvgTypeScore vs curriculum_map.question_formats frequency. If <0.40 & ≥30%→-3 to -6; if ≥0.80 & ≥30%→+0 to +2. Cap [-8,+4].
5) Coverage: competency weight≥25% & <2 items→-2 each (max -4); ≥80% assessed→+1 to +2. Cap [-8,+4].
6) Final: round(aggregate+modifier) [0,100]+"%". If 0/10→"Not Calculable".

Confidence Calculation (MIN 20% MAX 65%):
- Base confidence = (questions_answered/total_questions * 40) + (competencies_covered/total_competencies * 40) + 20
- Adjust: If exam_number=1 (diagnostic only), cap at 65%. 
- confidence_level: "Low" (<40%), "Medium" (40-65%) 

JSON Output (exact schema):
- feedback_session_title: "Exam ${examNumber} Performance & Grade Prediction"
- predicted_exam_score_percentage: "%"|"Not Calculable"
- prediction_confidence_percentage: number (20-65)
- confidence_level: "Low"|"Medium"|`;
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

        // Always use JSON schema for structured output
        const feedbackSchema = response_json_schema || {
            type: "object",
            properties: {
                feedback_session_title: { type: "string" },
                predicted_exam_score_percentage: { type: "string" },
                prediction_confidence_percentage: { type: "number" },
                confidence_level: { type: "string" },
                mastery_gap: { type: "string" },
                mastery_gap_description: { type: "string" },
                overall_performance_summary_text: { type: "string" },
                identified_strengths_list: { type: "array", items: { type: "string" } },
                key_areas_for_improvement_list: { type: "array", items: { type: "string" } }
            },
            required: ["predicted_exam_score_percentage", "prediction_confidence_percentage", "confidence_level"]
        };
        
        requestBody.generationConfig.responseMimeType = "application/json";
        requestBody.generationConfig.responseSchema = feedbackSchema;

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
        console.log('Gemini response candidates:', data.candidates?.length);
        
        const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text;
        
        if (!generatedText) {
            console.error('No content in response. Full response:', JSON.stringify(data).substring(0, 500));
            return Response.json({ error: 'No content generated', debug: data.candidates?.[0] }, { status: 500 });
        }

        console.log('Generated text length:', generatedText.length);
        console.log('Generated text preview:', generatedText.substring(0, 200));

        try {
            const parsed = JSON.parse(generatedText);
            console.log('Parsed result - score:', parsed.predicted_exam_score_percentage, 'confidence:', parsed.prediction_confidence_percentage);
            console.log('=== feedbackGrade Complete ===');
            return Response.json(parsed);
        } catch (e) {
            console.error('JSON parse error:', e.message);
            console.error('Raw text that failed to parse:', generatedText.substring(0, 300));
            return Response.json({ error: 'Failed to parse response', raw: generatedText.substring(0, 200) }, { status: 500 });
        }

    } catch (error) {
        console.error('Error:', error.message);
        return Response.json({ error: error.message }, { status: 500 });
    }
});