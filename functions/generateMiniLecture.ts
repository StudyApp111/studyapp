import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { course_name, topic_title, topic_content } = await req.json();
    if (!topic_title || !topic_content) {
      return Response.json({ error: 'topic_title and topic_content required' }, { status: 400 });
    }

    const GEMINI_KEY = Deno.env.get('GEMINIAPIKEY');
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `You are an expert lecturer for the course "${course_name || 'this course'}".

Write a detailed, student-friendly lecture explanation of the topic "${topic_title}".

STUDENT'S MATERIAL FOR THIS TOPIC:
${topic_content}

INSTRUCTIONS:
- Write a lecture with a clear heading and 3-5 key concept explanations
- For each key concept, explain what it is, how it works, give a concrete example from the provided material, and explain why it matters
- Write in a conversational tone suitable for being read aloud
- Each concept explanation should be at least 150 words
- Use simple, clear language that a student would easily understand
- Structure with markdown headings (## for the main title, ### for each concept)
- Do NOT use bullet points for the main explanations — write in flowing paragraphs
- Include transition sentences between concepts

Write the full lecture now.`
            }]
          }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 6000
          }
        })
      }
    );

    const data = await response.json();
    const lectureText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    return Response.json({ success: true, lecture: lectureText });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});