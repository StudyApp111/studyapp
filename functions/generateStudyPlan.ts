import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { exam_id, lesson_id } = await req.json();

    // Get the exam data
    const exams = await base44.entities.Exam.filter({ id: exam_id });
    const exam = exams[0];
    
    if (!exam || !exam.completed) {
      return Response.json({ error: 'Exam not found or not completed' }, { status: 400 });
    }

    // Get lesson data
    const lessons = await base44.entities.Lesson.filter({ id: lesson_id });
    const lesson = lessons[0];

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
    
    // Extract weak areas and strengths from AI feedback
    const weakAreas = exam.ai_feedback?.key_areas_for_improvement_list || [];
    const strengths = exam.ai_feedback?.identified_strengths_list || [];

    // Get content summary for context
    const contentSummary = lesson.compressed_content || 
      (lesson.extracted_content ? lesson.extracted_content.substring(0, 3000) : lesson.description) || 
      lesson.description || '';

    // Generate intelligent study plan
    const planPrompt = `You are an expert learning scientist creating a HIGHLY TARGETED study plan.

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

YOUR TASK:
Create 3-4 HIGHLY SPECIFIC study tasks. Each task must:
1. Target a SPECIFIC weak competency or misconception
2. Include SPECIFIC topics/concepts from the course material to focus on
3. Be actionable and measurable

AVAILABLE TASK TYPES:
- "flashcards": For memorizing key terms, definitions, relationships. Include SPECIFIC topics to generate cards for.
- "teach_it": For deep understanding. Include SPECIFIC concepts student must explain.
- "review_notes": For re-reading specific sections. Include SPECIFIC sections/topics to review.

CRITICAL: Each task's "focus_topics" array must contain SPECIFIC concepts from the course material that relate to the weak competency. These will be used to generate targeted content.

Return JSON:
{
  "tasks": [
    {
      "task_type": "flashcards" | "teach_it" | "review_notes",
      "title": "Clear action title (e.g., 'Master Key Terms for X')",
      "description": "What this helps with and why",
      "target_count": number (5-15 realistic),
      "target_competency": "The specific competency being addressed",
      "focus_topics": ["specific topic 1", "specific topic 2", "specific topic 3"],
      "misconception_addressed": "The specific misconception this task addresses (if any)"
    }
  ],
  "plan_rationale": "2-3 sentences explaining why this plan was designed this way",
  "priority_focus": "The single most important thing to improve"
}`;

    const response = await base44.integrations.Core.InvokeLLM({
      prompt: planPrompt,
      response_json_schema: {
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
                misconception_addressed: { type: "string" }
              }
            }
          },
          plan_rationale: { type: "string" },
          priority_focus: { type: "string" }
        }
      }
    });

    // Validate and filter tasks to only allowed types
    const validTaskTypes = ['flashcards', 'teach_it', 'review_notes'];
    const validatedTasks = (response.tasks || [])
      .filter(task => validTaskTypes.includes(task.task_type))
      .map((task, idx) => ({
        ...task,
        task_id: `task_${Date.now()}_${idx}`,
        completed_count: 0,
        completed: false,
        focus_topics: task.focus_topics || [],
        misconception_addressed: task.misconception_addressed || null
      }));

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

    // Create new study plan with enriched data
    const studyPlan = await base44.entities.StudyPlan.create({
      lesson_id,
      generated_from_exam_id: exam_id,
      cycle_number: cycleNumber,
      initial_predicted_grade: exam.predicted_grade,
      initial_score: exam.total_score,
      target_grade: "A+",
      weak_competencies: weakestCompetencies.map(c => c.name),
      tasks: validatedTasks,
      competency_progress: competencyProgress,
      grade_history: [{
        date: new Date().toISOString(),
        exam_id: exam_id,
        predicted_grade: exam.predicted_grade,
        score: exam.total_score
      }],
      plan_rationale: response.plan_rationale,
      priority_focus: response.priority_focus,
      all_tasks_completed: false,
      official_exam_unlocked: false,
      status: 'active'
    });

    return Response.json({ 
      success: true, 
      study_plan: studyPlan,
      summary: response.plan_rationale
    });

  } catch (error) {
    console.error("Error generating study plan:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});