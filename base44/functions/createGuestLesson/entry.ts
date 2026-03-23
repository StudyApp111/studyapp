import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Creates a lesson record for guest users using service role
// Also fires off exam generation and topic suggestions
// Security: validates guest session fingerprint before creating

async function hashString(str) {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  const startTime = Date.now();
  console.log('=== createGuestLesson Start ===');
  
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { fingerprint, lesson_data } = body;

    if (!fingerprint || !lesson_data?.course_name) {
      return Response.json({ error: 'fingerprint and lesson_data.course_name are required' }, { status: 400 });
    }

    // Validate this fingerprint has a claimed guest session
    const fingerprintHash = await hashString(fingerprint);
    const guestLogs = await base44.asServiceRole.entities.AbuseLog.filter({
      action_type: 'guest_session'
    });
    
    const validSession = guestLogs.find(
      log => log.fingerprint === fingerprintHash && !log.blocked
    );
    
    if (!validSession) {
      console.log('🚫 No valid guest session for fingerprint');
      return Response.json({ error: 'No valid guest session found' }, { status: 403 });
    }

    // Check if this guest already created a lesson (prevent abuse)
    const existingGuestLessons = guestLogs.filter(
      log => log.fingerprint === fingerprintHash && log.metadata?.lesson_created
    );
    if (existingGuestLessons.length > 0) {
      console.log('🚫 Guest already created a lesson');
      return Response.json({ error: 'Guest already created a lesson' }, { status: 403 });
    }

    // Create the lesson using service role (guest has no user account)
    const lessonPayload = {
      course_name: lesson_data.course_name,
      status: 'created',
      description: lesson_data.description || undefined,
      extracted_content: lesson_data.extracted_content || undefined,
      compressed_content: lesson_data.compressed_content || undefined,
      topics: lesson_data.topics || undefined,
      file_url: lesson_data.file_url || undefined,
      file_urls: lesson_data.file_urls || undefined,
      input_type: lesson_data.input_type || 'description'
    };

    // Remove undefined keys
    Object.keys(lessonPayload).forEach(key => {
      if (lessonPayload[key] === undefined) delete lessonPayload[key];
    });

    const lesson = await base44.asServiceRole.entities.Lesson.create(lessonPayload);
    console.log('✅ Guest lesson created:', lesson.id);

    // Mark the guest session as having created a lesson
    await base44.asServiceRole.entities.AbuseLog.update(validSession.id, {
      metadata: { 
        ...validSession.metadata,
        lesson_created: true, 
        lesson_id: lesson.id,
        lesson_created_at: new Date().toISOString() 
      }
    });

    // Fire-and-forget: Generate diagnostic exam + topic suggestions using service role
    // These functions need to use service role internally since there's no user
    const apiKey = Deno.env.get('GEMINIAPIKEY');
    
    if (apiKey && lesson.id) {
      // Generate exam in background
      generateExamForGuest(base44, lesson, apiKey).catch(err => 
        console.error('❌ Guest exam generation error:', err.message)
      );
      
      // Generate topic suggestions in background
      generateTopicSuggestionsForGuest(base44, lesson, apiKey).catch(err =>
        console.error('❌ Guest topic suggestions error:', err.message)
      );
    }

    console.log(`✅ createGuestLesson complete in ${Date.now() - startTime}ms`);
    return Response.json({ success: true, lesson_id: lesson.id });

  } catch (error) {
    console.error('❌ Error in createGuestLesson:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

async function generateExamForGuest(base44, lesson, apiKey) {
  console.log('🎯 Generating diagnostic exam for guest lesson:', lesson.id);
  
  // Create exam record
  const exam = await base44.asServiceRole.entities.Exam.create({
    lesson_id: lesson.id,
    exam_number: 1,
    exam_type: 'official',
    questions: [],
    status: 'generating',
    completed: false
  });

  let contentDescription = lesson.compressed_content || lesson.extracted_content || lesson.description || `Course: ${lesson.course_name}`;
  if (contentDescription.length > 4000) {
    contentDescription = contentDescription.substring(0, 4000);
  }

  const aiPrompt = `[Context]
You are an expert assessment designer. Generate a 5-question exam-authentic DIAGNOSTIC worksheet for ${lesson.course_name}.

Content Summary:
${contentDescription}

Internal Rules:
• Difficulty Progression: Q1–2: Moderate, Q3–4: Challenging, Q5: High Challenge
• Multiple Choice → EXACTLY 4 options (A–D)
• True/False → options = ["True","False"]
• Fill in the Blank → ONE blank ____ , options = []
• Short Answer → options = []
• For MCQ: correct_answer = letter only (A, B, C, or D)
• For True/False: correct_answer = "True" or "False"

Generate EXACTLY 5 questions. Return ONE valid JSON object.`;

  const payload = {
    contents: [{ parts: [{ text: aiPrompt }] }],
    generationConfig: {
      temperature: 0.4,
      maxOutputTokens: 8192,
      responseMimeType: "application/json",
      responseSchema: {
        type: "object",
        properties: {
          exam_questions: {
            type: "array",
            items: {
              type: "object",
              properties: {
                question_number: { type: "integer" },
                question_type: { type: "string", enum: ["Multiple Choice", "True/False", "Fill in the Blank", "Short Answer"] },
                difficulty_index: { type: "string", enum: ["Moderate", "Challenging", "High Challenge"] },
                question_text: { type: "string" },
                options: { type: "array", items: { type: "string" } },
                correct_answer: { type: "string" },
                explanation: { type: "string" },
                assessed_competencies: { type: "array", items: { type: "string" } },
                targeted_misconception: { type: "string" }
              },
              required: ["question_number", "question_type", "difficulty_index", "question_text", "options", "correct_answer", "explanation", "assessed_competencies", "targeted_misconception"]
            }
          }
        },
        required: ["exam_questions"]
      }
    }
  };

  const resp = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }
  );

  if (!resp.ok) {
    await base44.asServiceRole.entities.Exam.update(exam.id, { status: 'not_started' });
    throw new Error(`Gemini error: ${resp.status}`);
  }

  const data = await resp.json();
  const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!content) {
    await base44.asServiceRole.entities.Exam.update(exam.id, { status: 'not_started' });
    throw new Error('No content from Gemini');
  }

  const examData = JSON.parse(content);
  const questions = (examData.exam_questions || []).map(q => ({ ...q, user_answer: '' }));

  await base44.asServiceRole.entities.Exam.update(exam.id, {
    questions,
    status: 'not_started',
    time_taken_seconds: 0,
    question_time_laps: []
  });

  console.log('✅ Guest exam generated:', exam.id, 'with', questions.length, 'questions');
}

async function generateTopicSuggestionsForGuest(base44, lesson, apiKey) {
  console.log('🎯 Generating topic suggestions for guest lesson:', lesson.id);

  let contentForPrompt = '';
  if (lesson.topics?.length > 0) {
    contentForPrompt = lesson.topics.map(t => {
      let section = `Section: ${t.title}\nDescription: ${t.description || ''}`;
      if (t.subtopics?.length > 0) {
        section += '\nSubtopics: ' + t.subtopics.map(st => st.title).join(', ');
      }
      return section;
    }).join('\n\n');
  } else if (lesson.compressed_content) {
    contentForPrompt = lesson.compressed_content;
  } else if (lesson.extracted_content) {
    const MAX = 8000;
    contentForPrompt = lesson.extracted_content.length > MAX
      ? lesson.extracted_content.substring(0, MAX / 2) + "\n...\n" + lesson.extracted_content.substring(lesson.extracted_content.length - MAX / 2)
      : lesson.extracted_content;
  } else {
    contentForPrompt = `Course: ${lesson.course_name}`;
  }

  let sectionHint = '';
  if (lesson.topics?.length > 0) {
    const names = lesson.topics.map(t => t.title);
    sectionHint = `\n\nKNOWN SECTIONS: ${names.map((n, i) => `\n${i+1}. "${n}"`).join('')}\nCreate EXACTLY ${names.length} sections matching these names.`;
  }

  const prompt = `You are an expert study plan designer. Create section-by-section study suggestions.

COURSE: ${lesson.course_name}
CONTENT:
${contentForPrompt}
${sectionHint}

For each section, provide 4-5 suggested topics with format: Review Notes, Flashcards, Practice Test, or Feynman Technique.
Follow pedagogical sequence: Review Notes first, then Flashcards, then Feynman, then Practice Test last.`;

  const resp = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 4000,
          responseMimeType: "application/json",
          responseSchema: {
            type: "object",
            properties: {
              sections: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    section_title: { type: "string" },
                    suggested_topics: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          topic_title: { type: "string" },
                          format: { type: "string", enum: ["Review Notes", "Flashcards", "Practice Test", "Feynman Technique"] },
                          high_yield: { type: "boolean" },
                          high_yield_reason: { type: "string" }
                        },
                        required: ["topic_title", "format", "high_yield"]
                      }
                    }
                  },
                  required: ["section_title", "suggested_topics"]
                }
              }
            },
            required: ["sections"]
          }
        }
      })
    }
  );

  if (!resp.ok) throw new Error(`Gemini topic suggestions error: ${resp.status}`);

  const data = await resp.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('No topic suggestions content');

  const parsed = JSON.parse(text);
  const sections = (parsed.sections || []).map(s => ({
    section_title: s.section_title,
    suggested_topics: (s.suggested_topics || []).slice(0, 6)
  }));

  await base44.asServiceRole.entities.Lesson.update(lesson.id, {
    topic_suggestions: sections
  });

  console.log('✅ Guest topic suggestions generated:', sections.length, 'sections');
}