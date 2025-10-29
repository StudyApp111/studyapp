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

        // Enhance prompt to ensure valid JSON output
        const enhancedPrompt = prompt + `\n\nCRITICAL: Ensure all text fields (question_text, explanation, etc.) have properly escaped quotes and special characters. Use single quotes within text or escape double quotes as \\". Do not use unescaped newlines within string values.`;

        // Prepare the request body for Gemini API (NO Google Search grounding)
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

        // Parse JSON response if schema was provided
        if (response_json_schema) {
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
                console.error('Raw text (first 1000 chars):', generatedText.substring(0, 1000));
                console.error('Raw text (last 500 chars):', generatedText.substring(Math.max(0, generatedText.length - 500)));
                
                // Try to fix common JSON issues
                try {
                    // Replace unescaped newlines within strings
                    let fixedText = generatedText
                        .replace(/\\n/g, ' ')  // Replace literal \n with space
                        .replace(/\n/g, ' ')   // Replace actual newlines with space
                        .replace(/\r/g, ' ')   // Replace carriage returns
                        .replace(/\t/g, ' ')   // Replace tabs
                        .trim();
                    
                    // Try to remove markdown if present
                    if (fixedText.startsWith('```')) {
                        fixedText = fixedText.replace(/^```json?\s*/, '').replace(/\s*```$/, '');
                    }
                    
                    const retryParsed = JSON.parse(fixedText);
                    console.log('Successfully parsed after cleanup');
                    return Response.json(retryParsed);
                } catch (retryError) {
                    console.error('Retry parse also failed:', retryError);
                    return Response.json({ 
                        error: 'Failed to parse JSON response after cleanup', 
                        raw_text_preview: generatedText.substring(0, 500),
                        parse_error: parseError.message,
                        retry_error: retryError.message
                    }, { status: 500 });
                }
            }
        }

        return Response.json({ text: generatedText });

    } catch (error) {
        console.error('Error in generateWorksheet:', error);
        return Response.json({ 
            error: error.message 
        }, { status: 500 });
    }
});