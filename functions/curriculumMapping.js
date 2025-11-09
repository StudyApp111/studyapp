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

        const grokApiKey = Deno.env.get("GROK_API_KEY");
        if (!grokApiKey) {
            return Response.json({ error: 'GROK_API_KEY not configured' }, { status: 500 });
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

        // Prepare the request body for Grok-3
        const requestBody = {
            messages: [{
                role: "user",
                content: enhancedPrompt
            }],
            model: "grok-3",
            temperature: 0.3,
            max_tokens: 8192,
            response_format: {
                type: "json_object"
            }
        };

        console.log('Calling Grok-3 API...');

        // Call Grok-3 API
        const response = await fetch(
            'https://api.x.ai/v1/chat/completions',
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${grokApiKey}`
                },
                body: JSON.stringify(requestBody)
            }
        );

        if (!response.ok) {
            const errorData = await response.text();
            console.error('Grok API Error:', errorData);
            return Response.json({ 
                error: 'Grok API request failed', 
                details: errorData,
                status: response.status
            }, { status: response.status });
        }

        const data = await response.json();
        console.log('Grok-3 response received');
        
        // Extract the generated content
        const generatedText = data.choices?.[0]?.message?.content;
        
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
            console.log('Successfully parsed curriculum map with Grok-3');
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