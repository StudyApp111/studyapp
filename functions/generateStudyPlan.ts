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

    // Get existing flashcard and teach it card counts
    const flashcards = await base44.entities.Flashcard.filter({ lesson_id });
    const teachItCards = await base44.entities.TeachItCard.filter({ lesson_id });

    const totalFlashcards = flashcards.length;
    const masteredFlashcards = flashcards.filter(f => f.mastered).length;
    const unmasteredFlashcards = totalFlashcards - masteredFlashcards;

    const totalTeachItCards = teachItCards.length;
    const masteredTeachItCards = teachItCards.filter(t => t.mastered || t.score >= 70).length;

    // Extract weak areas from exam feedback
    const weakAreas = exam.ai_feedback?.key_areas_for_improvement_list || [];
    const strengths = exam.ai_feedback?.identified_strengths_list || [];
    
    // Extract competency performance from questions
    const competencyScores = {};
    if (exam.questions) {
      exam.questions.forEach(q => {
        if (q.assessed_competencies) {
          q.assessed_competencies.forEach(comp => {
            if (!competencyScores[comp]) {
              competencyScores[comp] = { correct: 0, total: 0 };
            }
            competencyScores[comp].total++;
            if (q.is_correct) {
              competencyScores[comp].correct++;
            }
          });
        }
      });
    }

    // Find weak competencies (below 70% or with few correct answers)
    const weakCompetencies = Object.entries(competencyScores)
      .filter(([_, scores]) => (scores.correct / scores.total) < 0.7)
      .map(([comp, _]) => comp);

    // Generate study plan using AI
    const planPrompt = `You are creating a personalized study plan for a student who just completed an exam.

Exam Results:
- Predicted Grade: ${exam.predicted_grade}
- Score: ${exam.total_score}%
- Weak Areas: ${weakAreas.join(', ')}
- Weak Competencies: ${weakCompetencies.join(', ')}
- Strengths: ${strengths.join(', ')}

Available Study Tools (choose from these ONLY):
1. flashcards - Review flashcard decks to reinforce concepts (need 3 "Got it" each)
2. teach_it - Explain concepts in your own words to prove understanding (need 70%+ score)
3. review_notes - Read and study the notes/document

Current Progress:
- Flashcards: ${masteredFlashcards}/${totalFlashcards} mastered
- Teach It Cards: ${masteredTeachItCards}/${totalTeachItCards} mastered

Create a focused study plan with 3-4 specific tasks using ONLY the tools above. DO NOT include "practice_questions" as a task_type.

Each task should:
- Target a specific weak area or competency
- Have a clear, achievable count (5-15 items typically)
- Use one of these task_types: "flashcards", "teach_it", or "review_notes"

Return JSON with this structure:
{
  "tasks": [
    {
      "task_type": "flashcards" | "teach_it" | "review_notes",
      "title": "Short action title",
      "description": "What this task will help with",
      "target_count": number,
      "target_competency": "specific competency or topic"
    }
  ],
  "summary": "One sentence summary of the plan focus"
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
                target_competency: { type: "string" }
              }
            }
          },
          summary: { type: "string" }
        }
      }
    });

    // Generate unique task IDs
    const tasksWithIds = response.tasks.map((task, idx) => ({
      ...task,
      task_id: `task_${Date.now()}_${idx}`,
      completed_count: 0,
      completed: false
    }));

    // Build competency progress array
    const competencyProgress = Object.entries(competencyScores).map(([name, scores]) => ({
      competency_name: name,
      initial_score: Math.round((scores.correct / scores.total) * 100),
      current_score: Math.round((scores.correct / scores.total) * 100),
      questions_attempted: scores.total,
      questions_correct: scores.correct
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

    // Create new study plan
    const studyPlan = await base44.entities.StudyPlan.create({
      lesson_id,
      generated_from_exam_id: exam_id,
      cycle_number: cycleNumber,
      initial_predicted_grade: exam.predicted_grade,
      initial_score: exam.total_score,
      target_grade: "A+",
      weak_competencies: weakCompetencies,
      tasks: tasksWithIds,
      competency_progress: competencyProgress,
      grade_history: [{
        date: new Date().toISOString(),
        exam_id: exam_id,
        predicted_grade: exam.predicted_grade,
        score: exam.total_score
      }],
      all_tasks_completed: false,
      official_exam_unlocked: false,
      status: 'active'
    });

    return Response.json({ 
      success: true, 
      study_plan: studyPlan,
      summary: response.summary
    });

  } catch (error) {
    console.error("Error generating study plan:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});