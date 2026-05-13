// Pillar 1: Instant & Effortless Practice Generation
// Auto-fires after lesson creation. Generates flashcards + practice quiz + teach-it cards
// in parallel, calling Gemini directly (same pattern as generateFlashcards/generatePracticeExam/generateTeachItCards).
// Reuses the EXACT prompts/schemas from those existing functions to keep behavior consistent.
// Fire-and-forget — frontend polls for entities by study_plan_task_id = 'auto_practice_v1'.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const API_KEY = Deno.env.get('GEMINIAPIKEY');
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${API_KEY}`;

// Retry helper with exponential backoff for rate limits
async function fetchWithRetry(url, options, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const response = await fetch(url, options);
    if (response.ok) return response;
    if (response.status === 429 && attempt < maxRetries) {
      const waitTime = Math.pow(2, attempt) * 1000;
      await new Promise(r => setTimeout(r, waitTime));
      continue;
    }
    return response;
  }
}

// === Generator 1: Flashcards (mirrors generateFlashcards prompt/schema) ===
async function generateFlashcards(courseName, content) {
  const cardCount = 8;
  const prompt = `Generate exactly ${cardCount} high-quality flashcards for this course: ${courseName}

Content: ${content}

Create flashcards that:
1. Cover key concepts, definitions, and important facts
2. Are clear and concise
3. Have a question/front side and detailed answer/back side
4. Include topic tags for categorization
5. Are grounded in the provided content
6. Vary in difficulty (mark as easy, medium, or hard)

Return a JSON object with a "flashcards" array containing objects with: question, answer, topics (array), difficulty (easy/medium/hard)`;

  const response = await fetchWithRetry(GEMINI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.7,
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'object',
          properties: {
            flashcards: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  question: { type: 'string' },
                  answer: { type: 'string' },
                  topics: { type: 'array', items: { type: 'string' } },
                  difficulty: { type: 'string', enum: ['easy', 'medium', 'hard'] }
                },
                required: ['question', 'answer', 'topics', 'difficulty']
              }
            }
          },
          required: ['flashcards']
        }
      }
    })
  }, 3);

  if (!response.ok) throw new Error('Flashcards Gemini error');
  const result = await response.json();
  const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('No flashcards content');
  return JSON.parse(text).flashcards || [];
}

// === Generator 2: Practice Exam (mirrors generatePracticeExam prompt/schema) ===
async function generatePracticeExam(courseName, content) {
  const questionCount = 6;
  const enabledTypes = ['Multiple Choice', 'True/False', 'Short Answer'];
  const perType = Math.floor(questionCount / enabledTypes.length);
  const remainder = questionCount % enabledTypes.length;
  const typeDistribution = enabledTypes.map((t, i) => ({
    type: t,
    count: perType + (i < remainder ? 1 : 0)
  }));

  const prompt = `You are an expert educator creating a focused PRACTICE QUIZ for a student.

COURSE: ${courseName}

FOCUS AREAS:
- Target Competency: General understanding
- Specific Topics: All topics
- Misconception to Address: None specified

COURSE CONTENT (use this as your PRIMARY source for questions):
${content}

TASK: Generate exactly ${questionCount} practice questions that:
1. Are DIRECTLY based on the course content provided above
2. Test understanding of the specified focus topics
3. Use a MIX of question types for variety
4. Range from foundational to challenging

DIFFICULTY: Mix Easy, Medium, and Hard questions for a balanced set.

CRITICAL: All questions MUST be answerable using the course content above. Do not create questions about topics not covered in the content.

QUESTION TYPE DISTRIBUTION (use this mix):
${typeDistribution.map(td => `- ${td.count} ${td.type} questions`).join('\n')}

CRITICAL RULES:
1. Use EXACTLY these question_type values: "Multiple Choice", "True/False", "Short Answer"
2. Use EXACTLY these difficulty_index values: "Easy", "Medium", "Hard"
3. For Multiple Choice: correct_answer MUST be ONLY the letter (A, B, C, or D) - NOT the full option text
4. For True/False: correct_answer MUST be "True" or "False"
5. For Short Answer: correct_answer should be a concise model answer

IMPORTANT: Create APPLICATION-BASED questions that test understanding, NOT literal recall questions.

CRITICAL FORMATTING RULE: Do NOT use LaTeX notation. Write chemical formulas and math expressions in plain text.`;

  const response = await fetchWithRetry(GEMINI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.7,
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'object',
          properties: {
            questions: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  question_number: { type: 'integer' },
                  question_type: { type: 'string', enum: ['Multiple Choice', 'True/False', 'Short Answer'] },
                  question_text: { type: 'string' },
                  options: { type: 'array', items: { type: 'string' } },
                  correct_answer: { type: 'string' },
                  explanation: { type: 'string' },
                  difficulty_index: { type: 'string', enum: ['Easy', 'Medium', 'Hard'] },
                  assessed_competencies: { type: 'array', items: { type: 'string' } }
                },
                required: ['question_number', 'question_type', 'question_text', 'correct_answer', 'explanation', 'difficulty_index']
              }
            },
            exam_focus_summary: { type: 'string' }
          },
          required: ['questions', 'exam_focus_summary']
        }
      }
    })
  }, 3);

  if (!response.ok) throw new Error('Practice exam Gemini error');
  const result = await response.json();
  const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('No exam content');
  return JSON.parse(text);
}

// === Generator 3: Teach-It Cards (mirrors generateTeachItCards prompt/schema) ===
async function generateTeachItCards(courseName, content) {
  const prompt = `You are an expert educator creating ONE foundational "Teach It" card for ${courseName}.

STUDENT'S MATERIAL:
${content}

CRITICAL INSTRUCTIONS:
1. Identify the SINGLE most important, foundational concept from the material
2. Create one question that asks the student to explain this concept
3. The question must be answerable using their material
4. Do NOT ask meta-questions like "Why do we study X?" or "What problem does X solve?"

QUESTION FORMATS (use one):
- "Explain how [specific process/mechanism from material] works."
- "What is [specific concept from material] and how does it function?"
- "Walk through the steps of [specific process mentioned in material]."

OUTPUT:
Return exactly 1 card with question and model_answer fields. Model answer should be 3-5 sentences explaining the concept using material content.`;

  const response = await fetchWithRetry(GEMINI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.7,
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'object',
          properties: {
            cards: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  question: { type: 'string' },
                  model_answer: { type: 'string' }
                },
                required: ['question', 'model_answer']
              }
            }
          },
          required: ['cards']
        }
      }
    })
  }, 3);

  if (!response.ok) throw new Error('Teach-it Gemini error');
  const result = await response.json();
  const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('No teach-it content');
  return JSON.parse(text).cards || [];
}

// Normalize MCQ correct_answer to a single letter (mirrors generatePracticeExam logic)
function normalizeExamQuestions(questions) {
  return questions.map((q, idx) => {
    const normalized = {
      ...q,
      question_number: idx + 1,
      user_answer: null,
      is_correct: null
    };
    const type = String(q.question_type || '').toLowerCase();
    if (type.includes('multiple') || type.includes('choice')) {
      const answer = String(q.correct_answer || '').trim();
      const letterMatch = answer.match(/^([A-Da-d])[\.\)\:\s]/i);
      if (letterMatch) {
        normalized.correct_answer = letterMatch[1].toUpperCase();
      } else if (/^[A-Da-d]$/i.test(answer)) {
        normalized.correct_answer = answer.toUpperCase();
      } else if (q.options && q.options.length > 0) {
        const matchIdx = q.options.findIndex(opt =>
          opt.toLowerCase().includes(answer.toLowerCase()) ||
          answer.toLowerCase().includes(opt.toLowerCase().replace(/^[a-d][\.\)\s]+/i, '').trim())
        );
        if (matchIdx >= 0) {
          normalized.correct_answer = String.fromCharCode(65 + matchIdx);
        }
      }
    }
    return normalized;
  });
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Allow guests (use service role) OR authenticated users
    let user = null;
    let isGuest = false;
    try {
      user = await base44.auth.me();
    } catch {
      isGuest = true;
    }
    const entities = isGuest ? base44.asServiceRole.entities : base44.entities;

    const { lesson_id } = await req.json();
    if (!lesson_id) {
      return Response.json({ error: 'lesson_id required' }, { status: 400 });
    }

    if (!API_KEY) {
      return Response.json({ error: 'Service configuration error' }, { status: 500 });
    }

    // Fetch lesson
    const lessons = await entities.Lesson.filter({ id: lesson_id });
    if (!lessons.length) {
      return Response.json({ error: 'Lesson not found' }, { status: 404 });
    }
    const lesson = lessons[0];

    // Idempotency check
    const [existingFC, existingTI] = await Promise.all([
      entities.Flashcard.filter({ lesson_id, study_plan_task_id: 'auto_practice_v1' }),
      entities.TeachItCard.filter({ lesson_id, study_plan_task_id: 'auto_practice_v1' }),
    ]);
    if (existingFC.length > 0 && existingTI.length > 0) {
      console.log('✅ Auto practice session already exists');
      return Response.json({ success: true, skipped: true });
    }

    const courseName = lesson.course_name || 'this course';
    const content = lesson.compressed_content || lesson.extracted_content || lesson.description || '';
    const truncated = content.length > 50000 ? content.substring(0, 50000) : content;

    if (!truncated || truncated.length < 30) {
      return Response.json({ error: 'Insufficient content' }, { status: 400 });
    }

    console.log('🚀 Auto-generating practice session for lesson', lesson_id);

    // Run all 3 generations in parallel — direct Gemini calls
    const results = await Promise.allSettled([
      generateFlashcards(courseName, truncated),
      generatePracticeExam(courseName, truncated),
      generateTeachItCards(courseName, truncated)
    ]);

    const [flashRes, examRes, teachRes] = results;

    // === Save flashcards ===
    let flashcardsCreated = 0;
    if (flashRes.status === 'fulfilled' && flashRes.value?.length > 0) {
      await Promise.all(flashRes.value.map(card => entities.Flashcard.create({
        lesson_id,
        study_plan_task_id: 'auto_practice_v1',
        question: card.question || 'Question',
        answer: card.answer || 'Answer',
        topics: ['Quick Practice', ...(card.topics || [])],
        difficulty: card.difficulty || 'medium',
        status: 'new',
        review_count: 0,
        ease_factor: 2.5,
        next_review: new Date().toISOString()
      })));
      flashcardsCreated = flashRes.value.length;
      console.log('✅ Created', flashcardsCreated, 'flashcards');
    } else {
      console.error('❌ Flashcards failed:', flashRes.reason?.message);
    }

    // === Save practice exam ===
    let examId = null;
    if (examRes.status === 'fulfilled' && examRes.value?.questions?.length > 0) {
      const normalizedQuestions = normalizeExamQuestions(examRes.value.questions);
      const exam = await entities.Exam.create({
        lesson_id,
        exam_type: 'practice',
        exam_number: null,
        title: 'Practice Test: Quick Practice',
        focus_competency: 'General understanding',
        focus_description: examRes.value.exam_focus_summary || 'Auto-generated practice quiz',
        questions: normalizedQuestions,
        status: 'not_started',
        completed: false
      });
      examId = exam.id;
      console.log('✅ Practice exam created:', examId);
    } else {
      console.error('❌ Practice exam failed:', examRes.reason?.message);
    }

    // === Save teach-it cards ===
    let teachItCreated = 0;
    if (teachRes.status === 'fulfilled' && teachRes.value?.length > 0) {
      await Promise.all(teachRes.value.map(card => entities.TeachItCard.create({
        lesson_id,
        study_plan_task_id: 'auto_practice_v1',
        question: card.question,
        model_answer: card.model_answer,
        topic: 'Quick Practice',
        completed: false
      })));
      teachItCreated = teachRes.value.length;
      console.log('✅ Created', teachItCreated, 'teach-it cards');
    } else {
      console.error('❌ Teach-it failed:', teachRes.reason?.message);
    }

    return Response.json({
      success: true,
      flashcards_created: flashcardsCreated,
      exam_id: examId,
      teach_it_created: teachItCreated
    });
  } catch (error) {
    console.error('autoGeneratePracticeSession error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});