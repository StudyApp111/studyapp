import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Lightweight function that generates study suggestions per section from lesson topics
// Designed to run FAST and async alongside autoGenerateExam1

Deno.serve(async (req) => {
  const startTime = Date.now();
  console.log('⏱️ [generateTopicSuggestions] START');
  
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
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

    // Fetch lesson — retry briefly if topics/content not ready yet (race with compressDocument)
    let lesson = null;
    for (let attempt = 0; attempt < 5; attempt++) {
      const lessons = await base44.entities.Lesson.filter({ id: lesson_id });
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

    const prompt = `You are an expert exam predictor and study plan designer. Given this course content, create a section-by-section study guide that highlights HIGH-YIELD topics most likely to appear on exams.

COURSE: ${lesson.course_name}

CONTENT:
${contentForPrompt}
${curriculumContext}

TASK: Create sections that match the document's ACTUAL organizational structure. Each section represents a major division from the material (lecture, chapter, unit, module, etc.). 
For each section, suggest exactly 6 high-yield topics with the best study format for each. Prioritize topics most likely to be tested on exams.

RULES:
1. Section titles MUST match the document's actual organizational structure EXACTLY (e.g., "Lecture 1: Introduction to Hinduism", "Chapter 3: Cell Division", "Unit 2: Thermodynamics"). If the document has 2 lectures, create exactly 2 sections. If it has 5 chapters, create 5 sections. Match the source material structure.
2. If no clear structure exists, create conceptual sections (max 5)
3. Each topic should have a specific, actionable name (not generic like "Key Concepts")
4. Format should be the BEST fit for that topic type:
   - "Review Notes" — for dense reading/theory topics
   - "Flashcards" — for terminology, definitions, key facts
   - "Practice Test" — for problem-solving, application topics
   - "Feynman Technique" — for complex concepts requiring deep understanding
5. Each section MUST have exactly 6 suggested topics
6. For each topic, set high_yield to true if it is very likely to appear on an exam based on curriculum emphasis, common exam patterns, and how foundational the concept is. Mark at least 2-3 per section as high_yield.
7. high_yield_reason should be a SHORT phrase explaining WHY it's high-yield (e.g., "Frequently tested definition", "Core framework for essay questions", "Common calculation problem")`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 2000,
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