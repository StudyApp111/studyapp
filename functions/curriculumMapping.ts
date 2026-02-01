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

        console.log('Calling Gemini 2.5-flash with Google Search grounding for curriculum mapping...');

        // Enhance prompt to explicitly request JSON format
        const enhancedPrompt = `${prompt}

CRITICAL OUTPUT REQUIREMENT:
You MUST respond with a valid JSON object that strictly follows this schema:
${JSON.stringify(response_json_schema, null, 2)}

Do not include any markdown formatting, code blocks, or explanatory text.
Return ONLY the raw JSON object.`;

        // Prepare the request body for Gemini API WITH Google Search grounding
        // When using tools, we CANNOT use responseMimeType/responseSchema
        const requestBody = {
            contents: [{
                parts: [{
                    text: enhancedPrompt
                }]
            }],
            tools: [{
                google_search: {}
            }],
            generationConfig: {
                temperature: 0.2,
                topP: 0.95,
                maxOutputTokens: 8192
            }
        };

        // Call Gemini 2.5 Flash API with Google Search
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent?key=${apiKey}`,
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

        // Parse JSON response with multiple cleanup attempts
        let parsedResponse;
        let cleanedText = generatedText.trim();
        
        // Attempt 1: Remove markdown code blocks
        if (cleanedText.startsWith('```json')) {
            cleanedText = cleanedText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
        } else if (cleanedText.startsWith('```')) {
            cleanedText = cleanedText.replace(/^```\s*/, '').replace(/\s*```$/, '');
        }
        
        cleanedText = cleanedText.trim();
        
        // Attempt 2: Try direct parsing
        try {
            parsedResponse = JSON.parse(cleanedText);
            console.log('Successfully parsed curriculum map with Gemini 2.5-flash + Google Search');
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
            
            // Attempt 4: Try to extract JSON between first { and last }
            const firstBrace = cleanedText.indexOf('{');
            const lastBrace = cleanedText.lastIndexOf('}');
            if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
                try {
                    const extracted = cleanedText.substring(firstBrace, lastBrace + 1);
                    parsedResponse = JSON.parse(extracted);
                    console.log('Successfully parsed curriculum map (full extraction)');
                    return Response.json(parsedResponse);
                } catch (extractError2) {
                    console.error('Full extraction parse failed:', extractError2.message);
                }
            }
            
            // Final attempt failed
            console.error('All parse attempts failed. Raw text preview:', cleanedText.substring(0, 500));
            return Response.json({ 
                error: 'Failed to parse AI response as JSON', 
                details: parseError.message,
                raw_text_preview: cleanedText.substring(0, 1000),
                parse_attempts: 'Tried 4 different parsing strategies'
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