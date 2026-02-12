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

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { course_name, content, focus_topics, amount, difficulty } = await req.json();

    if (!content) {
      return Response.json({ error: 'Content is required' }, { status: 400 });
    }

    const cardCount = Math.min(Math.max(amount || 10, 5), 20);
    const difficultyPref = difficulty || 'mixed';

    const focusInstruction = focus_topics?.length > 0 
      ? `\n\nPRIORITY FOCUS: Generate cards that specifically cover these topics (from the student's study plan):
${focus_topics.map((t, i) => `${i + 1}. ${t}`).join('\n')}

At least ${Math.ceil(cardCount * 0.6)} of the ${cardCount} flashcards should directly address these focus topics.`
      : '';

    const difficultyInstruction = difficultyPref !== 'mixed'
      ? `\n6. ALL cards should be "${difficultyPref}" difficulty level.`
      : `\n6. Vary in difficulty (mark as easy, medium, or hard)`;

    const prompt = `Generate exactly ${cardCount} high-quality flashcards for this course: ${course_name || 'Course'}

Content: ${content}
${focusInstruction}

Create flashcards that:
1. Cover key concepts, definitions, and important facts
2. Are clear and concise
3. Have a question/front side and detailed answer/back side
4. Include topic tags for categorization
5. Are grounded in the provided content${difficultyInstruction}

Return a JSON object with a "flashcards" array containing objects with: question, answer, topics (array), difficulty (easy/medium/hard)`;

    const apiKey = Deno.env.get("GEMINIAPIKEY");
    
    const response = await fetchWithRetry("https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=" + apiKey, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: prompt }]
        }],
        generationConfig: {
          temperature: 0.7,
          responseMimeType: "application/json",
          responseSchema: {
            type: "object",
            properties: {
              flashcards: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    question: { type: "string" },
                    answer: { type: "string" },
                    topics: { type: "array", items: { type: "string" } },
                    difficulty: { type: "string", enum: ["easy", "medium", "hard"] }
                  },
                  required: ["question", "answer", "topics", "difficulty"]
                }
              }
            },
            required: ["flashcards"]
          }
        }
      })
    }, 3);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Gemini API error:", errorText);
      return Response.json({ error: 'Failed to generate flashcards' }, { status: 500 });
    }

    const result = await response.json();
    const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!text) {
      return Response.json({ error: 'No response from AI' }, { status: 500 });
    }

    const parsed = JSON.parse(text);
    return Response.json(parsed);

  } catch (error) {
    console.error("Error generating flashcards:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});