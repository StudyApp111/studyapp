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
            return Response.json({ error: 'prompt is required' }, { status: 400 });
        }

        const apiKey = Deno.env.get("API_KEY");
        if (!apiKey) {
            console.error('API_KEY not found in environment');
            return Response.json({ error: 'API_KEY not configured' }, { status: 500 });
        }

        console.log('Starting assignment grading...');
        console.log('Prompt length:', prompt.length);
        console.log('Has JSON schema:', !!response_json_schema);

        let requestBody = {
            contents: [
                {
                    role: "user",
                    parts: [
                        {
                            text: prompt
                        }
                    ]
                }
            ],
            generationConfig: {
                temperature: 0.3,
                topP: 0.95,
                topK: 40,
                maxOutputTokens: 16384
            }
        };

        if (response_json_schema) {
            requestBody.generationConfig.responseMimeType = "application/json";
            requestBody.generationConfig.responseSchema = response_json_schema;
        }

        const apiUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=' + apiKey;

        console.log('Calling Gemini API...');
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });

        console.log('Gemini API response status:', response.status);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Gemini API error:', errorText);
            return Response.json({
                error: 'API request failed',
                details: errorText,
                status: response.status
            }, { status: response.status });
        }

        const data = await response.json();
        console.log('Response received');

        if (!data.candidates || data.candidates.length === 0) {
            console.error('No candidates in response');
            return Response.json({
                error: 'No response generated',
                details: 'API returned empty candidates'
            }, { status: 500 });
        }

        const generatedText = data.candidates[0].content.parts[0].text;

        if (response_json_schema) {
            try {
                const parsed = JSON.parse(generatedText);
                console.log('Successfully parsed JSON response');
                return Response.json({ data: parsed });
            } catch (parseError) {
                console.error('Failed to parse JSON:', parseError);
                return Response.json({
                    error: 'Failed to parse response as JSON',
                    raw_text: generatedText
                }, { status: 500 });
            }
        }

        return Response.json({ data: generatedText });

    } catch (error) {
        console.error('Error in gradeAssignment:', error);
        return Response.json({
            error: error.message,
            stack: error.stack
        }, { status: 500 });
    }
});