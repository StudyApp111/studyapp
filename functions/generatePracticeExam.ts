import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const API_KEY = Deno.env.get("GEMINIAPIKEY");

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

    // Get content - prefer compressed, fall back to extracted, then description
    const contentForExam = lesson.compressed_content || 
      (lesson.extracted_content ? lesson.extracted_content.substring(0, 8000) : '') || 
      lesson.description || '';

    if (!contentForExam || contentForExam.length < 50) {
      return Response.json({ error: 'Insufficient lesson content to generate exam' }, { status: 400 });
    }

    // Build the prompt for practice exam generation
    const prompt = `You are an expert educator creating a focused PRACTICE QUIZ for a student.

COURSE: ${lesson.course_name}

FOCUS AREAS:
- Target Competency: ${target_competency || 'General understanding'}
- Specific Topics: ${(focus_topics || []).join(', ') || 'All topics'}
- Misconception to Address: ${misconception_addressed || 'None specified'}

COURSE CONTENT (use this as your PRIMARY source for questions):
${contentForExam}

TASK: Generate exactly 10 practice questions that:
1. Are DIRECTLY based on the course content provided above
2. Test understanding of the specified focus topics
3. Address the identified misconception if provided
4. Use a MIX of question types for variety
5. Range from foundational to challenging

CRITICAL: All questions MUST be answerable using the course content above. Do not create questions about topics not covered in the content.

QUESTION TYPE DISTRIBUTION (use this mix):
- 4 Multiple Choice questions
- 2 True/False questions  
- 2 Fill-in-the-Blank questions
- 2 Short Answer questions (1-2 sentence responses)`;

    // Call Gemini Flash Lite for fast, cost-effective generation
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent?key=${API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: prompt }]
        }],
        generationConfig: {
          temperature: 0.7,
          responseMimeType: "application/json",
          responseSchema: {
            type: "object",
            properties: {
              questions: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    question_number: { type: "integer" },
                    question_type: { type: "string", enum: ["multiple_choice", "true_false", "fill_blank", "short_answer"] },
                    question_text: { type: "string" },
                    options: { type: "array", items: { type: "string" } },
                    correct_answer: { type: "string" },
                    explanation: { type: "string" },
                    difficulty_index: { type: "string", enum: ["easy", "medium", "hard"] },
                    assessed_competencies: { type: "array", items: { type: "string" } }
                  },
                  required: ["question_number", "question_type", "question_text", "correct_answer", "explanation", "difficulty_index"]
                }
              },
              exam_focus_summary: { type: "string" }
            },
            required: ["questions", "exam_focus_summary"]
          }
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini API error:', errorText);
      return Response.json({ error: 'Failed to generate practice exam' }, { status: 500 });
    }

    const result = await response.json();
    const content = result.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!content) {
      console.error('No content in Gemini response:', result);
      return Response.json({ error: 'No response from AI' }, { status: 500 });
    }
    
    // Parse JSON from response
    let examData;
    try {
      examData = JSON.parse(content);
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