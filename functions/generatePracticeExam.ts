import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const API_KEY = Deno.env.get("GEMINIAPIKEY");

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
    // Note: We don't use Google Search grounding because it's incompatible with JSON response mode
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
- 2 Short Answer questions (1-2 sentence responses)

CRITICAL RULES:
1. Use EXACTLY these question_type values: "Multiple Choice", "True/False", "Fill in the Blank", "Short Answer"
2. Use EXACTLY these difficulty_index values: "Easy", "Medium", "Hard"
3. For Multiple Choice: correct_answer MUST be ONLY the letter (A, B, C, or D) - NOT the full option text
4. For True/False: correct_answer MUST be "True" or "False"
5. For Fill-in-the-Blank: correct_answer should be the exact word/phrase that fills the blank
6. For Short Answer: correct_answer should be a concise model answer

IMPORTANT: Create APPLICATION-BASED questions that test understanding, NOT literal recall questions like "Which section covers X?" or "What is the name of...". Ask questions that require students to APPLY concepts.

CRITICAL FORMATTING RULE: Do NOT use LaTeX notation like $\\text{...}$ or $...$. Write chemical formulas and math expressions in plain text (e.g., "KCl" not "$\\text{KCl}$", "H2O" not "$H_2O$", "x^2" not "$x^2$").`;

    // Build request body
    const requestBody = {
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
                  question_type: { type: "string", enum: ["Multiple Choice", "True/False", "Fill in the Blank", "Short Answer"] },
                  question_text: { type: "string" },
                  options: { type: "array", items: { type: "string" } },
                  correct_answer: { type: "string" },
                  explanation: { type: "string" },
                  difficulty_index: { type: "string", enum: ["Easy", "Medium", "Hard"] },
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
    };

    // Use gemini-flash-latest with global endpoint for better availability
    const modelName = 'gemini-flash-latest';
    console.log(`📝 generatePracticeExam: Using model ${modelName} (global endpoint)`);
    console.log(`📝 Content length: ${contentForExam.length} chars`);
    console.log(`📝 Focus topics: ${(focus_topics || []).join(', ') || 'None'}`);
    console.log(`📝 Target competency: ${target_competency || 'None'}`);

    const response = await fetchWithRetry(`https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    }, 3);

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

    // Normalize correct answers for MCQ questions
    const normalizedQuestions = examData.questions.map((q, idx) => {
      const normalized = {
        ...q,
        question_number: idx + 1,
        user_answer: null,
        is_correct: null
      };
      
      // For MCQ, ensure correct_answer is just the letter
      const type = String(q.question_type || '').toLowerCase();
      if (type.includes('multiple') || type.includes('choice')) {
        const answer = String(q.correct_answer || '').trim();
        const letterMatch = answer.match(/^([A-Da-d])[\.\)\:\s]/i);
        if (letterMatch) {
          normalized.correct_answer = letterMatch[1].toUpperCase();
        } else if (/^[A-Da-d]$/i.test(answer)) {
          normalized.correct_answer = answer.toUpperCase();
        } else if (q.options && q.options.length > 0) {
          // Find matching option and use letter
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

    // Create practice exam record
    const exam = await base44.entities.Exam.create({
      lesson_id,
      exam_type: 'practice',
      focus_competency: target_competency,
      focus_description: examData.exam_focus_summary || `Practice quiz on ${(focus_topics || []).slice(0, 2).join(', ')}`,
      questions: normalizedQuestions,
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