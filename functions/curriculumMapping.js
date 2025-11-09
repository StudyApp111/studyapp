import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

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
            return Response.json({ error: 'API_KEY not configured' }, { status: 500 });
        }

        // Prepare the request body for Gemini 2.5 Flash with Google Search Grounding
        const requestBody = {
            contents: [{
                parts: [{
                    text: prompt
                }]
            }],
            generationConfig: {
                temperature: 0.3,
                topP: 0.95,
                maxOutputTokens: 8192,
                responseMimeType: "application/json",
                responseSchema: response_json_schema
            },
            tools: [{
                googleSearchRetrieval: {
                    dynamicRetrievalConfig: {
                        mode: "MODE_DYNAMIC",
                        dynamicThreshold: 0.3
                    }
                }
            }]
        };

        // Call Gemini 2.5 Flash API
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody)
            }
        );

        if (!response.ok) {
            const errorData = await response.text();
            console.error('Gemini API Error:', errorData);
            return Response.json({ 
                error: 'Gemini API request failed', 
                details: errorData 
            }, { status: response.status });
        }

        const data = await response.json();
        
        // Extract the generated content
        const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text;
        
        if (!generatedText) {
            console.error('No content generated from Gemini:', data);
            return Response.json({ 
                error: 'No content generated', 
                details: data 
            }, { status: 500 });
        }

        // Parse JSON response (should already be valid JSON from responseMimeType)
        try {
            const parsedResponse = JSON.parse(generatedText);
            return Response.json(parsedResponse);
        } catch (parseError) {
            console.error('Failed to parse JSON:', parseError);
            console.error('Raw text:', generatedText);
            return Response.json({ 
                error: 'Failed to parse JSON response', 
                raw_text: generatedText 
            }, { status: 500 });
        }

    } catch (error) {
        console.error('Error in curriculumMapping:', error);
        return Response.json({ 
            error: error.message 
        }, { status: 500 });
    }
});