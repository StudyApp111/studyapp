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
  const startTime = Date.now();
  console.log('🔮 [runPollyEngine] START');
  
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { trigger_event, lesson_id, exam_id } = await req.json();
    console.log(`🔮 [runPollyEngine] Trigger: ${trigger_event}, Lesson: ${lesson_id}`);

    // Check if user is on free tier - skip advanced Polly analysis
    if (user.subscription_tier !== 'pro' || user.subscription_status !== 'active') {
      console.log(`🔮 [runPollyEngine] User is on free tier, skipping advanced analysis`);
      return Response.json({
        success: false,
        reason: 'free_tier',
        message: 'Advanced grade prediction requires Locked In subscription'
      });
    }

    // ========== DATA INGESTION MODULE ==========
    
    // 1. Get Learning Profile
    let learningProfile = {};
    if (user.learning_profile_id) {
      const profiles = await base44.entities.LearningProfile.filter({ id: user.learning_profile_id });
      learningProfile = profiles[0] || {};
    }
    console.log(`🔮 [runPollyEngine] LearningProfile loaded: ${Date.now() - startTime}ms`);

    // 2. Get Lesson Context
    let lesson = null;
    if (lesson_id) {
      const lessons = await base44.entities.Lesson.filter({ id: lesson_id });
      lesson = lessons[0];
    }
    console.log(`🔮 [runPollyEngine] Lesson loaded: ${Date.now() - startTime}ms`);

    if (!lesson) {
      return Response.json({ error: 'Lesson not found' }, { status: 400 });
    }

    // 3. Get All Exams for this Lesson
    const exams = await base44.entities.Exam.filter({ lesson_id });
    const completedExams = exams.filter(e => e.completed);
    const latestExam = completedExams.sort((a, b) => 
      new Date(b.created_date) - new Date(a.created_date)
    )[0];
    console.log(`🔮 [runPollyEngine] Exams loaded (${completedExams.length} completed): ${Date.now() - startTime}ms`);

    // 4. Get Study Plan
    const studyPlans = await base44.entities.StudyPlan.filter({ lesson_id, status: 'active' });
    const studyPlan = studyPlans[0];
    console.log(`🔮 [runPollyEngine] StudyPlan loaded: ${Date.now() - startTime}ms`);

    // 5. Get Flashcards (last 50 active)
    const allFlashcards = await base44.entities.Flashcard.filter({ lesson_id });
    const flashcards = allFlashcards
      .sort((a, b) => new Date(b.updated_date || b.created_date) - new Date(a.updated_date || a.created_date))
      .slice(0, 50);
    console.log(`🔮 [runPollyEngine] Flashcards loaded (${flashcards.length}): ${Date.now() - startTime}ms`);

    // 6. Get TeachIt Cards
    const teachItCards = await base44.entities.TeachItCard.filter({ lesson_id });
    console.log(`🔮 [runPollyEngine] TeachIt loaded (${teachItCards.length}): ${Date.now() - startTime}ms`);

    // ========== BUILD THE ORACLE PROMPT ==========
    
    // Build exam performance data for detailed analysis
    const examPerformanceData = completedExams.map(exam => ({
      exam_id: exam.id,
      exam_type: exam.exam_type,
      exam_number: exam.exam_number,
      total_score: exam.total_score,
      predicted_grade: exam.predicted_grade,
      time_taken_seconds: exam.time_taken_seconds,
      completed_date: exam.updated_date || exam.created_date,
      question_count: exam.questions?.length || 0,
      questions_performance: (exam.questions || []).map((q, i) => ({
        q_num: i + 1,
        is_correct: q.is_correct,
        difficulty: q.difficulty_index,
        type: q.question_type,
        competencies: q.assessed_competencies || [],
        time_seconds: exam.question_time_laps?.find(t => t.question_index === i)?.total_seconds || 0,
        ai_score: q.ai_score_out_of_10,
        misconception: q.targeted_misconception
      }))
    }));

    // Build flashcard performance data
    const flashcardData = flashcards.map(f => ({
      topic: f.topics?.[0] || 'general',
      mastered: f.mastered,
      review_count: f.review_count || 0,
      ease_factor: f.ease_factor || 2.5,
      status: f.status,
      difficulty: f.difficulty
    }));

    // Build teachit performance data
    const teachItData = teachItCards.map(t => ({
      topic: t.topic,
      completed: t.completed,
      mastered: t.mastered,
      score: t.score,
      gaps: t.gaps || [],
      strengths: t.strengths || []
    }));

    const oraclePrompt = `[SYSTEM ROLE]
You are Polly, The Oracle, the central intelligence engine for StudyAppAI. You are the backend brain managing the student's entire learning lifecycle.

Your Goal: Maintain a "Living State" of the user's knowledge, predict their exam outcomes with high defensibility, and determine if intervention via Chat is necessary to alter their trajectory.

[PERSONA SETTING]
- Tone: "Teacher at ${learningProfile.school || 'their school'} in ${learningProfile.city || 'their city'}" (Encouraging, localized to ${learningProfile.country || 'their country'}, strict on mastery).
- Student Context: ${learningProfile.grade || 'Unknown'} level, studying for ${learningProfile.study_type || 'academics'}.

[DATA INGESTION MODULE]

1. USER LEARNING PROFILE:
School: ${learningProfile.school || 'Unknown'}
Grade: ${learningProfile.grade || 'Unknown'}
City: ${learningProfile.city || 'Unknown'}
Country: ${learningProfile.country || 'Unknown'}
Study Type: ${learningProfile.study_type || 'academics'}

2. LESSON CONTEXT:
Course: ${lesson.course_name}
Total Study Time: ${Math.round((lesson.total_study_time_seconds || 0) / 60)} minutes
Core Competencies: ${JSON.stringify(lesson.curriculum_map?.core_competencies?.map(c => c.name) || [])}
Competency Weightings: ${JSON.stringify(lesson.curriculum_map?.competency_weightings || [])}
High Yield Focal Points: ${JSON.stringify(lesson.curriculum_map?.high_yield_focal_points || [])}
Common Misconceptions: ${JSON.stringify(lesson.curriculum_map?.common_misconceptions || [])}

3. EXAM PERFORMANCE DATA (${completedExams.length} completed exams):
${JSON.stringify(examPerformanceData, null, 2)}

4. STUDY PLAN STATE:
${studyPlan ? JSON.stringify({
  initial_predicted_grade: studyPlan.initial_predicted_grade,
  initial_score: studyPlan.initial_score,
  initial_confidence: studyPlan.initial_confidence,
  mastery_gap: studyPlan.mastery_gap,
  weak_competencies: studyPlan.weak_competencies,
  tasks: (studyPlan.tasks || []).map(t => ({
    title: t.title,
    type: t.task_type,
    progress: `${t.completed_count || 0}/${t.target_count}`,
    completed: t.completed
  })),
  competency_progress: studyPlan.competency_progress,
  grade_history: studyPlan.grade_history
}, null, 2) : 'No active study plan.'}

5. FLASHCARD PERFORMANCE (${flashcards.length} cards):
Summary: Mastered=${flashcards.filter(f => f.mastered).length}, Learning=${flashcards.filter(f => f.status === 'learning').length}, New=${flashcards.filter(f => f.status === 'new').length}
Avg Ease Factor: ${flashcards.length > 0 ? (flashcards.reduce((sum, f) => sum + (f.ease_factor || 2.5), 0) / flashcards.length).toFixed(2) : 'N/A'}
Low Ease Cards (<1.5): ${flashcards.filter(f => (f.ease_factor || 2.5) < 1.5).length}
${flashcards.length > 0 ? `Details: ${JSON.stringify(flashcardData.slice(0, 20))}` : ''}

6. TEACH-IT PERFORMANCE (${teachItCards.length} cards):
Summary: Completed=${teachItCards.filter(t => t.completed).length}, Mastered=${teachItCards.filter(t => t.mastered).length}
Avg Score: ${teachItCards.filter(t => t.score).length > 0 ? Math.round(teachItCards.filter(t => t.score).reduce((sum, t) => sum + t.score, 0) / teachItCards.filter(t => t.score).length) : 'N/A'}%
${teachItCards.length > 0 ? `Details: ${JSON.stringify(teachItData)}` : ''}

7. BEHAVIORAL METRICS:
Total XP: ${user.xp || 0}
Level: ${user.level || 1}
Streak: ${user.streak || 0} days
Questions Completed: ${user.questions_completed || 0}
Total Time in App: ${Math.round((user.time_spent_seconds || 0) / 60)} minutes
Daily XP: ${user.daily_xp || 0}

[COGNITIVE PROCESSING RULES]

A. PREDICTION LOGIC (The "Current Mastery" Calculation)
   - **Scope:** Calculate grade based on **Assessed Content ONLY**. Do NOT penalize the grade for topics not yet studied (e.g., if a student has only studied 1 unit but aced it, they have an 'A', not an 'F').
   - **Weighting:** - Recent Micro-Interactions (Last 5 Teach-It/Flashcards): 50% weight (High recency bias).
     - Exams/Diagnostics: 50% weight.
   - **The "Sanity Check" Guardrail:**
     - IF average of last 3 tasks > 80%:
       - Predicted Score CANNOT be < 75%.
       - Velocity CANNOT be "Declining" (It is "Stabilizing" or "High Performance").

B. VELOCITY ANALYSIS (Trend Detection)
   - Compare 'initial_score' vs. 'current_running_average'.
   - If current > 85% consistently -> "Cruising Altitude" (High Performance).
   - If improvement > 10% in < 48h -> "Accelerating".
   - If score drops > 15% across 3 consecutive tasks -> "Declining".
   - **Correction:** A drop from 100% (Diagnostic) to 87% (Teach-It) is NOT "Declining"—it is "Normalizing". Treat this as "Stable".

C. CONFIDENCE CALIBRATION (Defensibility vs. Data Volume)
   - **Base Confidence:** (questions_completed / 50) * 100.
   - **Coverage Impact:** If competency_progress covers < 50% of the map:
     - Cap **Confidence** at 60%. (Do NOT lower the Grade, only the Confidence).
   - **Guessing Penalty:** Only apply -15% confidence penalty if "question_time_laps" < 3s on High Difficulty items.

D. STUDY TASK RECOMMENDATION Identify 2 distinct Study Tasks (Flashcards, Teach-It, Practice Exam, or Review Notes) based on:
- Mastery Gap Task: An intensive task (e.g., Teach-It) targeting the weakest attempted topic.
- Next Step Task: An introductory task (e.g., Practice Exam) for the next logic topic in competency_weightings with 0% progress.

[STRICT JSON OUTPUT - Return ONLY this JSON]`;

    // ========== CALL GEMINI 2.5 PRO ==========
    
    const geminiApiKey = Deno.env.get("GEMINIAPIKEY");
    if (!geminiApiKey) {
      return Response.json({ error: 'Gemini API key not configured' }, { status: 500 });
    }

    console.log(`🔮 [runPollyEngine] Calling Gemini 2.5 Pro: ${Date.now() - startTime}ms`);
    const llmStartTime = Date.now();

    const geminiResponse = await fetchWithRetry(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${geminiApiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: oraclePrompt }] }],
          generationConfig: {
            temperature: 0.3, // Lower temp for more consistent predictions
            maxOutputTokens: 4096,
            responseMimeType: "application/json",
            responseSchema: {
              type: "object",
              properties: {
                engine_state: {
                  type: "object",
                  properties: {
                    predicted_grade_letter: { type: "string" },
                    predicted_score_percent: { type: "number" },
                    prediction_confidence_percent: { type: "number" },
                    current_mastery_gap: { type: "string" },
                    learning_velocity: { type: "string" }
                  },
                  required: ["predicted_grade_letter", "predicted_score_percent", "prediction_confidence_percent"]
                },
                behavioral_insights: {
                  type: "object",
                  properties: {
                    is_guessing_detected: { type: "boolean" },
                    is_inefficient_studying: { type: "boolean" },
                    recommended_focus: { type: "string" },
                    estimated_hours_to_target: { type: "number" }
                  }
                },
                suggested_tasks: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      task_type: { type: "string" },
                      topic_name: { type: "string" },
                      task_description: { type: "string" },
                      task_reason: { type: "string" }
                    }
                  }
                }
              },
              required: ["engine_state", "behavioral_insights", "suggested_tasks"]
            }
          }
        })
      },
      3
    );

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      console.error('🔮 Gemini API error:', errorText);
      return Response.json({ error: 'Failed to run prediction engine' }, { status: 500 });
    }

    const geminiData = await geminiResponse.json();
    const responseText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
    
    // Extract token usage for cost tracking
    const usageMetadata = geminiData.usageMetadata || {};
    const inputTokens = usageMetadata.promptTokenCount || 0;
    const outputTokens = usageMetadata.candidatesTokenCount || 0;
    const totalTokens = usageMetadata.totalTokenCount || inputTokens + outputTokens;
    
    console.log(`🔮 [runPollyEngine] Token usage - Input: ${inputTokens}, Output: ${outputTokens}, Total: ${totalTokens}`);
    
    if (!responseText) {
      return Response.json({ error: 'No response from Polly' }, { status: 500 });
    }

    let pollyResponse;
    try {
      pollyResponse = JSON.parse(responseText);
    } catch (e) {
      console.error('🔮 Failed to parse Polly response:', responseText);
      return Response.json({ error: 'Invalid Polly response' }, { status: 500 });
    }

    console.log(`🔮 [runPollyEngine] Gemini response: ${Date.now() - llmStartTime}ms`);

    // ========== UPDATE USER PREDICTION DATA ==========
    
    const updateData = {
      polly_predicted_grade: pollyResponse.engine_state.predicted_grade_letter,
      polly_predicted_score: pollyResponse.engine_state.predicted_score_percent,
      polly_confidence: pollyResponse.engine_state.prediction_confidence_percent,
      polly_mastery_gap: pollyResponse.engine_state.current_mastery_gap,
      polly_velocity: pollyResponse.engine_state.learning_velocity,
      polly_last_run: new Date().toISOString(),
      polly_next_action: pollyResponse.next_best_action
    };

    await base44.auth.updateMe(updateData);
    console.log(`🔮 [runPollyEngine] User updated: ${Date.now() - startTime}ms`);

    // ========== UPDATE STUDY PLAN WITH NEW PREDICTION ==========
    
    if (studyPlan) {
      const newGradeEntry = {
        date: new Date().toISOString(),
        exam_id: exam_id || null,
        predicted_grade: pollyResponse.engine_state.predicted_grade_letter,
        score: pollyResponse.engine_state.predicted_score_percent,
        confidence: pollyResponse.engine_state.prediction_confidence_percent,
        source: 'polly_engine'
      };

      const updatedHistory = [...(studyPlan.grade_history || []), newGradeEntry];
      
      // Update study plan with all Polly data including the score %
      await base44.entities.StudyPlan.update(studyPlan.id, {
        grade_history: updatedHistory,
        current_predicted_grade: pollyResponse.engine_state.predicted_grade_letter,
        current_score: pollyResponse.engine_state.predicted_score_percent,
        current_confidence: pollyResponse.engine_state.prediction_confidence_percent,
        learning_velocity: pollyResponse.engine_state.learning_velocity,
        mastery_gap: pollyResponse.engine_state.current_mastery_gap,
        suggested_tasks: pollyResponse.suggested_tasks || [],
        behavioral_insights: pollyResponse.behavioral_insights || {},
        last_polly_update: new Date().toISOString()
      });
      console.log(`🔮 [runPollyEngine] StudyPlan updated with grade=${pollyResponse.engine_state.predicted_grade_letter}, confidence=${pollyResponse.engine_state.prediction_confidence_percent}%, velocity=${pollyResponse.engine_state.learning_velocity}: ${Date.now() - startTime}ms`);
    }

    console.log(`🔮 [runPollyEngine] COMPLETE: ${Date.now() - startTime}ms total`);

    return Response.json({
      success: true,
      polly_response: pollyResponse,
      grade_updated: true,
      new_grade: pollyResponse.engine_state.predicted_grade_letter,
      new_score: pollyResponse.engine_state.predicted_score_percent,
      new_confidence: pollyResponse.engine_state.prediction_confidence_percent,
      timing_ms: Date.now() - startTime,
      token_usage: {
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        total_tokens: totalTokens
      }
    });

  } catch (error) {
    console.error("🔮 [runPollyEngine] Error:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});