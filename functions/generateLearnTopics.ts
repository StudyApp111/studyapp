import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

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
    // Use compressed_content as-is (already optimized by compressDocument function)
    const content = lesson.compressed_content || lesson.extracted_content || lesson.description || '';
    if (!content || content.length < 50) {
      return Response.json({ error: 'Insufficient content' }, { status: 400 });
    }

    const GEMINI_KEY = Deno.env.get('GEMINIAPIKEY');
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${GEMINI_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `You are an expert educator. Given the following student material for the course "${lesson.course_name}", break it into 4-7 clearly named topic chunks that cover the major themes.

MATERIAL:
${content}

Return a JSON array of objects. Each object has:
- "title": a short descriptive topic name like "Topic 1: Cell Division"
- "description": a 1-sentence summary of what this topic covers
- "key_content": the most relevant excerpt or summary from the material for this topic (300-500 words)

Return ONLY valid JSON array, no markdown.`
            }]
          }],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 4000,
            responseMimeType: 'application/json'
          }
        })
      }
    );

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '[]';

    let topics;
    try {
      topics = JSON.parse(text);
    } catch {
      const match = text.match(/\[[\s\S]*\]/);
      topics = match ? JSON.parse(match[0]) : [];
    }

    return Response.json({ success: true, topics });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});