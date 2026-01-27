import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { courseName, school, grade } = await req.json();

        if (!courseName) {
            return Response.json({ error: 'Course name is required' }, { status: 400 });
        }

        const apiKey = Deno.env.get("API_KEY");
        if (!apiKey) {
            return Response.json({ error: 'Service configuration error' }, { status: 500 });
        }

        // Faster, more direct prompt without search grounding for speed
        const prompt = `You are an expert educator. Generate exactly 4 high-quality study topics for this course.

Course: ${courseName}
${school ? `School context: ${school}` : ''}

Return ONLY a JSON array with 4 specific, actionable study topics. Each topic should be 10-20 words describing a key concept or unit from this course.

Example format:
["Introduction to supply and demand curves and market equilibrium", "Elasticity concepts and their real-world applications", "Consumer theory and utility maximization", "Production costs and firm behavior in competitive markets"]

Output only the JSON array, no other text:`;

        const requestBody = {
            contents: [{
                parts: [{ text: prompt }]
            }],
            generationConfig: {
                temperature: 0.3,
                topP: 0.9,
                maxOutputTokens: 512
            }
        };

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody),
                signal: controller.signal
            }
        );
        clearTimeout(timeoutId);

        if (!response.ok) {
            console.error('Gemini API error:', response.status);
            return Response.json({ topics: [] });
        }

        const data = await response.json();
        
        let generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        
        if (!generatedText.trim()) {
            return Response.json({ topics: [] });
        }

        // Clean and parse JSON
        let jsonStr = generatedText.trim();
        
        // Remove markdown if present
        const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (jsonMatch) {
            jsonStr = jsonMatch[1].trim();
        }
        
        // Find array boundaries
        const arrayStart = jsonStr.indexOf('[');
        const arrayEnd = jsonStr.lastIndexOf(']');
        if (arrayStart !== -1 && arrayEnd !== -1) {
            jsonStr = jsonStr.substring(arrayStart, arrayEnd + 1);
        }

        try {
            const topics = JSON.parse(jsonStr);
            if (Array.isArray(topics)) {
                return Response.json({ topics: topics.slice(0, 4) });
            }
        } catch (e) {
            console.error('Parse error:', e.message);
        }

        return Response.json({ topics: [] });

    } catch (error) {
        console.error('Error:', error.message);
        return Response.json({ topics: [] });
    }
});