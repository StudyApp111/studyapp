import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

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
        
        // Try to get user but allow guests (grading doesn't require user context for core functionality)
        let user = null;
        let isGuest = false;
        try {
            user = await base44.auth.me();
        } catch (authError) {
            console.log('ℹ️ No user authentication - proceeding as guest');
            isGuest = true;
        }

        const { prompt, response_json_schema, exam_id, lesson_id } = await req.json();
        console.log('Exam ID:', exam_id, 'Lesson ID:', lesson_id, 'Prompt provided:', !!prompt);

        // Build prompt internally if exam_id and lesson_id provided
        let finalPrompt = prompt;
        
        if (exam_id && lesson_id && !prompt) {
            // Use service role for guests
            const entities = isGuest ? base44.asServiceRole.entities : base44.entities;
            
            const exams = await entities.Exam.filter({ id: exam_id });
            const lessons = await entities.Lesson.filter({ id: lesson_id });
            const exam = exams[0];
            const lesson = lessons[0];
            
            if (!exam || !lesson) {
                return Response.json({ error: 'Exam or lesson not found' }, { status: 400 });
            }

            // Get learning profile only for authenticated users
            let learningProfile = {};
            if (user && user.learning_profile_id) {
                try {
                    const profiles = await entities.LearningProfile.filter({ id: user.learning_profile_id });
                    learningProfile = profiles[0] || {};
                } catch (e) {
                    console.warn('Could not load learning profile:', e.message);
                }
            }

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
            
            // Count study activities for this lesson to ground confidence in actual engagement
            let completedStudyActivities = 0;
            let completedStudyPlanTasks = 0;
            let totalExamsCompleted = 0;
            try {
                const entities = isGuest ? base44.asServiceRole.entities : base44.entities;
                const [flashcards, teachItCards, allExams, studyPlans] = await Promise.all([
                    entities.Flashcard.filter({ lesson_id }).catch(() => []),
                    entities.TeachItCard.filter({ lesson_id }).catch(() => []),
                    entities.Exam.filter({ lesson_id }).catch(() => []),
                    entities.StudyPlan.filter({ lesson_id }).catch(() => [])
                ]);
                
                const masteredFlashcards = flashcards.filter(f => f.mastered || f.review_count >= 3).length;
                const completedTeachIt = teachItCards.filter(t => t.completed).length;
                totalExamsCompleted = allExams.filter(e => e.completed).length;
                
                // Each deck of 5+ mastered flashcards = 1 activity, each teach-it = 1 activity
                completedStudyActivities = Math.floor(masteredFlashcards / 5) + completedTeachIt;
                
                // Count completed study plan tasks
                const activePlan = studyPlans.find(p => p.status === 'active');
                if (activePlan?.tasks) {
                    completedStudyPlanTasks = activePlan.tasks.filter(t => t.completed).length;
                }
            } catch (e) {
                console.warn('Could not count study activities:', e.message);
            }
            
            finalPrompt = `You are grading a ${grade}-level ${courseName} exam. Calculate predicted score using the algorithm below. Output JSON only, no explanation.

Performance: ${performanceJson}
Curriculum: ${curriculumJson}
Exam: ${examNumber}/6
Coverage: ${answeredQuestions}/${totalQuestions} questions, ${competenciesCovered}/${totalCompetencies} competencies
Study Activities Completed: ${completedStudyActivities} (flashcard decks mastered + teach-it cards completed)
Study Plan Tasks Completed: ${completedStudyPlanTasks}
Total Exams Completed: ${totalExamsCompleted}

Fields: question_number, question_type, difficulty_index, question_text, options, student_answer, correct_answer, explanation, assessed_competencies[], targeted_misconception, is_correct, ai_grading{score_out_of_10, verdict, rationale, keypoints_hit[], keypoints_missed[]}.

ALGORITHM:

1) Per-item score:
   binary = 0.85 if correct, 0.25 if incorrect
   final_item = (binary × 0.35) + (ai_score/10 × 0.65)
   
   Difficulty adjustment:
   Correct+High: ×1.03, cap 0.95
   Correct+Challenging: ×1.01, cap 0.92
   Incorrect+High: ×0.88, floor 0.15
   Incorrect+Challenging: ×0.78, floor 0.12
   Incorrect+Moderate: ×0.68, floor 0.10
   
   Misconception penalty (only if incorrect AND ai_score < 4):
   High: -0.06, Challenging: -0.04, Moderate: -0.02
   Clamp each item [0.10, 0.95]

2) Competency mastery:
   Mean final_item per competency
   Single-question competency: multiply mastery × 0.65
   Zero-question competency: mark UNASSESSED, exclude from aggregate

3) Weighted aggregate:
   Normalize weights of ASSESSED competencies to sum 1.0
   predicted_score = round(Σ(mastery × normalized_weight) × 100)
   Clamp [0, 100]
   If answeredQuestions < 3: predicted_score = null

4) Confidence (grounded in actual study engagement):
   base = (${answeredQuestions}/${totalQuestions} × 25) + (${competenciesCovered}/${totalCompetencies} × 25) + 15
   activity_bonus = min(${completedStudyActivities}, 4) × 5
   task_bonus = min(${completedStudyPlanTasks}, 3) × 3
   exam_bonus = min(${totalExamsCompleted}, 3) × 4
   confidence = base + activity_bonus + task_bonus + exam_bonus
   
   Caps:
   If answeredQuestions < 3: cap at 35
   If totalExamsCompleted = 1 AND completedStudyActivities = 0: cap at 55
   If any competency weight ≥ 25% is UNASSESSED: cap at 55
   Max confidence: 85
   
   confidence_level:
   Low if < 40
   Medium if 40-64
   Medium-High if 65-79
   High if >= 80

JSON Output (exact schema):
- feedback_session_title: "Exam ${examNumber} Performance & Grade Prediction"
- predicted_exam_score_percentage: "%"|"Not Calculable"
- prediction_confidence_percentage: number (25-85)
- confidence_level: "Low"|"Medium"|"Medium-High"|"High"
- mastery_gap: A short, 2-4 word phrase identifying the specific topic or competency that is the weakest (e.g., "Cellular Respiration"). Do NOT write a sentence.`;
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