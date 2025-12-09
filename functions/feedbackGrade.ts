import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    console.log('=== feedbackGrade called ===');
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
                { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_ONLY_HIGH" },
                { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_ONLY_HIGH" },
                { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_ONLY_HIGH" },
                { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_ONLY_HIGH" }
            ]
        };

        if (response_json_schema) {
            requestBody.generationConfig.responseMimeType = "application/json";
            requestBody.generationConfig.responseSchema = response_json_schema;
        }

        console.log('Calling Gemini API...');
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
            const errorText = await response.text();
            console.error('Gemini API error:', response.status, errorText);
            return Response.json({ 
                error: 'Gemini API error',
                details: errorText.substring(0, 500)
            }, { status: 500 });
        }

        const data = await response.json();
        const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text;
        
        if (!generatedText) {
            console.error('No content generated:', JSON.stringify(data).substring(0, 500));
            return Response.json({ 
                error: 'No content generated',
                details: 'Empty response from Gemini'
            }, { status: 500 });
        }

        console.log('Generated text length:', generatedText.length);

        if (response_json_schema) {
            try {
                const parsedResponse = JSON.parse(generatedText);
                console.log('JSON parsed successfully');
                return Response.json(parsedResponse);
            } catch (parseError) {
                console.error('=== JSON PARSE ERROR ===');
                console.error('Error message:', parseError.message);
                console.error('Full text:', generatedText);
                
                return Response.json({ 
                    error: 'Failed to parse JSON response',
                    details: parseError.message,
                    textPreview: generatedText.substring(0, 1000)
                }, { status: 500 });
            }
        }

        return Response.json({ text: generatedText });

    } catch (error) {
        console.error('feedbackGrade error:', error.message);
        console.error('Stack:', error.stack);
        return Response.json({ 
            error: 'Internal server error',
            details: error.message
        }, { status: 500 });
    }
});