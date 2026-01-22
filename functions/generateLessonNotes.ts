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

        const { lesson_content, note_type, custom_instructions } = await req.json();

        if (!lesson_content) {
            return Response.json({ error: 'Lesson content is required' }, { status: 400 });
        }

        const apiKey = Deno.env.get("GEMINIAPIKEY");
        if (!apiKey) {
            return Response.json({ error: 'Service configuration error' }, { status: 500 });
        }

        let systemPrompt = `You are an expert study assistant. Your task is to generate "${note_type}" based on the provided lesson content. Use Markdown formatting and ensure good formatting practices inlcuding spaces, bold, sections, lines, etc...`;

        if (note_type === 'Detailed Notes') {
            systemPrompt += " Create comprehensive, well-structured study notes covering all key concepts, definitions, and examples in depth.";
        } else if (note_type === 'Cheat Sheet') {
            systemPrompt += " Create a condensed, high-density reference guide containing formulas, key dates, essential definitions, and crucial facts. Optimize for quick lookup.";
        } else if (note_type === 'Short Summary') {
            systemPrompt += " Create a brief, concise summary of the main ideas and takeaways. Keep it high-level and easy to digest.";
        } else if (note_type === 'Exam Prep') {
            systemPrompt += " Create test-focused notes highlighting high-yield topics, potential exam questions, and common pitfalls. Focus on what is likely to be tested.";
        }

        if (custom_instructions) {
            systemPrompt += `\n\nAdditional User Instructions: ${custom_instructions.substring(0, 500)}`;
        }

        const payload = {
            contents: [{
                parts: [{
                    text: `Content to process:\n${lesson_content}\n\nGenerate the ${note_type}:`
                }]
            }],
            systemInstruction: {
                parts: [{ text: systemPrompt }]
            },
            generationConfig: {
                temperature: 0.3,
                maxOutputTokens: 8192,
            }
        };

        // Using retry logic for rate limit handling
        const response = await fetchWithRetry(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            },
            3
        );

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Gemini API error:', response.status, errorText);
            return Response.json({ error: 'Failed to generate notes', details: errorText }, { status: 500 });
        }

        const data = await response.json();
        const generatedText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!generatedText) {
            return Response.json({ error: 'No content generated' }, { status: 500 });
        }

        return Response.json({ content: generatedText });

    } catch (error) {
        console.error('Error in generateLessonNotes:', error);
        return Response.json({ error: 'Internal server error', message: error.message }, { status: 500 });
    }
});