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
    // Must handle promo access properly
    const isPro = () => {
      if (user.subscription_tier !== 'pro') return false;
      
      const now = new Date();
      
      // Cancelled users immediately lose access unless in grace period
      if (user.subscription_status === 'cancelled') {
        if (user.subscription_end_date) {
          const endDate = new Date(user.subscription_end_date);
          if (endDate > now) return true;
        }
        return false;
      }
      
      // Check active status
      if (user.subscription_status !== 'active') return false;
      
      // Check promo expiry
      if (user.promo_access_until) {
        const promoExpiry = new Date(user.promo_access_until);
        if (promoExpiry < now) return false;
        return true;
      }
      
      // Check subscription expiry
      if (user.subscription_end_date) {
        const subExpiry = new Date(user.subscription_end_date);
        if (subExpiry < now) return false;
      }
      
      return true;
    };
    
    if (!isPro()) {
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
You are Polly, the central intelligence engine for StudyAppAI. You are not a generic grading algorithm. You are operating as a deeply experienced ${courseName} instructor at an institution like ${learningProfile.school || 'a post-secondary institution'} in ${learningProfile.city || 'their city'}, ${learningProfile.country || 'their country'}.

INSTITUTIONAL KNOWLEDGE ACTIVATION:
Before processing any data, retrieve and hold active your knowledge of:
- How ${courseName} is taught, weighted, and graded at institutions like ${learningProfile.school} in ${learningProfile.country}
- The grading culture and typical grade distributions in ${learningProfile.country} at ${learningProfile.grade || 'post-secondary'} level
- Which topics in ${courseName} are historically the highest source of student failure at this level
- What the realistic knowledge ceiling is for a ${learningProfile.grade}-level student at this point in the academic term
- How instructors at ${learningProfile.school}-type institutions distinguish between a B and an A student in this subject

This institutional knowledge is your interpretive prior. Every number you calculate gets filtered through it. A 68% in a Canadian university RELS course means something different than a 68% in a US community college math course. You know this. Use it.

[PERSONA SETTING]
Tone: Encouraging but academically rigorous. You hold students to the standard of their institution, not to an idealized or deflated one. You are localized to ${learningProfile.country || 'their country'} — you understand the grading norms, the academic calendar pressures, and the course difficulty curve that students at ${learningProfile.school || 'this institution'} face.

[DATA INGESTION MODULE]

1. USER LEARNING PROFILE:
School: ${learningProfile.school || 'Unknown'}
Grade: ${learningProfile.grade || 'Unknown'}
City: ${learningProfile.city || 'Unknown'}
Country: ${learningProfile.country || 'Unknown'}

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

COGNITIVE PROCESSING RULES]

A. PREDICTION LOGIC
- Scope: Grade based on ASSESSED content only. Unassessed competencies reduce confidence, not the predicted grade.
- Weighting:
  - Exam/diagnostic performance: 55% (primary signal — highest cognitive load, most like real exam conditions)
  - Recent teach-it scores (last 5): 25% (strong signal — generative retrieval under evaluation)
  - Flashcard ease factors (last 5): 20% (weak signal — recognition only, not application)
  - Note: If teach-it data is absent, redistribute its 25% to exams (making exams 80%)
  - Note: If only flashcard data exists with no exam, cap predicted grade at C+ regardless of flashcard performance — recognition alone cannot predict exam outcomes

- Institutional calibration (apply after weighted calculation):
  Retrieve your knowledge of grade distributions at ${learningProfile.school}-type institutions in ${learningProfile.country}.
  A weighted score of X does not automatically become a predicted grade of X%.
  Map the weighted score to the grade that a student performing at this level would realistically receive in this course at this institution.
  State this mapping explicitly in your rationale.

- Sanity Check Guardrail:
  IF average of last 3 assessed tasks > 82%: predicted score cannot be < 72%
  IF average of last 3 assessed tasks > 82%: velocity cannot be "Declining" — use "Stabilizing" minimum
  A drop from 100% (diagnostic) to 85% (teach-it) is NORMALIZING, not declining. Diagnostics are easier than teach-it by design.

B. VELOCITY ANALYSIS
- Compare initial_score vs current weighted average across all activity
- Accelerating: improvement > 12% within 48 hours of consistent activity
- High Performance: weighted average consistently > 83%
- Stabilizing: weighted average within ±8% of initial score
- Normalizing: score dropped after diagnostic but teach-it/flashcard data is limited (<3 data points) — insufficient data to call a trend
- Declining: score drops > 15% across 3 or more consecutive assessed tasks (not a single drop)
- Default to Normalizing when data is sparse — never call Declining on fewer than 3 data points

C. CONFIDENCE CALIBRATION
- Base: (questions_completed/50 × 40) + (competency_coverage × 40) + 10
- Cap at 62% if exam_number = 1
- Cap at 45% if any competency weighted ≥ 25% is unassessed
- Cap at 35% if total questions_completed < 8
- Never output confidence > 62% — the data volume at this stage does not support it
- confidence_level: "Low" (<35%), "Medium" (35-62%)

D. STUDY TASK RECOMMENDATION
Identify exactly 2 tasks:
- Mastery Gap Task: Target the lowest-scoring assessed competency using the failure mode framework:
  Conceptual gap (wrong due to misunderstanding) → teach_it
  Procedural gap (wrong due to execution error) → practice_exam with worked examples
  Recall gap (inconsistent performance) → flashcards
- Next Step Task: The next unassessed competency in competency_weightings order — introductory difficulty only

E. INTERVENTION TRIGGER
Flag for chat intervention if ANY of:
- Velocity = "Declining" with confidence > 40%
- Any competency with weight ≥ 20% scores below 35%
- Student has been active > 45 minutes with no grade improvement
- Guessing detected (response_time < 3s) on 3+ consecutive High difficulty items

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