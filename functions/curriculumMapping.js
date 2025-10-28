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

        // Enhanced prompt to request JSON format
        const enhancedPrompt = prompt + "\n\nIMPORTANT: You must respond with ONLY valid JSON matching the exact schema provided. Do not include any explanatory text before or after the JSON. Start your response with { and end with }.";

        // Prepare the request body for Gemini API with Google Search grounding
        // Note: Cannot use responseMimeType with tools, so we request JSON in the prompt
        const requestBody = {
            contents: [{
                parts: [{
                    text: enhancedPrompt
                }]
            }],
            generationConfig: {
                temperature: 0.2,
                topP: 0.95,
                maxOutputTokens: 8192
            },
            tools: [{
                googleSearch: {}
            }]
        };

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

        // Parse JSON response
        try {
            // Clean the response - remove markdown code blocks if present
            let cleanedText = generatedText.trim();
            if (cleanedText.startsWith('```json')) {
                cleanedText = cleanedText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
            } else if (cleanedText.startsWith('```')) {
                cleanedText = cleanedText.replace(/^```\s*/, '').replace(/\s*```$/, '');
            }
            
            const parsedResponse = JSON.parse(cleanedText);
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