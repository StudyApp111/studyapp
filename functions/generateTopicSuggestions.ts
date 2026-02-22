import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const API_KEY = Deno.env.get("GEMINIAPIKEY");

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Allow unauthenticated calls (fired during lesson creation before user lands on page)
    let user = null;
    try {
      user = await base44.auth.me();
    } catch (e) {
      // Continue without auth for fire-and-forget calls
    }

    const { lesson_id } = await req.json();

    if (!lesson_id) {
      return Response.json({ error: 'lesson_id is required' }, { status: 400 });
    }

    // Get lesson data
    const lessons = await base44.asServiceRole.entities.Lesson.filter({ id: lesson_id });
    const lesson = lessons[0];

    if (!lesson) {
      return Response.json({ error: 'Lesson not found' }, { status: 400 });
    }

    // Already has suggestions? Skip.
    if (lesson.topic_suggestions?.length > 0) {
      return Response.json({ success: true, skipped: true, message: 'Suggestions already exist' });
    }

    // Build context from topics, compressed content, curriculum map
    const topics = lesson.topics || [];
    const compressedContent = lesson.compressed_content || '';
    const extractedContent = lesson.extracted_content ? lesson.extracted_content.substring(0, 6000) : '';
    const curriculumMap = lesson.curriculum_map || null;
    const description = lesson.description || '';

    // Determine content to use for generation
    let contentContext = '';
    if (topics.length > 0) {
      contentContext = `STRUCTURED TOPICS FROM DOCUMENT:\n${JSON.stringify(topics, null, 1)}`;
    }
    if (compressedContent) {
      contentContext += `\n\nCOMPRESSED CONTENT:\n${compressedContent}`;
    } else if (extractedContent) {
      contentContext += `\n\nEXTRACTED CONTENT:\n${extractedContent}`;
    } else if (description) {
      contentContext += `\n\nCOURSE DESCRIPTION:\n${description}`;
    }
    if (curriculumMap?.curriculum_data) {
      contentContext += `\n\nCURRICULUM MAP:\n${JSON.stringify(curriculumMap.curriculum_data, null, 1)}`;
    }

    if (!contentContext || contentContext.length < 50) {
      return Response.json({ error: 'Insufficient content to generate suggestions' }, { status: 400 });
    }

    const prompt = `You are an expert study coach. Based on the student's course material below, create a structured study guide broken into SECTIONS (matching the document's natural structure like Lectures, Chapters, Units, Modules, Sections, Weeks, Parts, etc.).

COURSE: ${lesson.course_name}

${contentContext}

INSTRUCTIONS:
1. Identify 3-5 top-level sections from the document's structure. Use the EXACT naming convention from the document (e.g., "Lecture 1: Introduction to...", "Chapter 3: ...", "Unit 2: ...", "Week 4: ...").
2. For each section, suggest exactly 2 specific study topics with a recommended study format.
3. The study format should be one of: "Review Notes", "Flashcards", "Practice Test", "Feynman Technique"
4. Choose formats strategically:
   - "Review Notes" for dense conceptual topics that need careful reading
   - "Flashcards" for topics with many terms, definitions, or facts to memorize
   - "Practice Test" for application-based topics where testing knowledge helps
   - "Feynman Technique" for complex concepts that need deep understanding
5. Each topic name should be specific and actionable (e.g., "Understanding the Vedas" not just "Vedas")
6. If the document has fewer than 3 natural sections, create conceptual groupings from the content.

Return a JSON object with a "sections" array.`;

    const requestBody = {
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
                  section_description: { type: "string" },
                  suggested_topics: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        topic_name: { type: "string" },
                        format: { type: "string", enum: ["Review Notes", "Flashcards", "Practice Test", "Feynman Technique"] },
                        reason: { type: "string" }
                      },
                      required: ["topic_name", "format"]
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
    };

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent?key=${API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini API error:', errorText);
      return Response.json({ error: 'Failed to generate suggestions' }, { status: 500 });
    }

    const result = await response.json();
    const text = result.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      return Response.json({ error: 'No response from AI' }, { status: 500 });
    }

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      console.error('Failed to parse response:', text);
      return Response.json({ error: 'Failed to parse suggestions' }, { status: 500 });
    }

    const sections = parsed.sections || [];
    
    // Save to lesson entity
    await base44.asServiceRole.entities.Lesson.update(lesson_id, {
      topic_suggestions: sections
    });

    console.log(`✅ Generated ${sections.length} topic suggestion sections for lesson ${lesson_id}`);

    return Response.json({ success: true, sections });

  } catch (error) {
    console.error('Error generating topic suggestions:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});