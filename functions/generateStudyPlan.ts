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

    const { exam_id, lesson_id } = await req.json();

    // Get the exam data
    const exams = await base44.entities.Exam.filter({ id: exam_id });
    const exam = exams[0];
    console.log(`⏱️ [generateStudyPlan] Exam fetch: ${Date.now() - startTime}ms`);
    
    if (!exam || !exam.completed) {
      return Response.json({ error: 'Exam not found or not completed' }, { status: 400 });
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
    
    if (exam.questions) {
      exam.questions.forEach((q, idx) => {
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
    
    // Extract mastery_gap from AI feedback (or use weakest competency)
    const masteryGap = exam.ai_feedback?.mastery_gap || 
                       (weakestCompetencies[0]?.name) || 
                       'General Understanding';
    
    // Get confidence from exam
    const initialConfidence = exam.prediction_confidence || 
                              exam.ai_feedback?.prediction_confidence_percentage || 
                              45; // Default low confidence for diagnostic
    
    // Extract weak areas and strengths from AI feedback
    const weakAreas = exam.ai_feedback?.key_areas_for_improvement_list || [];
    const strengths = exam.ai_feedback?.identified_strengths_list || [];

    // Get content summary for context
    const contentSummary = lesson.compressed_content || 
      (lesson.extracted_content ? lesson.extracted_content.substring(0, 3000) : lesson.description) || 
      lesson.description || '';

    // Generate intelligent study plan
    const planPrompt = `You are an expert learning scientist designing a HIGHLY TARGETED, exam-focused study plan that will measurably improve the student’s grade from ${exam.predicted_grade} to an A+/90% .

Use ONLY the data below. Be specific, practical, and realistic.

STUDENT PERFORMANCE DATA:
- Course: ${lesson.course_name}
- Exam Score: ${exam.total_score}%
- Predicted Grade: ${exam.predicted_grade}

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

Each task MUST:
- Target ONE weak competency OR one explicitly identified misconception
- Be grounded in the Course Content Summary AND directly traceable to:
  • at least one missed question OR
  • a listed misconception OR
  • a bottom-ranked competency
- Reference SPECIFIC course concepts, terms, theories, formulas, or methods
  that appear in the Course Content Summary (no generic skills or study advice like Comprehensive Assessment of Core Weaknesses)
- Address the underlying *reason* the student lost marks
  (e.g., concept confusion, misapplication, incomplete reasoning)
- Be actionable and measurable (clear output, count, or completion signal)
- Directly support exam performance for this course at this school

AVAILABLE TASK TYPES:
- "flashcards": For memorizing key terms, definitions, relationships. Include SPECIFIC topics to generate cards for. target_count = number of flashcards to master (10-20).
- "teach_it": For deep understanding. Include SPECIFIC concepts student must explain. target_count = number of concepts to explain (3-5).
- "review_notes": For re-reading specific sections. Include SPECIFIC sections/topics to review. target_count = 1.
- "practice_exam": A quick practice quiz focused on specific weak areas. target_count = 1 (one quiz). Use this to test understanding after other study tasks.

IMPORTANT: 
- Include at least ONE "practice_exam" task to help students test their knowledge on weak areas. This should be the FIRST STUDY TASK, always.
- For flashcards, set target_count between 10-20 (the number of cards to master)
- For practice_exam, set target_count to 1 (one quiz to complete)
- Create 3-5 total tasks maximum

CRITICAL: Each task's "focus_topics" array must contain SPECIFIC concepts from the course material that relate to the weak competency. These will be used to generate targeted content.

MASTERY GAP: The student's biggest weakness is "${masteryGap}". At least ONE task MUST directly address this competency - mark it with is_focus_factor=true. This task gets special "Grade Booster" highlighting.

Return JSON:
{
  "tasks": [
    {
      "task_type": "flashcards" | "teach_it" | "review_notes" | "practice_exam",
      "title": "Clear action title (e.g., 'Master Key Terms for X')",
      "description": "What this helps with and why",
      "target_count": number (10-20 for flashcards, 3-5 for teach_it, 1 for practice_exam/review_notes),
      "target_competency": "The specific competency being addressed",
      "focus_topics": ["specific topic 1", "specific topic 2", "specific topic 3"],
      "misconception_addressed": "The specific misconception this task addresses (if any)",
      "is_focus_factor": boolean (true if this task directly addresses the mastery_gap "${masteryGap}")
    }
  ],
  "plan_rationale": "2-3 sentences explaining why this plan was designed this way",
  "priority_focus": "The single most important thing to improve"
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
            maxOutputTokens: 8102,
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
                      title: { type: "string" },
                      description: { type: "string" },
                      target_count: { type: "integer" },
                      target_competency: { type: "string" },
                      focus_topics: { type: "array", items: { type: "string" } },
                      misconception_addressed: { type: "string" },
                      is_focus_factor: { type: "boolean" }
                    },
                    required: ["task_type", "title", "target_count"]
                  }
                },
                plan_rationale: { type: "string" },
                priority_focus: { type: "string" }
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
          is_focus_factor: task.is_focus_factor || false
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
    
    // Create new study plan with enriched data
    const studyPlan = await base44.entities.StudyPlan.create({
      lesson_id,
      generated_from_exam_id: exam_id,
      cycle_number: cycleNumber,
      initial_predicted_grade: exam.predicted_grade,
      initial_score: exam.total_score,
      initial_confidence: initialConfidence,
      mastery_gap: masteryGap,
      target_grade: "A+",
      weak_competencies: weakestCompetencies.map(c => c.name),
      tasks: validatedTasks,
      competency_progress: competencyProgress,
      grade_history: [{
        date: new Date().toISOString(),
        exam_id: exam_id,
        predicted_grade: exam.predicted_grade,
        score: exam.total_score,
        confidence: initialConfidence
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