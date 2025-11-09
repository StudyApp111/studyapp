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

        // Enhanced prompt with explicit JSON schema instructions
        const jsonSchemaString = JSON.stringify(response_json_schema, null, 2);
        const enhancedPrompt = `${prompt}

CRITICAL OUTPUT REQUIREMENTS:
You must respond with ONLY a valid JSON object matching this EXACT schema. No markdown, no explanations, no text before or after the JSON. Start with { and end with }.

Required JSON Schema:
${jsonSchemaString}

IMPORTANT FORMATTING RULES:
- weight_percentage must be strings like "20%" or "15%" (include % symbol)
- frequency must be strings like "30%" or "Common" or "Rare"
- All string fields must use double quotes
- Ensure all required fields are included
- Make sure arrays are properly formatted

Your response must be valid, parseable JSON that exactly matches the schema above.`;

        // Prepare the request body for Gemini 2.0 Flash Experimental with Google Search grounding
        const requestBody = {
            contents: [{
                parts: [{
                    text: enhancedPrompt
                }]
            }],
            generationConfig: {
                temperature: 0.3,
                topP: 0.95,
                topK: 40,
                maxOutputTokens: 8192
            },
            tools: [{
                googleSearch: {}
            }]
        };

        console.log('Calling Gemini 2.0 Flash Experimental with Google Search grounding...');

        // Call Gemini 2.0 Flash Experimental API (the actual latest Flash model)
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
                details: errorData,
                status: response.status
            }, { status: response.status });
        }

        const data = await response.json();
        console.log('Gemini 2.0 Flash response received');
        
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

        // Parse JSON response with multiple cleanup attempts
        let parsedResponse;
        let cleanedText = generatedText.trim();
        
        // Attempt 1: Remove markdown code blocks
        if (cleanedText.startsWith('```json')) {
            cleanedText = cleanedText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
        } else if (cleanedText.startsWith('```')) {
            cleanedText = cleanedText.replace(/^```\s*/, '').replace(/\s*```$/, '');
        }
        
        // Attempt 2: Try parsing
        try {
            parsedResponse = JSON.parse(cleanedText);
            console.log('Successfully parsed curriculum map with Gemini 2.0 Flash + Google grounding');
            return Response.json(parsedResponse);
        } catch (parseError) {
            console.error('First parse attempt failed:', parseError.message);
            
            // Attempt 3: Find JSON object in text
            const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                try {
                    parsedResponse = JSON.parse(jsonMatch[0]);
                    console.log('Successfully parsed curriculum map (extracted from text)');
                    return Response.json(parsedResponse);
                } catch (extractError) {
                    console.error('Extract parse failed:', extractError.message);
                }
            }
            
            // Final attempt failed
            console.error('All parse attempts failed. Raw text preview:', cleanedText.substring(0, 500));
            return Response.json({ 
                error: 'Failed to parse AI response as JSON', 
                details: parseError.message,
                raw_text_preview: cleanedText.substring(0, 500)
            }, { status: 500 });
        }

    } catch (error) {
        console.error('Error in curriculumMapping function:', error);
        return Response.json({ 
            error: error.message,
            stack: error.stack
        }, { status: 500 });
    }
});