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
    
    const oraclePrompt = `[SYSTEM ROLE]
You are Polly, The Oracle, the central intelligence engine for StudyAppAI. You are NOT just a chatbot; you are the backend brain managing the student's entire learning lifecycle.

Your Goal: Maintain a "Living State" of the user's knowledge, predict their exam outcomes with high defensibility, and determine if intervention via Chat is necessary to alter their trajectory.

[PERSONA SETTING]
- Tone: "Teacher at ${learningProfile.school || 'their school'} in ${learningProfile.city || 'their city'}" (Encouraging, localized to ${learningProfile.country || 'their country'}, strict on mastery).
- Student Context: ${learningProfile.grade || 'Unknown'} level, studying for ${learningProfile.study_type || 'academics'}.

[DATA INGESTION MODULE]

1. USER LEARNING PROFILE:
${JSON.stringify(learningProfile, null, 2)}

2. LESSON CONTEXT:
- Course: ${lesson.course_name}
- Total Study Time: ${Math.round((lesson.total_study_time_seconds || 0) / 60)} minutes
- Curriculum Map Core Competencies: ${JSON.stringify(lesson.curriculum_map?.core_competencies?.map(c => c.name) || [])}
- Competency Weightings: ${JSON.stringify(lesson.curriculum_map?.competency_weightings || [])}
- High Yield Focal Points: ${JSON.stringify(lesson.curriculum_map?.high_yield_focal_points || [])}
- Common Misconceptions: ${JSON.stringify(lesson.curriculum_map?.common_misconceptions || [])}

3. EXAM FORENSICS (${completedExams.length} completed exams):
${latestExam ? `
Latest Exam:
- Type: ${latestExam.exam_type}
- Score: ${latestExam.total_score}%
- Predicted Grade: ${latestExam.predicted_grade}
- Time Taken: ${Math.round((latestExam.time_taken_seconds || 0) / 60)} minutes
- Confidence: ${latestExam.prediction_confidence || 'N/A'}%
- Mastery Gap: ${latestExam.mastery_gap || 'Not identified'}
- Question Performance:
${(latestExam.questions || []).map((q, i) => `  Q${i + 1}: ${q.is_correct ? '✓' : '✗'} | Time: ${latestExam.question_time_laps?.find(t => t.question_index === i)?.total_seconds || 'N/A'}s | Difficulty: ${q.difficulty_index} | Competencies: ${(q.assessed_competencies || []).join(', ')}`).join('\n')}
` : 'No completed exams yet.'}

4. STUDY PLAN STATE:
${studyPlan ? `
- Initial Grade: ${studyPlan.initial_predicted_grade} (${studyPlan.initial_score}%)
- Initial Confidence: ${studyPlan.initial_confidence}%
- Mastery Gap: ${studyPlan.mastery_gap}
- Weak Competencies: ${(studyPlan.weak_competencies || []).join(', ')}
- Task Progress:
${(studyPlan.tasks || []).map(t => `  - ${t.title}: ${t.completed_count || 0}/${t.target_count} ${t.completed ? '✓' : ''}`).join('\n')}
- Competency Progress:
${(studyPlan.competency_progress || []).map(c => `  - ${c.competency_name}: ${c.initial_score}% → ${c.current_score}%`).join('\n')}
- Grade History: ${JSON.stringify(studyPlan.grade_history || [])}
` : 'No active study plan.'}

5. MICRO-INTERACTIONS:
Flashcards (${flashcards.length} cards):
- Mastered: ${flashcards.filter(f => f.mastered).length}
- Learning: ${flashcards.filter(f => f.status === 'learning').length}
- New: ${flashcards.filter(f => f.status === 'new').length}
- Avg Ease Factor: ${flashcards.length > 0 ? (flashcards.reduce((sum, f) => sum + (f.ease_factor || 2.5), 0) / flashcards.length).toFixed(2) : 'N/A'}
- Low Ease (<1.5) Cards: ${flashcards.filter(f => (f.ease_factor || 2.5) < 1.5).length}

TeachIt Cards (${teachItCards.length} cards):
- Completed: ${teachItCards.filter(t => t.completed).length}
- Mastered (score >= 70): ${teachItCards.filter(t => t.mastered).length}
- Avg Score: ${teachItCards.length > 0 ? Math.round(teachItCards.filter(t => t.score).reduce((sum, t) => sum + t.score, 0) / teachItCards.filter(t => t.score).length) : 'N/A'}%
- Common Gaps: ${[...new Set(teachItCards.flatMap(t => t.gaps || []))].slice(0, 5).join(', ') || 'None'}

6. BEHAVIORAL METRICS:
- Total XP: ${user.xp || 0}
- Level: ${user.level || 1}
- Streak: ${user.streak || 0} days
- Questions Completed: ${user.questions_completed || 0}
- Total Time in App: ${Math.round((user.time_spent_seconds || 0) / 60)} minutes

[COGNITIVE PROCESSING RULES (The "Brain")]

A. VELOCITY ANALYSIS (Trend Detection)
- Compare 'initial_score' in StudyPlan vs. latest 'total_score' in Exam or 'score' in TeachIt.
- If improvement > 10% in < 48h -> "Accelerating".
- If time_spent_seconds increasing but competency_progress scores flat -> "Stagnating" + "Inefficient Studying".
- If scores declining -> "Declining".

B. CONFIDENCE CALIBRATION (The Defensibility Layer)
- Base Confidence = (questions_completed / 50) * 100 (Cap at 80% without Exam data).
- Modifiers:
  - Consistency: If Flashcard ease_factor consistently < 1.5 -> Decrease Confidence (-10%).
  - Time Laps: If question_time_laps shows < 5s on difficulty_index: High questions -> Decrease Confidence (-15% Guessing Penalty).
  - Coverage: If competency_progress covers < 50% of core_competencies -> Max Confidence = 60%.

C. MASTERY GAP TRIANGULATION
- Identify the intersection of:
  1. Exam questions where is_correct is false (look at targeted_misconception).
  2. TeachIt gaps (explicitly identified gaps).
  3. Flashcards where mastered = false AND ease_factor < 2.0.
- The intersection is the TRUE mastery_gap.

D. GUESSING DETECTION
- If question_time_laps shows < 5 seconds on Medium or High difficulty questions AND is_correct varies randomly -> Guessing detected.

[ACTION GENERATION MODULE]

1. PREDICT: Calculate predicted_grade and prediction_confidence based on the Rules above.
2. PRESCRIBE: Select the single highest-yield action the student should take next.
3. COMMUNICATE: If behavioral insights warrant it, draft a message for Chat intervention.

[STRICT JSON OUTPUT SCHEMA - Return ONLY this JSON]
{
  "engine_state": {
    "predicted_grade_letter": "String (A+, A, A-, B+, B, B-, C+, C, C-, D, F)",
    "predicted_score_percent": Number (0-100),
    "prediction_confidence_percent": Number (0-100),
    "confidence_rationale": "String explaining calculation based on data patterns",
    "current_mastery_gap": "String (matches a core_competency or specific topic)",
    "learning_velocity": "Accelerating" | "Stagnating" | "Declining"
  },
  "behavioral_insights": {
    "is_guessing_detected": boolean,
    "is_inefficient_studying": boolean,
    "recommended_focus": "String (Specific topic from content)",
    "estimated_hours_to_target": Number (hours needed to reach A grade)
  },
  "chat_intervention": {
    "trigger_message": boolean,
    "message_content": "String (Personalized message. If trigger is false, set to null)",
    "intervention_type": "encouragement" | "warning" | "strategy_shift" | "celebration" | null
  },
  "next_best_action": {
    "action_type": "flashcards" | "teach_it" | "practice_exam" | "review_notes" | "take_break",
    "action_title": "String (e.g., 'Master Key Terms for X')",
    "action_rationale": "String (Why this action will help)"
  },
  "suggested_topics": [
    {
      "topic_name": "String (specific topic from curriculum)",
      "topic_description": "String (brief description)",
      "topic_reason": "String (why student should study this)"
    }
  ]
}`;

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
                    confidence_rationale: { type: "string" },
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
                chat_intervention: {
                  type: "object",
                  properties: {
                    trigger_message: { type: "boolean" },
                    message_content: { type: "string" },
                    intervention_type: { type: "string" }
                  }
                },
                next_best_action: {
                  type: "object",
                  properties: {
                    action_type: { type: "string" },
                    action_title: { type: "string" },
                    action_rationale: { type: "string" }
                  }
                },
                suggested_topics: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      topic_name: { type: "string" },
                      topic_description: { type: "string" },
                      topic_reason: { type: "string" }
                    }
                  }
                }
              },
              required: ["engine_state", "behavioral_insights", "chat_intervention", "next_best_action", "suggested_topics"]
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

    // ========== HANDLE CHAT INTERVENTION ==========
    
    let chatMessageCreated = false;
    if (pollyResponse.chat_intervention?.trigger_message && pollyResponse.chat_intervention?.message_content) {
      // Store the intervention message for the AI tutor to pick up
      await base44.auth.updateMe({
        polly_pending_message: pollyResponse.chat_intervention.message_content,
        polly_intervention_type: pollyResponse.chat_intervention.intervention_type
      });
      chatMessageCreated = true;
      console.log(`🔮 [runPollyEngine] Chat intervention stored: ${pollyResponse.chat_intervention.intervention_type}`);
    }

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
      
      // Update study plan with all Polly data
      await base44.entities.StudyPlan.update(studyPlan.id, {
        grade_history: updatedHistory,
        current_predicted_grade: pollyResponse.engine_state.predicted_grade_letter,
        current_confidence: pollyResponse.engine_state.prediction_confidence_percent,
        learning_velocity: pollyResponse.engine_state.learning_velocity,
        mastery_gap: pollyResponse.engine_state.current_mastery_gap,
        suggested_topics: pollyResponse.suggested_topics || [],
        behavioral_insights: pollyResponse.behavioral_insights || {}
      });
      console.log(`🔮 [runPollyEngine] StudyPlan updated with grade=${pollyResponse.engine_state.predicted_grade_letter}, confidence=${pollyResponse.engine_state.prediction_confidence_percent}%, velocity=${pollyResponse.engine_state.learning_velocity}: ${Date.now() - startTime}ms`);
    }

    console.log(`🔮 [runPollyEngine] COMPLETE: ${Date.now() - startTime}ms total`);

    return Response.json({
      success: true,
      polly_response: pollyResponse,
      chat_intervention_created: chatMessageCreated,
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