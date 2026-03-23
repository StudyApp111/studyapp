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

    const { prompt } = await req.json();

    if (!prompt) {
      return Response.json({ error: 'Prompt is required' }, { status: 400 });
    }

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
              cards: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    question: { type: "string" },
                    model_answer: { type: "string" }
                  },
                  required: ["question", "model_answer"]
                }
              }
            },
            required: ["cards"]
          }
        }
      })
    }, 3);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Gemini API error:", errorText);
      return Response.json({ error: 'Failed to generate teach it cards' }, { status: 500 });
    }

    const result = await response.json();
    const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!text) {
      return Response.json({ error: 'No response from AI' }, { status: 500 });
    }

    const parsed = JSON.parse(text);
    return Response.json(parsed);

  } catch (error) {
    console.error("Error generating teach it cards:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});