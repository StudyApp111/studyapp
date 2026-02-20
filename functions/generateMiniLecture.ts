import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { GoogleGenerativeAI } from 'npm:@google/generative-ai';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { course_name, topic_title, topic_content, lesson_id } = await req.json();
    if (!topic_title) {
      return Response.json({ error: 'topic_title required' }, { status: 400 });
    }

    const GEMINI_KEY = Deno.env.get('GEMINIAPIKEY');
    const genAI = new GoogleGenerativeAI(GEMINI_KEY);

    const isShortContent = !topic_content || topic_content.length < 150;
    let enrichedContent = topic_content || '';

    // For minimal content, enrich with Google Search grounding
    if (isShortContent) {
      console.log("Short topic content, enriching with Google Search...");
      try {
        const searchModel = genAI.getGenerativeModel({
          model: 'gemini-2.0-flash-lite',
          tools: [{ googleSearch: {} }]
        });
        const searchResult = await searchModel.generateContent({
          contents: [{
            role: 'user',
            parts: [{ text: `For the course "${course_name || 'general studies'}", explain the topic "${topic_title}" in depth. Include definitions, key concepts, real-world examples, and why it matters. Provide detailed educational content.` }]
          }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 3000 }
        });
        const searchContext = searchResult.response.text();
        if (searchContext && searchContext.length > 100) {
          enrichedContent = `${topic_content ? `Student's notes: ${topic_content}\n\n` : ''}Research on topic:\n${searchContext}`;
        }
      } catch (searchErr) {
        console.warn("Search grounding failed:", searchErr.message);
        // Proceed with whatever content we have
      }
    }

    const finalContent = enrichedContent || `The topic "${topic_title}" as taught in ${course_name || 'this course'}.`;

    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    const result = await model.generateContent({
      contents: [{
        role: 'user',
        parts: [{
          text: `You are an expert university lecturer teaching "${course_name || 'this course'}".

Write a rich, detailed lecture on the topic: "${topic_title}"

CONTENT TO BASE THE LECTURE ON:
${finalContent}

INSTRUCTIONS:
- Start with "## ${topic_title}" as the title
- Write 3-5 key concept sections using ### headings
- For EACH concept:
  1. Define it clearly in 1-2 sentences
  2. Walk through a **concrete worked example** or **real-world case study** step by step — show numbers, scenarios, or actual applications
  3. Use the **Socratic method**: pose a thought-provoking question to the student mid-section (e.g. "So what do you think would happen if...?"), then answer it to deepen understanding
  4. Explain why it matters and connect it to the bigger picture
- Write in a warm, engaging, conversational tone — as if a tutor is speaking directly to one student
- Each section should be 150-250 words of flowing prose (no bullet points)
- Prioritize **practical examples, case-based reasoning, and problem-solving walkthroughs** over pure theory
- Include smooth transitions between sections
- End with a short "## Key Takeaways" summary paragraph
- Total length: 800-1200 words

Write the full lecture now:`
        }]
      }],
      generationConfig: { temperature: 0.7, maxOutputTokens: 6000 }
    });

    const lectureText = result.response.text();

    // Persist the lecture to the lesson entity if lesson_id provided
    if (lesson_id && lectureText) {
      try {
        const lessons = await base44.entities.Lesson.filter({ id: lesson_id });
        if (lessons.length > 0) {
          const lesson = lessons[0];
          const savedLectures = lesson.saved_lectures || {};
          savedLectures[topic_title] = lectureText;
          await base44.entities.Lesson.update(lesson_id, { saved_lectures: savedLectures });
        }
      } catch (saveErr) {
        console.warn("Could not save lecture:", saveErr.message);
      }
    }

    return Response.json({ success: true, lecture: lectureText });
  } catch (error) {
    console.error("generateMiniLecture error:", error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});