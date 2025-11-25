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
            return Response.json({ error: 'Service configuration error' }, { status: 500 });
        }

        // Google Search grounding cannot be used with JSON response mode
        // Use two-step: first get grounded info, then format as JSON
        const groundedRequestBody = {
            contents: [{
                parts: [{
                    text: prompt + "\n\nProvide your response as a valid JSON object."
                }]
            }],
            generationConfig: {
                temperature: 0.2,
                topP: 0.95,
                maxOutputTokens: 8192
            },
            safetySettings: [
                { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
                { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
                { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
                { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
            ],
            tools: [{
                google_search: {}
            }]
        };

        const requestBody = groundedRequestBody;

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody)
            }
        );

        if (!response.ok) {
            return Response.json({ 
                error: 'Failed to generate content' 
            }, { status: 500 });
        }

        const data = await response.json();
        
        // Find text content from grounded response
        let generatedText = null;
        const parts = data.candidates?.[0]?.content?.parts || [];
        for (const part of parts) {
            if (part.text) {
                generatedText = part.text;
                break;
            }
        }
        
        if (!generatedText) {
            console.error('No content:', JSON.stringify(data));
            return Response.json({ 
                error: 'No content generated' 
            }, { status: 500 });
        }

        // Extract JSON from response (may have markdown code blocks)
        let jsonStr = generatedText;
        const jsonMatch = generatedText.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (jsonMatch) {
            jsonStr = jsonMatch[1].trim();
        }

        try {
            const parsedResponse = JSON.parse(jsonStr);
            return Response.json(parsedResponse);
        } catch (parseError) {
            console.error('Parse error:', parseError.message, 'Raw:', generatedText.substring(0, 500));
            return Response.json({ 
                error: 'Failed to process response' 
            }, { status: 500 });
        }

    } catch (error) {
        return Response.json({ 
            error: 'Internal server error' 
        }, { status: 500 });
    }
});