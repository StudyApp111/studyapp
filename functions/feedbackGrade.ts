import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    console.log('=== feedbackGrade function called ===');
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        console.log('User authenticated:', user.email);

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { prompt, response_json_schema } = await req.json();
        console.log('Request params:', {
            promptLength: prompt?.length,
            hasSchema: !!response_json_schema,
            schemaKeys: response_json_schema ? Object.keys(response_json_schema) : []
        });

        if (!prompt) {
            return Response.json({ error: 'Prompt is required' }, { status: 400 });
        }

        const apiKey = Deno.env.get("API_KEY");
        if (!apiKey) {
            return Response.json({ error: 'Service configuration error' }, { status: 500 });
        }

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
            },
            safetySettings: [
                { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_LOW_AND_ABOVE" },
                { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_LOW_AND_ABOVE" },
                { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_LOW_AND_ABOVE" },
                { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_LOW_AND_ABOVE" }
            ]
        };

        if (response_json_schema) {
            requestBody.generationConfig.responseMimeType = "application/json";
            requestBody.generationConfig.responseSchema = response_json_schema;
        }

        console.log('Calling Gemini API with:', {
            model: 'gemini-2.5-flash',
            promptLength: prompt.length,
            hasSchema: !!response_json_schema,
            temperature: requestBody.generationConfig.temperature
        });

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
        
        console.log('Gemini API response status:', response.status);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Gemini API Error:', response.status, errorText);
            return Response.json({ 
                error: 'Failed to generate feedback',
                details: errorText.substring(0, 500)
            }, { status: 500 });
        }

        const data = await response.json();
        console.log('Gemini response structure:', JSON.stringify(data).substring(0, 500));
        
        const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text;
        
        if (!generatedText) {
            console.error('No content in Gemini response:', JSON.stringify(data));
            return Response.json({ 
                error: 'No content generated',
                details: `Response structure: ${JSON.stringify(data).substring(0, 300)}`
            }, { status: 500 });
        }

        if (response_json_schema) {
            try {
                const parsedResponse = JSON.parse(generatedText);
                return Response.json(parsedResponse);
            } catch (parseError) {
                return Response.json({ 
                    error: 'Failed to process feedback' 
                }, { status: 500 });
            }
        }

        return Response.json({ text: generatedText });

    } catch (error) {
        console.error('feedbackGrade function error:', error);
        return Response.json({ 
            error: 'Internal server error',
            message: error.message,
            details: error.toString().substring(0, 500)
        }, { status: 500 });
    }
});