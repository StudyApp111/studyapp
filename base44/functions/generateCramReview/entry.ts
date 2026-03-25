import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { lesson_id } = await req.json();
    if (!lesson_id) {
      return Response.json({ error: 'lesson_id required' }, { status: 400 });
    }

    // Fetch lesson, exams, and study plan
    const [lessons, exams, studyPlans] = await Promise.all([
      base44.entities.Lesson.filter({ id: lesson_id }),
      base44.entities.Exam.filter({ lesson_id }),
      base44.entities.StudyPlan.filter({ lesson_id, status: 'active' }),
    ]);

    const lesson = lessons[0];
    if (!lesson) {
      return Response.json({ error: 'Lesson not found' }, { status: 404 });
    }

    const completedExams = exams.filter(e => e.completed && e.questions?.length > 0);
    if (completedExams.length === 0) {
      return Response.json({ error: 'No completed exams found. Take a diagnostic first.' }, { status: 400 });
    }

    // Analyze weak areas from exam performance
    const weakAreas = [];
    const allMissedQuestions = [];

    for (const exam of completedExams) {
      for (const q of exam.questions) {
        if (!q.is_correct) {
          allMissedQuestions.push({
            question: q.question_text,
            correct_answer: q.correct_answer,
            user_answer: q.user_answer,
            explanation: q.explanation,
            competencies: q.assessed_competencies || [],
            misconception: q.targeted_misconception || '',
          });
          if (q.assessed_competencies) {
            q.assessed_competencies.forEach(c => {
              const existing = weakAreas.find(w => w.competency === c);
              if (existing) {
                existing.missed_count++;
              } else {
                weakAreas.push({ competency: c, missed_count: 1 });
              }
            });
          }
        }
      }
    }

    weakAreas.sort((a, b) => b.missed_count - a.missed_count);
    const topWeakAreas = weakAreas.slice(0, 5);

    // Get study plan context
    const activePlan = studyPlans[0];
    const masteryGap = activePlan?.mastery_gap || '';
    const weakCompetencies = activePlan?.weak_competencies || [];

    // Build the prompt
    const content = lesson.compressed_content || lesson.extracted_content || lesson.description || '';
    const contentSnippet = content.substring(0, 8000);

    const prompt = `You are an expert tutor creating a CRAM MODE review for a student preparing for an exam.

COURSE: ${lesson.course_name}

COURSE CONTENT (excerpt):
${contentSnippet}

STUDENT'S WEAKEST AREAS (ranked by most missed):
${topWeakAreas.map((w, i) => `${i + 1}. ${w.competency} (missed ${w.missed_count} questions)`).join('\n')}

${masteryGap ? `BIGGEST MASTERY GAP: ${masteryGap}` : ''}
${weakCompetencies.length > 0 ? `WEAK COMPETENCIES FROM STUDY PLAN: ${weakCompetencies.join(', ')}` : ''}

MISSED QUESTIONS (up to 10 most recent):
${allMissedQuestions.slice(0, 10).map((q, i) => `
Q${i + 1}: ${q.question}
Student answered: ${q.user_answer || 'No answer'}
Correct answer: ${q.correct_answer}
Why: ${q.explanation}
${q.misconception ? `Misconception: ${q.misconception}` : ''}
`).join('\n')}

Generate a focused cram review that addresses EXACTLY what this student is struggling with. Be specific to their mistakes.

Return a JSON object with:
- title: A short motivating title (e.g. "Your Weak Spots: Let's Fix Them")
- sections: An array of 3-5 sections, each with:
  - heading: Section heading (the weak concept/competency)
  - key_concept: A clear, concise explanation of the concept (2-4 sentences)
  - common_mistake: What students typically get wrong and what THIS student got wrong
  - correct_approach: Step-by-step how to think about it correctly
  - quick_test: A single question to test understanding (with answer)
  - difficulty: "high" | "medium" | "low" based on how much the student struggled
- summary: A 2-sentence motivational closing summary`;

    const result = await base44.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: {
        type: "object",
        properties: {
          title: { type: "string" },
          sections: {
            type: "array",
            items: {
              type: "object",
              properties: {
                heading: { type: "string" },
                key_concept: { type: "string" },
                common_mistake: { type: "string" },
                correct_approach: { type: "string" },
                quick_test: { type: "string" },
                difficulty: { type: "string" },
              }
            }
          },
          summary: { type: "string" },
        }
      }
    });

    return Response.json({
      success: true,
      review: result,
      weak_areas: topWeakAreas,
      total_missed: allMissedQuestions.length,
      total_exams_analyzed: completedExams.length,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});