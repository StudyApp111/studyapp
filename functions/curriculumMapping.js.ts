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

        console.log('Calling Gemini 2.5-flash for curriculum mapping...');

        // Prepare the request body for Gemini API
        const requestBody = {
            contents: [{
                parts: [{
                    text: prompt
                }]
            }],
            generationConfig: {
                temperature: 0.2,
                topP: 0.95,
                maxOutputTokens: 8192
            }
        };

        // Add response schema if provided
        if (response_json_schema) {
            requestBody.generationConfig.responseMimeType = "application/json";
            requestBody.generationConfig.responseSchema = response_json_schema;
        }

        // Call Gemini 2.5 Flash API
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
            const errorData = await response.text();
            console.error('Gemini API Error:', errorData);
            return Response.json({ 
                error: 'Gemini API request failed', 
                details: errorData,
                status: response.status
            }, { status: response.status });
        }

        const data = await response.json();
        console.log('Gemini response received');
        
        // Extract the generated content
        const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text;
        
        if (!generatedText) {
            console.error('No content generated:', JSON.stringify(data, null, 2));
            return Response.json({ 
                error: 'No content generated from AI', 
                details: data 
            }, { status: 500 });
        }

        console.log('Generated curriculum map - text length:', generatedText.length);

        // Parse JSON response if schema was provided
        if (response_json_schema) {
            try {
                const parsedResponse = JSON.parse(generatedText);
                console.log('Successfully parsed curriculum map with Gemini 2.5-flash');
                return Response.json(parsedResponse);
            } catch (parseError) {
                console.error('Failed to parse JSON:', parseError);
                return Response.json({ 
                    error: 'Failed to parse JSON response', 
                    raw_text: generatedText.substring(0, 500)
                }, { status: 500 });
            }
        }

        return Response.json({ text: generatedText });

    } catch (error) {
        console.error('Error in curriculumMapping function:', error);
        return Response.json({ 
            error: error.message,
            stack: error.stack
        }, { status: 500 });
    }
});