import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Lightweight function that generates study suggestions per section from lesson topics
// Designed to run FAST and async alongside autoGenerateExam1

Deno.serve(async (req) => {
  const startTime = Date.now();
  console.log('⏱️ [generateTopicSuggestions] START');
  
  try {
    const base44 = createClientFromRequest(req);
    
    // Support both authenticated users and guest sessions
    let user = null;
    let isGuestMode = false;
    try {
      user = await base44.auth.me();
    } catch (e) {
      isGuestMode = true;
    }

    let body;
    try {
      body = await req.json();
    } catch (parseErr) {
      return Response.json({ error: 'Invalid request body' }, { status: 400 });
    }
    
    const { lesson_id } = body;
    if (!lesson_id) {
      return Response.json({ error: 'lesson_id is required' }, { status: 400 });
    }

    // Use service role for guest mode
    const entities = isGuestMode ? base44.asServiceRole.entities : base44.entities;

    // Fetch lesson — retry briefly if topics/content not ready yet (race with compressDocument)
    let lesson = null;
    for (let attempt = 0; attempt < 5; attempt++) {
      const lessons = await entities.Lesson.filter({ id: lesson_id });
      lesson = lessons[0];
      if (!lesson) {
        return Response.json({ error: 'Lesson not found' }, { status: 400 });
      }
      // If suggestions already exist, skip
      if (lesson.topic_suggestions?.length > 0) {
        console.log('✅ Topic suggestions already exist, skipping');
        return Response.json({ success: true, skipped: true });
      }
      // If we have topics or compressed content or description, we're good to go
      if (lesson.topics?.length > 0 || lesson.compressed_content || lesson.description || lesson.extracted_content) {
        break;
      }
      // Content not ready yet — wait and retry
      if (attempt < 4) {
        console.log(`⏳ Lesson content not ready yet, waiting (attempt ${attempt + 1}/5)...`);
        await new Promise(r => setTimeout(r, 3000));
      }
    }

    const apiKey = Deno.env.get('GEMINIAPIKEY');
    if (!apiKey) {
      return Response.json({ error: 'API key not configured' }, { status: 500 });
    }

    // Build content for the LLM - use topics if available, otherwise compressed/extracted content
    let contentForPrompt = '';
    
    if (lesson.topics?.length > 0) {
      // Use structured topics - this is the best source
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
      // For very large documents, take beginning + end to stay within prompt limits
      const MAX_EXTRACT = 8000;
      if (lesson.extracted_content.length > MAX_EXTRACT) {
        contentForPrompt = lesson.extracted_content.substring(0, MAX_EXTRACT / 2) + 
          "\n\n...[content truncated]...\n\n" + 
          lesson.extracted_content.substring(lesson.extracted_content.length - MAX_EXTRACT / 2);
      } else {
        contentForPrompt = lesson.extracted_content;
      }
    } else if (lesson.description) {
      contentForPrompt = lesson.description;
    } else {
      contentForPrompt = `Course: ${lesson.course_name}`;
    }

    // Also check curriculum map for additional context
    let curriculumContext = '';
    if (lesson.curriculum_map?.core_competencies?.length > 0) {
      curriculumContext = '\n\nCURRICULUM COMPETENCIES:\n' + 
        lesson.curriculum_map.core_competencies.map(c => `- ${c.name}: ${c.description || ''}`).join('\n');
    }

    // Use lesson.topics to determine how many sections exist — this prevents the LLM from inventing structure
    let sectionHint = '';
    if (lesson.topics?.length > 0) {
      const sectionNames = lesson.topics.map(t => t.title);
      sectionHint = `\n\nKNOWN DOCUMENT SECTIONS (from parsing): ${sectionNames.map((n, i) => `\n${i + 1}. "${n}"`).join('')}\nYou MUST create EXACTLY ${sectionNames.length} sections matching these names. Do NOT add, remove, merge, or split sections.`;
    }

    const prompt = `You are an expert exam predictor and study plan designer. Given this course content, create a section-by-section study guide that highlights HIGH-YIELD topics most likely to appear on exams.

COURSE: ${lesson.course_name}

CONTENT:
${contentForPrompt}
${curriculumContext}
${sectionHint}

TASK: Create sections that match the document's ACTUAL top-level organizational structure ONLY. A "section" is a major division like a lecture, chapter, unit, module, part, or week — NOT a subtopic within one.

CRITICAL — SECTION RULES:
1. The number of sections MUST equal the number of top-level divisions in the source material. If the document has 2 lectures, output EXACTLY 2 sections. If it has 5 chapters, output EXACTLY 5 sections.
2. Section titles must match the document headings exactly (e.g., "Lecture 1: Introduction to Hinduism", "Chapter 3: Cell Division").
3. Subtopics within a lecture/chapter become "suggested_topics" INSIDE that section, NOT separate sections.
4. If no clear structure exists, create 3-4 conceptual sections.

TOPIC RULES:
5. Each section should have 4-5 suggested topics drawn from the subtopics WITHIN that section.
6. Each topic should have a specific, actionable name (not generic like "Key Concepts").
7. CRITICAL — FORMAT ORDERING: Within each section, follow this EXACT pedagogical sequence:
   Step 1: "Review Notes" — ONE per section, covering the section's main theory/reading content. Always FIRST.
   Step 2: "Flashcards" — for terminology, definitions, key facts from that section.
   Step 3: "Feynman Technique" — for the hardest concept in the section requiring deep understanding.
   Step 4: "Practice Test" — for application/problem-solving. Always LAST.
   
   You may include 1-2 additional Flashcard or Feynman topics if the section has enough distinct subtopics, but NEVER more than ONE "Review Notes" per section and NEVER more than ONE "Practice Test" per section.
8. For each topic, set high_yield to true if it is very likely to appear on an exam. Mark at least 2-3 per section as high_yield.
9. high_yield_reason should be a SHORT phrase explaining WHY it's high-yield.`;

    const response = await fetch(
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

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Gemini API error:', errorText);
      return Response.json({ error: 'Failed to generate suggestions' }, { status: 500 });
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!text) {
      return Response.json({ error: 'No response from AI' }, { status: 500 });
    }

    const parsed = JSON.parse(text);
    const sections = parsed.sections || [];

    // Keep all sections from the document structure, up to 6 topics each
    const cleanedSections = sections.map(s => ({
      section_title: s.section_title,
      suggested_topics: (s.suggested_topics || []).slice(0, 6)
    }));

    // Save to lesson
    await base44.entities.Lesson.update(lesson_id, {
      topic_suggestions: cleanedSections
    });

    console.log(`✅ Generated ${cleanedSections.length} sections in ${Date.now() - startTime}ms`);
    
    return Response.json({ 
      success: true, 
      sections: cleanedSections,
      timing_ms: Date.now() - startTime
    });

  } catch (error) {
    console.error('❌ Error in generateTopicSuggestions:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});