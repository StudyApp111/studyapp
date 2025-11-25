import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { prompt, response_json_schema } = await req.json();

        if (!prompt) {
            return Response.json({ error: 'Prompt is required' }, { status: 400 });
        }

        const apiKey = Deno.env.get("API_KEY");
        if (!apiKey) {
            return Response.json({ error: 'Gemini API key not configured' }, { status: 500 });
        }

        console.log('=== CURRICULUM MAPPING WITH GEMINI ===');
        console.log('Prompt length:', prompt.length);

        // Use Gemini 2.5 Flash with Google Search grounding
        const requestBody = {
            contents: [{
                parts: [{
                    text: prompt
                }]
            }],
            generationConfig: {
                temperature: 0.2,
                responseMimeType: "application/json",
                responseSchema: response_json_schema
            },
            tools: [{
                google_search: {}
            }]
        };

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody)
            }
        );

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Gemini API error:', errorText);
            return Response.json({ 
                error: 'Gemini API request failed',
                details: errorText
            }, { status: 500 });
        }

        const data = await response.json();
        const content = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!content) {
            console.error('No content in Gemini response:', JSON.stringify(data));
            return Response.json({ error: 'No content from Gemini' }, { status: 500 });
        }

        console.log('Result preview:', content.substring(0, 500));

        // Parse the JSON response
        const result = JSON.parse(content);
        return Response.json(result);

    } catch (error) {
        console.error('Curriculum mapping error:', error);
        return Response.json({ 
            error: 'Internal server error',
            details: error.message
        }, { status: 500 });
    }
});