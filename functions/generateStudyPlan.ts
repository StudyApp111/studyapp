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
    const user = await base44.auth.me();
    console.log(`⏱️ [generateStudyPlan] Auth check: ${Date.now() - startTime}ms`);
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
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
    
    if (exam_id) {
      // In-app flow: fetch existing exam
      const exams = await base44.entities.Exam.filter({ id: exam_id });
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
    const lessons = await base44.entities.Lesson.filter({ id: lesson_id });
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
    const planPrompt = `You are an expert learning scientist. Generate a precise study plan calibrated to this student's diagnostic results. Output valid JSON only.

PEDAGOGICAL FRAMEWORK (Bloom's Taxonomy + Spaced Retrieval):
The tasks MUST follow this evidence-based learning sequence. Each step builds on the previous:
1. UNDERSTAND → "review_notes": Re-read the material to rebuild conceptual foundations for weak areas
2. REMEMBER → "flashcards": Active recall to lock key terms, definitions, relationships into memory
3. ANALYZE → "teach_it": Feynman technique — explaining concepts forces deep processing and reveals gaps
4. APPLY → "practice_exam": Test under exam-like conditions to consolidate and identify remaining weaknesses

You MUST output tasks in this chronological order. The student completes them 1→2→3→4.

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

STEP 1 — CLASSIFY COURSE TYPE (silent):
DECLARATIVE (History/Bio/Law/Philosophy) → use: review_notes, flashcards, teach_it
PROCEDURAL (Math/Accounting/Physics/Programming) → use: review_notes (worked examples only), practice_exam (high volume), teach_it (explain steps not concepts). NEVER flashcards for procedures.
CONCEPTUAL-APPLIED (Economics/OrganicChem/Engineering) → all types, flashcards only for terminology
INTERPRETIVE (Literature/Essays/SocialScience) → review_notes, teach_it, practice_exam

STEP 2 — CLASSIFY EACH WEAK COMPETENCY (score < 75%, silent):
CONCEPTUAL GAP (wrong due to misunderstanding) → review_notes + teach_it mandatory
PROCEDURAL GAP (wrong due to execution error) → review_notes with worked examples + high-volume practice_exam
RECALL GAP (inconsistent retrieval) → flashcards + practice_exam
TRANSFER GAP (fails novel applications) → teach_it + practice_exam, skip notes and flashcards

STEP 3 — BUILD TASKS:
- Score ≥ 75%: maintenance only (1-2 questions in practice_exam)
- Score 50-74%: skip review_notes unless conceptual gap confirmed
- Score < 50%: full sequence for identified failure mode
- Guessing detected: always include teach_it
- Do NOT force 4 tasks. Include only what the failure mode requires.
- PRIMARY MASTERY GAP task → is_focus_factor: true

STEP 4 — INSIGHTS PANEL:
Pill 1 (type: "danger"): "#1 Gap: [lowest competency below 65%]"
Pill 2 (type: "warning"): Behavior pattern detected:
  Guessing → "Pattern: rushing questions"
  Conceptual < 40% → "Pattern: surface-level reading"  
  Procedural errors → "Pattern: skipping steps"
  Inconsistent recall → "Pattern: recall under pressure"
Pill 3 (type: "info"): "First session closes [round((primary_gap_weight × 0.25 × 100) to nearest 5)]% of your gap"
Headline: "Your predicted grade in [course] is [a/an] [grade] — here's exactly why, and how to fix it." Use "an" before A grades, "a" before B/C/D/F.
Support (1 sentence): State the primary failure mode plainly.

RULES:
- focus_topics: SPECIFIC concept names only, never subject area names
- task titles: MUST follow format "Section Name: Topic Name" (e.g. "Cell Biology: Mitosis vs Meiosis"). Max 80 chars. NEVER use "Diagnostic"
- target_competency: single competency, max 150 chars
- flashcards: target_count 10 | teach_it: 5 | review_notes: 1 | practice_exam: 1

Return JSON:
{
  "insights_panel": {
    "headline": "string",
    "support_text": "string",
    "pills": [
      { "id": "gap", "label": "string", "type": "danger" },
      { "id": "behavior", "label": "string", "type": "warning" },
      { "id": "hook", "label": "string", "type": "info" }
    ]
  },
  "mastery_gap": "string",
  "tasks": [
    {
      "task_type": "review_notes | flashcards | teach_it | practice_exam",
      "title": "string",
      "target_competency": "string",
      "focus_topics": ["string"],
      "target_count": number,
      "is_focus_factor": boolean,
      "order": number
    }
  ],
  "plan_rationale": "string (max 300 chars)",
  "priority_focus": "string (max 150 chars)"
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
                     is_focus_factor: { type: "boolean" },
                     order: { type: "integer" }
                    },
                    required: ["task_type", "title", "target_count", "order"]
                  }
                },
                insights_panel: {
                  type: "object",
                  properties: {
                    headline: { type: "string" },
                    support_text: { type: "string" },
                    pills: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          id: { type: "string" },
                          label: { type: "string" },
                          type: { type: "string" }
                        },
                        required: ["id", "label", "type"]
                      }
                    }
                  },
                  required: ["headline", "support_text", "pills"]
                },
                mastery_gap: { type: "string" },
                plan_rationale: { type: "string", maxLength: 500 },
                priority_focus: { type: "string", maxLength: 150 }
              },
              required: ["tasks", "insights_panel", "mastery_gap", "plan_rationale", "priority_focus"]
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
    
    // Enforce pedagogical order: review_notes → flashcards → teach_it → practice_exam
    const pedagogicalOrder = ['review_notes', 'flashcards', 'teach_it', 'practice_exam'];
    
    const validatedTasks = (response.tasks || [])
      .filter(task => validTaskTypes.includes(task.task_type))
      .sort((a, b) => pedagogicalOrder.indexOf(a.task_type) - pedagogicalOrder.indexOf(b.task_type))
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
    const existingPlans = await base44.entities.StudyPlan.filter({ 
      lesson_id, 
      status: 'active' 
    });

    // Mark existing plans as superseded
    for (const plan of existingPlans) {
      await base44.entities.StudyPlan.update(plan.id, { status: 'superseded' });
    }

    // Get cycle number
    const allPlans = await base44.entities.StudyPlan.filter({ lesson_id });
    const cycleNumber = allPlans.length + 1;

    console.log(`⏱️ [generateStudyPlan] Pre-create: ${Date.now() - startTime}ms`);
    
    // Use mastery_gap from LLM response if available, fallback to exam data
    const finalMasteryGap = response.mastery_gap || masteryGap;

    // Create new study plan with enriched data
    const studyPlan = await base44.entities.StudyPlan.create({
      lesson_id,
      generated_from_exam_id: exam_id || null,
      cycle_number: cycleNumber,
      initial_predicted_grade: predictedGrade,
      initial_score: totalScore,
      initial_confidence: initialConfidence,
      current_predicted_grade: predictedGrade,
      current_score: totalScore,
      current_confidence: initialConfidence,
      mastery_gap: finalMasteryGap,
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
      insights_panel: response.insights_panel || null,
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