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

// Auto-generates Exam 1 questions when lesson is ready
// Called from DocumentViewer preload logic

Deno.serve(async (req) => {
  console.log('=== autoGenerateExam1 Start ===');
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { lesson_id } = await req.json();
    
    if (!lesson_id) {
      return Response.json({ error: 'lesson_id is required' }, { status: 400 });
    }

    // STEP 1: Check if exam 1 already exists with questions
    const existingExams = await base44.entities.Exam.filter({ lesson_id, exam_number: 1 });
    const officialExam = existingExams.find(e => e.exam_type !== 'practice');
    
    if (officialExam?.questions?.length > 0) {
      console.log('Exam 1 already has questions, skipping generation');
      return Response.json({ success: true, skipped: true, exam_id: officialExam.id });
    }
    
    // STEP 2: Check if generation is in progress (exam record exists within last 20 seconds)
    if (officialExam) {
      const createdAt = new Date(officialExam.created_date);
      const updatedAt = new Date(officialExam.updated_date || officialExam.created_date);
      const now = new Date();
      const secondsSinceCreation = (now - createdAt) / 1000;
      const secondsSinceUpdate = (now - updatedAt) / 1000;
      
      // If exam was created/updated within last 20 seconds, another call is in progress
      if (secondsSinceCreation < 20 || secondsSinceUpdate < 20) {
        console.log(`Exam 1 generation in progress (created ${secondsSinceCreation}s ago), skipping duplicate`);
        return Response.json({ success: true, skipped: true, in_progress: true, exam_id: officialExam.id });
      }
    }
    
    // STEP 3: Create a placeholder exam record IMMEDIATELY to act as a lock
    // This prevents race conditions where two requests both pass the check above
    let lockExam;
    if (officialExam) {
      // Update existing record to refresh updated_date (acts as lock refresh)
      lockExam = await base44.entities.Exam.update(officialExam.id, {
        status: "generating"
      });
      console.log('Refreshed lock on existing exam record:', lockExam.id);
    } else {
      // Create new placeholder record
      lockExam = await base44.entities.Exam.create({
        lesson_id,
        exam_number: 1,
        exam_type: "official",
        questions: [],
        status: "generating",
        completed: false
      });
      console.log('Created lock exam record:', lockExam.id);
    }
    
    // STEP 4: Double-check no other process created questions while we were creating the lock
    const recheckExams = await base44.entities.Exam.filter({ lesson_id, exam_number: 1 });
    const recheckExam = recheckExams.find(e => e.exam_type !== 'practice' && e.questions?.length > 0);
    if (recheckExam) {
      console.log('Another process already generated questions, skipping');
      return Response.json({ success: true, skipped: true, exam_id: recheckExam.id });
    }

    // Get lesson data
    const lessons = await base44.entities.Lesson.filter({ id: lesson_id });
    const lesson = lessons[0];
    if (!lesson) {
      return Response.json({ error: 'Lesson not found' }, { status: 400 });
    }

    // Wait for compressed content
    if (!lesson.compressed_content && lesson.input_type === 'file') {
      return Response.json({ error: 'Content not ready yet', retry: true }, { status: 202 });
    }

    // Get learning profile
    const profiles = await base44.entities.LearningProfile.filter({ id: user.learning_profile_id });
    const learningProfile = profiles[0] || {};

    // Determine content
    let contentDescription = "";
    if (lesson.input_type === "description" && lesson.description) {
      contentDescription = lesson.description;
    } else if (lesson.compressed_content) {
      contentDescription = lesson.compressed_content;
    } else if (lesson.extracted_content) {
      contentDescription = lesson.extracted_content;
    } else {
      contentDescription = lesson.description || "N/A";
    }

    // Build the exam generation prompt (same as ExamTab)
    const aiPrompt = `
[Context]
You are an expert assessment designer. Generate a 5-question exam-authentic DIAGNOSTIC worksheet for ${lesson.course_name}. 
This exam establishes an accurate learning baseline and must reflect how the course is ACTUALLY assessed.

Do NOT rely on prior diagnostics.

────────────────────────────
Input Context

Student Grade Level: ${learningProfile.grade || "N/A"}
Course / Unit Name: ${lesson.course_name}
School: ${learningProfile.school || "N/A"}

Content Summary (OCR notes or user description):
${contentDescription}

────────────────────────────
Internal Rules (Do NOT Output)

• Topic Lock:
If content specifies a concrete skill/topic (e.g., "factoring", "photosynthesis", "short story analysis"),
ALL questions must stay strictly within it.
Only broaden scope if the user explicitly requests review or exam prep.

• TASK-FORM ENFORCEMENT (CRITICAL):
Questions MUST require the student to PERFORM the skill, not describe it.

Examples:
- English / Humanities:
  Use short passages, excerpts, scenarios, or claims.
  Test analysis, interpretation, or argument by asking the student to respond TO the material.
  DO NOT ask for definitions of literary or analytical terms.

- Math / Sciences:
  Use problems, data, equations, diagrams, or experimental setups.
  DO NOT ask conceptual description-only questions unless the course explicitly assesses them.

- Computer Science / Engineering:
  Use code snippets, logic traces, outputs, or system behavior.
  DO NOT ask “what is” or “explain the concept” unless required by curriculum.

- Business / Economics:
  Use case scenarios, numbers, or decisions.
  DO NOT test abstract definitions without application.

• Difficulty Progression:
Q1–2: Moderate
Q3–4: Challenging
Q5: Challenging → High Challenge (depth, edge cases, or precision—not new content)

────────────────────────────
QUESTION-TYPE RULES (STRICT)

Choose question_type for EACH question:
Multiple Choice | True/False | Fill in the Blank | Short Answer

• Multiple Choice → EXACTLY 4 options (A–D)
• True/False → options = ["True","False"]
• Fill in the Blank → ONE blank written as ____ , options = []
• Short Answer → options = []

MCQ cue phrases are FORBIDDEN in non-MCQ questions.
If violated, auto-convert to Multiple Choice.

CRITICAL ANSWER FORMAT:
• For Multiple Choice: correct_answer MUST be ONLY the letter (A, B, C, or D) - NOT the full option text
• For True/False: correct_answer MUST be "True" or "False"

────────────────────────────
Output Requirements

Generate EXACTLY 5 questions.
Each must include:
question_type, question_text, options, difficulty_index

Then include an answer key with:
correct_answer, explanation (2 sentences MAX),
assessed_competencies (2 MAX), targeted_misconception (2 MAX)

Output Format
Return ONE valid JSON object matching the required schema.
No extra text.`;

    // Call Gemini directly with gemini-flash-latest
    const apiKey = Deno.env.get('GEMINIAPIKEY');
    if (!apiKey) {
      return Response.json({ error: 'Service configuration error' }, { status: 500 });
    }

    const responseSchema = {
      type: "object",
      properties: {
        exam_questions: {
          type: "array",
          description: "Array of 5 exam questions",
          items: {
            type: "object",
            properties: {
              question_number: { 
                type: "integer",
                description: "Question number (1-5)"
              },
              question_type: { 
                type: "string", 
                enum: ["Multiple Choice", "True/False", "Fill in the Blank", "Short Answer"],
                description: "Type of question"
              },
              difficulty_index: { 
                type: "string", 
                enum: ["Moderate", "Challenging", "High Challenge"],
                description: "Difficulty level"
              },
              question_text: { 
                type: "string",
                description: "The actual question text"
              },
              options: { 
                type: "array", 
                items: { type: "string" },
                description: "Answer options (4 for MCQ, 2 for T/F, empty for others)"
              },
              correct_answer: { 
                type: "string",
                description: "For MCQ: single letter (A, B, C, D). For T/F: 'True' or 'False'. For others: the answer."
              },
              explanation: { 
                type: "string",
                description: "2 sentence explanation of the correct answer"
              },
              assessed_competencies: { 
                type: "array", 
                items: { type: "string" },
                description: "List of competencies this question assesses"
              },
              targeted_misconception: { 
                type: "string",
                description: "Common misconception this question targets"
              }
            },
            required: ["question_number", "question_type", "difficulty_index", "question_text", "options", "correct_answer", "explanation", "assessed_competencies", "targeted_misconception"]
          }
        }
      },
      required: ["exam_questions"]
    };

    const payload = {
      contents: [{
        parts: [{ text: aiPrompt }]
      }],
      generationConfig: {
        temperature: 0.4,
        maxOutputTokens: 20000,
        responseMimeType: "application/json",
        responseSchema: responseSchema
      }
    };

    console.log('Calling Gemini with retry logic for exam generation...');
    const resp = await fetchWithRetry(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      },
      3
    );

    if (!resp.ok) {
      const errText = await resp.text();
      console.error('Gemini error:', resp.status, errText);
      return Response.json({ error: 'Failed to generate exam', details: errText }, { status: 500 });
    }

    // Read full response body as text first to avoid stream issues
    const responseText = await resp.text();
    console.log('Response text length:', responseText.length);
    
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (parseErr) {
      console.error('Failed to parse Gemini API response:', parseErr.message);
      console.error('Response preview:', responseText.substring(0, 500));
      return Response.json({ error: 'Invalid API response format' }, { status: 500 });
    }
    
    const content = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!content) {
      console.error('No content from Gemini, candidates:', JSON.stringify(data?.candidates));
      return Response.json({ error: 'No content generated' }, { status: 500 });
    }

    console.log('Content length:', content.length);

    let examData;
    try {
      examData = JSON.parse(content);
    } catch (e) {
      console.error('JSON parse failed:', e?.message);
      console.error('Content end:', content.substring(Math.max(0, content.length - 300)));
      return Response.json({ error: 'Failed to parse exam response' }, { status: 500 });
    }

    const examQuestions = examData?.exam_questions || [];
    if (!Array.isArray(examQuestions) || examQuestions.length === 0) {
      console.error('Invalid exam_questions:', examData);
      return Response.json({ error: 'Failed to generate exam questions' }, { status: 500 });
    }

    const questionsWithPlaceholder = examQuestions.map(q => ({
      ...q,
      user_answer: ""
    }));

    // Update the lock exam record with the generated questions
    const exam = await base44.entities.Exam.update(lockExam.id, {
      questions: questionsWithPlaceholder,
      status: "not_started",
      time_taken_seconds: 0,
      question_time_laps: []
    });

    console.log('Exam 1 generated successfully:', exam.id);
    return Response.json({ success: true, exam_id: exam.id, question_count: questionsWithPlaceholder.length });

  } catch (error) {
    console.error('Error in autoGenerateExam1:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});