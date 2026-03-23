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
  console.log('⏱️ [generateStudyPlan] START');
  
  try {
    const base44 = createClientFromRequest(req);
    
    // Try to get user but allow guests
    let user = null;
    let isGuest = false;
    try {
      user = await base44.auth.me();
      console.log(`⏱️ [generateStudyPlan] Auth check: ${Date.now() - startTime}ms`);
    } catch (authError) {
      console.log('ℹ️ No user authentication - proceeding as guest');
      isGuest = true;
    }

    const body = await req.json();
    const { exam_id, lesson_id, diagnosticData } = body;

    // Handle two scenarios: 
    // 1. Called from onboarding with diagnosticData (no exam_id yet)
    // 2. Called from in-app with exam_id
    let exam = null;
    let examQuestions = [];
    let predictedGrade = '';
    let totalScore = 0;
    let initialConfidence = 45;
    
    // Use service role for guests
    const entities = isGuest ? base44.asServiceRole.entities : base44.entities;
    
    if (exam_id) {
      // In-app flow: fetch existing exam
      const exams = await entities.Exam.filter({ id: exam_id });
      exam = exams[0];
      console.log(`⏱️ [generateStudyPlan] Exam fetch: ${Date.now() - startTime}ms`);
      
      if (!exam || !exam.completed) {
        return Response.json({ error: 'Exam not found or not completed' }, { status: 400 });
      }
      
      examQuestions = exam.questions || [];
      predictedGrade = exam.predicted_grade || '—';
      totalScore = exam.total_score || 0;
      initialConfidence = exam.prediction_confidence || exam.ai_feedback?.prediction_confidence_percentage || 45;
      
      console.log(`📊 Exam data: grade=${predictedGrade}, score=${totalScore}%, confidence=${initialConfidence}%`);
    } else if (diagnosticData) {
      // Onboarding flow: use diagnosticData directly
      predictedGrade = diagnosticData.predicted_grade;
      totalScore = diagnosticData.predicted_percentage || 0;
      initialConfidence = parseInt(diagnosticData.confidence_level) || 45;
      
      // Extract weak areas as pseudo-competencies
      examQuestions = [];
      console.log(`⏱️ [generateStudyPlan] Using diagnostic data from onboarding`);
    } else {
      return Response.json({ error: 'Either exam_id or diagnosticData required' }, { status: 400 });
    }

    // Get lesson data
    const lessons = await entities.Lesson.filter({ id: lesson_id });
    const lesson = lessons[0];
    console.log(`⏱️ [generateStudyPlan] Lesson fetch: ${Date.now() - startTime}ms`);

    if (!lesson) {
      return Response.json({ error: 'Lesson not found' }, { status: 400 });
    }

    // Extract detailed question-level analysis
    const questionAnalysis = [];
    const competencyScores = {};
    const misconceptions = [];
    const wrongQuestions = [];
    
    if (examQuestions && examQuestions.length > 0) {
      examQuestions.forEach((q, idx) => {
        // Track competency performance
        if (q.assessed_competencies) {
          q.assessed_competencies.forEach(comp => {
            if (!competencyScores[comp]) {
              competencyScores[comp] = { correct: 0, total: 0, questions: [] };
            }
            competencyScores[comp].total++;
            competencyScores[comp].questions.push({
              question: q.question_text,
              correct: q.is_correct,
              difficulty: q.difficulty_index
            });
            if (q.is_correct) {
              competencyScores[comp].correct++;
            }
          });
        }
        
        // Collect wrong questions for targeted review
        if (!q.is_correct) {
          wrongQuestions.push({
            question: q.question_text,
            correct_answer: q.correct_answer,
            student_answer: q.user_answer,
            explanation: q.explanation,
            competencies: q.assessed_competencies || [],
            misconception: q.targeted_misconception
          });
          
          if (q.targeted_misconception) {
            misconceptions.push(q.targeted_misconception);
          }
        }
      });
    }

    // Rank competencies by weakness (lowest score first)
    const rankedCompetencies = Object.entries(competencyScores)
      .map(([name, data]) => ({
        name,
        score: Math.round((data.correct / data.total) * 100),
        total: data.total,
        correct: data.correct,
        questions: data.questions
      }))
      .sort((a, b) => a.score - b.score);

    // Get top 3 weakest competencies
    const weakestCompetencies = rankedCompetencies.slice(0, 3);
    
    // Extract mastery_gap from AI feedback (or diagnosticData or use weakest competency)
    const masteryGap = exam?.ai_feedback?.mastery_gap || 
                       (diagnosticData?.weak_areas_detailed?.[0]?.topic) ||
                       (weakestCompetencies[0]?.name) || 
                       'General Understanding';
    
    // Extract weak areas and strengths from AI feedback or diagnosticData
    const weakAreas = exam?.ai_feedback?.key_areas_for_improvement_list || 
                      (diagnosticData?.weak_areas_detailed?.map(w => w.topic) || []);
    const strengths = exam?.ai_feedback?.identified_strengths_list || [];

    // Get content summary for context
    const contentSummary = lesson.compressed_content || 
      (lesson.extracted_content ? lesson.extracted_content.substring(0, 3000) : lesson.description) || 
      lesson.description || '';

    // Generate intelligent study plan - use predictedGrade which is always set
    const gradeForPrompt = predictedGrade || 'current level';
    const planPrompt = `You are an expert learning scientist and instructional designer. Design a PRECISE, chronologically-ordered study plan that will measurably improve the student's grade from ${gradeForPrompt} toward an A+/90%.

PEDAGOGICAL FRAMEWORK:
Select the most appropriate sequence of tasks based on the student's specific weaknesses and the subject material. You can use any combination of the following task types:
- "review_notes": Re-read the material to rebuild conceptual foundations for weak areas
- "flashcards": Active recall to lock key terms, definitions, relationships into memory
- "teach_it": Feynman technique — explaining concepts forces deep processing and reveals gaps
- "practice_exam": Test under exam-like conditions to consolidate and identify remaining weaknesses

Choose 3-4 tasks and order them logically based on what the student needs most. For example, if they lack conceptual understanding, start with review_notes or teach_it. If they just need memorization, start with flashcards.

STUDENT PERFORMANCE DATA:
- Course: ${lesson.course_name}
- Exam Score: ${totalScore}%
- Predicted Grade: ${predictedGrade}

COMPETENCY BREAKDOWN (ranked by weakness):
${rankedCompetencies.map(c => `- ${c.name}: ${c.score}% (${c.correct}/${c.total} correct)`).join('\n')}

SPECIFIC QUESTIONS MISSED:
${wrongQuestions.slice(0, 5).map((q, i) => `
${i + 1}. Question: "${q.question}"
   - Student answered: "${q.student_answer}"
   - Correct answer: "${q.correct_answer}"
   - Competencies tested: ${q.competencies.join(', ')}
   - Misconception: ${q.misconception || 'None identified'}`).join('\n')}

IDENTIFIED MISCONCEPTIONS:
${misconceptions.length > 0 ? misconceptions.join('\n- ') : 'None explicitly identified'}

AI FEEDBACK SUMMARY:
- Areas to improve: ${weakAreas.join(', ')}
- Strengths to build on: ${strengths.join(', ')}

COURSE CONTENT OVERVIEW:
${contentSummary.substring(0, 2000)}

MASTERY GAP: "${masteryGap}" — ALL tasks should converge on addressing this weakness as the primary thread.

RULES:
- Task 1 is_focus_factor=true — directly targets the mastery gap, gets "Grade Booster" highlighting
- Each task's focus_topics MUST reference SPECIFIC concepts from the course content (not generic advice)
- Each task's description must explain WHY this step matters for the student's specific weaknesses
- For flashcards: target_count 10-20
- For teach_it: target_count 3-5
- For review_notes: target_count 1
- For practice_exam: target_count 1
- NEVER use "Diagnostic" in any title. Use "Practice Quiz", "Focus Practice", etc.
- target_competency must be a single competency name (max 150 chars, no explanations)

Return JSON:
{
  "tasks": [
    {
      "task_type": "review_notes" | "flashcards" | "teach_it" | "practice_exam",
      "title": "Clear action title (max 100 chars)",
      "description": "What this helps with and why (max 300 chars)",
      "target_count": number,
      "target_competency": "Single competency name (max 150 chars)",
      "focus_topics": ["specific topic 1", "specific topic 2", "specific topic 3"],
      "misconception_addressed": "Single misconception only (max 150 chars)",
      "is_focus_factor": boolean
    }
  ],
  "plan_rationale": "2-3 sentences explaining the pedagogical reasoning (max 500 chars)",
  "priority_focus": "Single sentence (max 150 chars)"
}`;

    console.log(`⏱️ [generateStudyPlan] Pre-LLM prep: ${Date.now() - startTime}ms`);
    console.log(`⏱️ [generateStudyPlan] Prompt length: ${planPrompt.length} chars`);
    
    const llmStartTime = Date.now();
    
    // Use Gemini directly for better study plan generation
    const geminiApiKey = Deno.env.get("GEMINIAPIKEY");
    if (!geminiApiKey) {
      return Response.json({ error: 'Gemini API key not configured' }, { status: 500 });
    }

    const geminiResponse = await fetchWithRetry(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${geminiApiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: planPrompt }] }],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 16000,
            responseMimeType: "application/json",
            responseSchema: {
              type: "object",
              properties: {
                tasks: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                     task_type: { type: "string" },
                     title: { type: "string", maxLength: 100 },
                     description: { type: "string", maxLength: 300 },
                     target_count: { type: "integer" },
                     target_competency: { type: "string", maxLength: 150 },
                     focus_topics: { type: "array", items: { type: "string" } },
                     misconception_addressed: { type: "string", maxLength: 150 },
                     is_focus_factor: { type: "boolean" }
                    },
                    required: ["task_type", "title", "target_count"]
                  }
                },
                plan_rationale: { type: "string", maxLength: 500 },
                priority_focus: { type: "string", maxLength: 150 }
              },
              required: ["tasks", "plan_rationale", "priority_focus"]
            }
          }
        })
      },
      3
    );

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      console.error('Gemini API error:', errorText);
      return Response.json({ error: 'Failed to generate study plan' }, { status: 500 });
    }

    const geminiData = await geminiResponse.json();
    const responseText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!responseText) {
      return Response.json({ error: 'No response from AI' }, { status: 500 });
    }

    let response;
    try {
      response = JSON.parse(responseText);
    } catch (e) {
      console.error('Failed to parse Gemini response:', responseText);
      return Response.json({ error: 'Invalid AI response' }, { status: 500 });
    }
    
    console.log(`⏱️ [generateStudyPlan] LLM call: ${Date.now() - llmStartTime}ms`);

    // Validate and filter tasks to only allowed types
    const validTaskTypes = ['flashcards', 'teach_it', 'review_notes', 'practice_exam'];
    
    // Default target counts if LLM doesn't provide them
    const defaultTargetCounts = {
      flashcards: 10,
      teach_it: 3,
      review_notes: 1,
      practice_exam: 1
    };
    
    const validatedTasks = (response.tasks || [])
      .filter(task => validTaskTypes.includes(task.task_type))
      .map((task, idx) => {
        // Ensure target_count is a valid positive number
        let targetCount = parseInt(task.target_count) || defaultTargetCounts[task.task_type] || 1;
        
        // Clamp values to reasonable ranges
        if (task.task_type === 'flashcards') {
          targetCount = Math.max(5, Math.min(20, targetCount));
        } else if (task.task_type === 'teach_it') {
          targetCount = Math.max(2, Math.min(5, targetCount));
        } else if (task.task_type === 'practice_exam' || task.task_type === 'review_notes') {
          targetCount = 1;
        }
        
        return {
          ...task,
          task_id: `task_${Date.now()}_${idx}`,
          target_count: targetCount,
          completed_count: 0,
          completed: false,
          focus_topics: task.focus_topics || [],
          misconception_addressed: task.misconception_addressed || null,
          is_focus_factor: idx === 0 ? true : (task.is_focus_factor || false)
        };
      });

    // Build competency progress array
    const competencyProgress = rankedCompetencies.map(c => ({
      competency_name: c.name,
      initial_score: c.score,
      current_score: c.score,
      questions_attempted: c.total,
      questions_correct: c.correct
    }));

    // Check for existing active plan
    const existingPlans = await entities.StudyPlan.filter({ 
      lesson_id, 
      status: 'active' 
    });

    // Mark existing plans as superseded
    for (const plan of existingPlans) {
      await entities.StudyPlan.update(plan.id, { status: 'superseded' });
    }

    // Get cycle number
    const allPlans = await entities.StudyPlan.filter({ lesson_id });
    const cycleNumber = allPlans.length + 1;

    console.log(`⏱️ [generateStudyPlan] Pre-create: ${Date.now() - startTime}ms`);
    
    // Create new study plan with enriched data
    const studyPlan = await entities.StudyPlan.create({
      lesson_id,
      generated_from_exam_id: exam_id || null,
      cycle_number: cycleNumber,
      initial_predicted_grade: predictedGrade,
      initial_score: totalScore,
      initial_confidence: initialConfidence,
      current_predicted_grade: predictedGrade,
      current_score: totalScore,
      current_confidence: initialConfidence,
      mastery_gap: masteryGap,
      target_grade: "A+",
      weak_competencies: weakestCompetencies.map(c => c.name),
      tasks: validatedTasks,
      competency_progress: competencyProgress,
      grade_history: [{
        date: new Date().toISOString(),
        exam_id: exam_id || null,
        predicted_grade: predictedGrade,
        score: totalScore,
        confidence: initialConfidence,
        source: exam_id ? 'in_app_exam' : 'onboarding_diagnostic'
      }],
      plan_rationale: response.plan_rationale,
      priority_focus: response.priority_focus,
      all_tasks_completed: false,
      official_exam_unlocked: false,
      status: 'active'
    });

    console.log(`⏱️ [generateStudyPlan] COMPLETE: ${Date.now() - startTime}ms total`);

    // ========== TRIGGER POLLY ENGINE ==========
    // Fire-and-forget: Run Polly to update predictions after study plan is generated
    base44.functions.invoke('runPollyEngine', {
      trigger_event: 'study_plan_generated',
      lesson_id: lesson_id,
      exam_id: exam_id
    }).then(() => {
      console.log('🔮 Polly engine triggered successfully');
    }).catch(err => {
      console.warn('🔮 Polly engine trigger failed (non-blocking):', err.message);
    });
    
    return Response.json({ 
      success: true, 
      study_plan: studyPlan,
      summary: response.plan_rationale,
      timing_ms: Date.now() - startTime
    });

  } catch (error) {
    console.error("Error generating study plan:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});