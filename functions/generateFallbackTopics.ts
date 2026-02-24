import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Generates fallback sections/topics for lessons with lackluster content
// Uses Gemini + Google Search grounding to create realistic course structure
// Called when user begins diagnostic quiz and lesson has no topics

Deno.serve(async (req) => {
  console.log('=== generateFallbackTopics Start ===');
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

    const lessons = await base44.entities.Lesson.filter({ id: lesson_id });
    const lesson = lessons[0];
    if (!lesson) {
      return Response.json({ error: 'Lesson not found' }, { status: 400 });
    }

    // Skip if lesson already has good topic structure
    if (lesson.topics?.length >= 2) {
      console.log('Lesson already has topics, skipping fallback generation');
      return Response.json({ success: true, skipped: true });
    }

    // Skip if topic_suggestions already exist
    if (lesson.topic_suggestions?.length >= 2) {
      console.log('Topic suggestions already exist, skipping');
      return Response.json({ success: true, skipped: true });
    }

    const apiKey = Deno.env.get('GEMINIAPIKEY');
    if (!apiKey) {
      return Response.json({ error: 'API key not configured' }, { status: 500 });
    }

    // Get learning profile for school context
    let school = "N/A";
    let grade = "N/A";
    try {
      if (user.learning_profile_id) {
        const profiles = await base44.entities.LearningProfile.filter({ id: user.learning_profile_id });
        if (profiles[0]) {
          school = profiles[0].school || "N/A";
          grade = profiles[0].grade || "N/A";
        }
      }
    } catch (e) {
      console.warn('Could not load learning profile:', e.message);
    }

    const courseName = lesson.course_name || "Unknown Course";
    const contentHint = lesson.compressed_content || lesson.extracted_content || lesson.description || "";

    const prompt = `You are an expert curriculum designer. A student at ${school} (grade level: ${grade}) is studying "${courseName}".

${contentHint ? `They provided this brief description/content:\n"${contentHint.substring(0, 500)}"\n` : 'They provided minimal content.'}

Generate a realistic course breakdown that mimics what this course would actually cover at that school. Use your knowledge of real university/college curricula for this subject.

Create EXACTLY 3 sections (like chapters, units, or modules) with 2-4 high-yield study topics within each section.

For each topic, assign one of these study formats in this pedagogical order per section:
1. "Review Notes" (first — theory/reading)
2. "Flashcards" (key terms/definitions)  
3. "Feynman Technique" (hardest concept requiring deep understanding)
4. "Practice Test" (last — application/problem-solving)

Each section should have 3-4 topics. Mark the most exam-likely topics as high_yield=true.`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          tools: [{ googleSearch: {} }],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 3000,
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

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errText = await response.text();
      console.error('Gemini error:', errText);
      return Response.json({ error: 'Failed to generate topics' }, { status: 500 });
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      return Response.json({ error: 'No response from AI' }, { status: 500 });
    }

    const parsed = JSON.parse(text);
    const sections = parsed.sections || [];

    // Validate and clean
    const cleanedSections = sections.slice(0, 4).map(s => ({
      section_title: s.section_title,
      suggested_topics: (s.suggested_topics || []).slice(0, 5)
    }));

    if (cleanedSections.length === 0) {
      return Response.json({ error: 'No sections generated' }, { status: 500 });
    }

    // Save to lesson as topic_suggestions
    await base44.entities.Lesson.update(lesson_id, {
      topic_suggestions: cleanedSections
    });

    console.log(`✅ Generated ${cleanedSections.length} fallback sections for "${courseName}"`);
    return Response.json({ success: true, sections: cleanedSections });

  } catch (error) {
    if (error.name === 'AbortError') {
      console.error('Request timed out');
      return Response.json({ error: 'Request timed out' }, { status: 504 });
    }
    console.error('Error in generateFallbackTopics:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});