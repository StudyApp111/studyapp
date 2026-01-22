import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    console.log('=== curriculumMapping Start ===');
    
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
        if (!apiKey) {
            return Response.json({ error: 'Service configuration error' }, { status: 500 });
        }

        // Use structured output with gemini-flash-latest
        const curriculumSchema = {
            type: "object",
            properties: {
                core_competencies: {
                    type: "array",
                    items: {
                        type: "object",
                        properties: {
                            name: { type: "string" },
                            description: { type: "string" }
                        }
                    }
                },
                competency_weightings: {
                    type: "array",
                    items: {
                        type: "object",
                        properties: {
                            competency_name: { type: "string" },
                            weight_percentage: { type: "string" }
                        }
                    }
                },
                question_formats: {
                    type: "array",
                    items: {
                        type: "object",
                        properties: {
                            type: { type: "string" },
                            frequency: { type: "string" },
                            examples: { type: "array", items: { type: "string" } }
                        }
                    }
                },
                high_yield_focal_points: { type: "array", items: { type: "string" } },
                common_misconceptions: { type: "array", items: { type: "string" } }
            }
        };

        const requestBody = {
            contents: [{
                parts: [{ text: prompt }]
            }],
            generationConfig: {
                temperature: 0.2,
                maxOutputTokens: 4096,
                responseMimeType: "application/json",
                responseSchema: curriculumSchema
            }
        };

        console.log('Calling Gemini (global endpoint)...');
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody)
            }
        );

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Gemini API error:', response.status, errorText);
            return Response.json({ error: 'API error', details: errorText.substring(0, 200) }, { status: 500 });
        }

        const data = await response.json();
        const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!generatedText) {
            console.error('No content generated');
            return Response.json({ error: 'No content generated' }, { status: 500 });
        }

        let parsed;
        try {
            parsed = JSON.parse(generatedText);
        } catch (e) {
            console.error('JSON parse failed:', e.message);
            return Response.json({ error: 'Failed to parse response' }, { status: 500 });
        }

        console.log('=== curriculumMapping Complete ===');
        return Response.json(parsed);

    } catch (error) {
        console.error('Error:', error.message);
        return Response.json({ error: error.message }, { status: 500 });
    }
});