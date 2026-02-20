import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { GoogleGenerativeAI } from 'npm:@google/generative-ai';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { lesson_id } = await req.json();
    if (!lesson_id) return Response.json({ error: 'lesson_id required' }, { status: 400 });

    const lessons = await base44.entities.Lesson.filter({ id: lesson_id });
    if (!lessons.length) return Response.json({ error: 'Lesson not found' }, { status: 404 });

    const lesson = lessons[0];
    const content = lesson.compressed_content || lesson.extracted_content || lesson.description || '';
    const courseName = lesson.course_name || 'this course';

    const GEMINI_KEY = Deno.env.get('GEMINIAPIKEY');
    const genAI = new GoogleGenerativeAI(GEMINI_KEY);

    // Determine if content is too short to generate topics from directly
    const isShortContent = !content || content.length < 200;

    let enrichedContent = content || '';

    // For short/description-only lessons, use Google Search grounding to gather real course info
    if (isShortContent) {
      console.log("Short content detected, using Google Search grounding to enrich...");
      try {
        const searchModel = genAI.getGenerativeModel({
          model: 'gemini-2.0-flash-lite',
          tools: [{ googleSearch: {} }]
        });

        const searchResult = await searchModel.generateContent({
          contents: [{
            role: 'user',
            parts: [{
              text: `Find the syllabus, key topics, and learning outcomes for the course "${courseName}". Context: ${enrichedContent || 'No additional context provided'}. Summarize the major topics covered in this course with descriptions. Be detailed and specific.`
            }]
          }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 3000 }
        });

        const searchContext = searchResult.response.text();
        console.log("Search context length:", searchContext.length);

        if (searchContext && searchContext.length > 50) {
          enrichedContent = `Course: ${courseName}\n\nUser description: ${enrichedContent}\n\nCourse research:\n${searchContext}`;
        }
      } catch (searchErr) {
        console.warn("Search grounding failed:", searchErr.message);
      }
    }

    // If still insufficient after enrichment, return error
    if (!enrichedContent || enrichedContent.length < 30) {
      return Response.json({ error: 'Insufficient content. Try uploading study material or adding a more detailed description.' }, { status: 400 });
    }

    // Strip LaTeX / special chars that can break JSON output
    const cleanedContent = enrichedContent
      .replace(/\\\\/g, '\\\\')
      .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, ' ');

    // Generate topics using standard JSON mode
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-lite' });

    const result = await model.generateContent({
      contents: [{
        role: 'user',
        parts: [{
          text: `You are an expert educator. Given the following student material for the course "${courseName}", break it into 4-7 clearly named topic chunks that cover the major themes.

MATERIAL:
${cleanedContent}

Return a JSON array of objects. Each object has:
- "title": a short descriptive topic name like "Topic 1: Cell Division"
- "description": a 1-sentence summary of what this topic covers, mentioning a practical example or application
- "key_content": the most relevant excerpt or summary from the material for this topic (300-500 words). Include concrete examples, case studies, or real-world applications where possible — not just definitions.

Return ONLY valid JSON array, no markdown.`
        }]
      }],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 4000,
        responseMimeType: 'application/json'
      }
    });

    const text = result.response.text();

    let topics;
    try {
      topics = JSON.parse(text);
    } catch {
      const match = text.match(/\[[\s\S]*\]/);
      topics = match ? JSON.parse(match[0]) : [];
    }

    if (!topics || topics.length === 0) {
      return Response.json({ error: 'Could not generate topics' }, { status: 500 });
    }

    return Response.json({ success: true, topics });
  } catch (error) {
    console.error("generateLearnTopics error:", error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});