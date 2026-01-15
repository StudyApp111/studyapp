import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const GROK_API_KEY = Deno.env.get("GROK_API_KEY");

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { lesson_id, focus_topics, target_competency, misconception_addressed } = await req.json();

    // Get lesson data
    const lessons = await base44.entities.Lesson.filter({ id: lesson_id });
    const lesson = lessons[0];

    if (!lesson) {
      return Response.json({ error: 'Lesson not found' }, { status: 400 });
    }

    // Get content summary
    const contentSummary = lesson.compressed_content || 
      (lesson.extracted_content ? lesson.extracted_content.substring(0, 4000) : lesson.description) || 
      lesson.description || '';

    // Build the prompt for practice exam generation
    const prompt = `You are an expert educator creating a focused PRACTICE QUIZ for a student.

COURSE: ${lesson.course_name}

FOCUS AREAS:
- Target Competency: ${target_competency || 'General understanding'}
- Specific Topics: ${(focus_topics || []).join(', ') || 'All topics'}
- Misconception to Address: ${misconception_addressed || 'None specified'}

COURSE CONTENT:
${contentSummary}

TASK: Generate exactly 10 practice questions that:
1. Test understanding of the specified focus topics
2. Address the identified misconception if provided
3. Use a MIX of question types for variety
4. Range from foundational to challenging
5. Are directly grounded in the course content

QUESTION TYPE DISTRIBUTION (use this mix):
- 4 Multiple Choice questions
- 2 True/False questions  
- 2 Fill-in-the-Blank questions
- 2 Short Answer questions (1-2 sentence responses)

Return JSON:
{
  "questions": [
    {
      "question_number": 1,
      "question_type": "multiple_choice" | "true_false" | "fill_blank" | "short_answer",
      "question_text": "The question text",
      "options": ["A) ...", "B) ...", "C) ...", "D) ..."] (for multiple choice only, null otherwise),
      "correct_answer": "The correct answer",
      "explanation": "Brief explanation of why this is correct",
      "difficulty_index": "easy" | "medium" | "hard",
      "assessed_competencies": ["competency being tested"]
    }
  ],
  "exam_focus_summary": "1-2 sentence summary of what this practice exam tests"
}`;

    // Call Grok API for fast generation
    const response = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GROK_API_KEY}`
      },
      body: JSON.stringify({
        model: 'grok-3-fast',
        messages: [
          {
            role: 'system',
            content: 'You are an expert educator. Always respond with valid JSON only, no markdown or extra text.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 4000
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Grok API error:', errorText);
      return Response.json({ error: 'Failed to generate practice exam' }, { status: 500 });
    }

    const result = await response.json();
    const content = result.choices[0]?.message?.content;
    
    // Parse JSON from response
    let examData;
    try {
      // Clean up potential markdown formatting
      const cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      examData = JSON.parse(cleanContent);
    } catch (parseError) {
      console.error('Failed to parse exam response:', content);
      return Response.json({ error: 'Failed to parse exam data' }, { status: 500 });
    }

    // Create practice exam record
    const exam = await base44.entities.Exam.create({
      lesson_id,
      exam_type: 'practice',
      focus_competency: target_competency,
      focus_description: examData.exam_focus_summary || `Practice quiz on ${(focus_topics || []).slice(0, 2).join(', ')}`,
      questions: examData.questions.map((q, idx) => ({
        ...q,
        question_number: idx + 1,
        user_answer: null,
        is_correct: null
      })),
      status: 'not_started',
      completed: false
    });

    return Response.json({ 
      success: true, 
      exam_id: exam.id,
      exam: exam,
      question_count: examData.questions.length
    });

  } catch (error) {
    console.error("Error generating practice exam:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});