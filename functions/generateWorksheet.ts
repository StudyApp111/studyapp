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

        // Enhance prompt with strict formatting rules
        const enhancedPrompt = prompt + `\n\nCRITICAL FORMATTING RULES:
1. All text fields (question_text, explanation, etc.) MUST have properly escaped quotes and special characters
2. For ANY Multiple Choice question:
   - ALWAYS provide exactly 4 options in the "options" array
   - Each option must be a clear, distinct answer choice
   - One option must match the "correct_answer" exactly
   - Example: "options": ["Option A", "Option B", "Option C", "Option D"]
3. NEVER leave the "options" array empty or null for Multiple Choice questions
4. If you cannot create valid multiple choice options, use a different question_type instead
5. Use single quotes within text or escape double quotes as \\"
6. Do not use unescaped newlines within string values`;

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

        if (response_json_schema) {
            requestBody.generationConfig.responseMimeType = "application/json";
            requestBody.generationConfig.responseSchema = response_json_schema;
        }

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
        const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text;
        
        if (!generatedText) {
            console.error('No content generated from Gemini:', data);
            return Response.json({ 
                error: 'No content generated', 
                details: data 
            }, { status: 500 });
        }

        if (response_json_schema) {
            try {
                let cleanedText = generatedText.trim();
                if (cleanedText.startsWith('```json')) {
                    cleanedText = cleanedText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
                } else if (cleanedText.startsWith('```')) {
                    cleanedText = cleanedText.replace(/^```\s*/, '').replace(/\s*```$/, '');
                }
                
                const parsedResponse = JSON.parse(cleanedText);
                
                // CRITICAL: Validate and fix Multiple Choice questions
                if (parsedResponse.worksheet_questions) {
                    parsedResponse.worksheet_questions = parsedResponse.worksheet_questions.map(q => {
                        const isMultipleChoice = q.question_type?.toLowerCase().includes('multiple choice') || 
                                               q.question_type?.toLowerCase().includes('mcq');
                        
                        if (isMultipleChoice) {
                            // Ensure options exist and have at least 2 items
                            if (!q.options || q.options.length < 2) {
                                console.warn(`Question ${q.question_number} is MCQ but has invalid options. Converting to Short Answer.`);
                                q.question_type = "Short Answer";
                                q.options = null; // Remove invalid options
                            } else if (q.options.length < 4) {
                                // If less than 4 options, pad with generic options
                                console.warn(`Question ${q.question_number} has only ${q.options.length} options. Padding to 4.`);
                                while (q.options.length < 4) {
                                    q.options.push(`Option ${String.fromCharCode(65 + q.options.length)}`);
                                }
                            }
                        }
                        return q;
                    });
                }
                
                return Response.json(parsedResponse);
            } catch (parseError) {
                console.error('Failed to parse JSON:', parseError);
                console.error('Raw text (first 1000 chars):', generatedText.substring(0, 1000));
                
                try {
                    let fixedText = generatedText
                        .replace(/\\n/g, ' ')
                        .replace(/\n/g, ' ')
                        .replace(/\r/g, ' ')
                        .replace(/\t/g, ' ')
                        .trim();
                    
                    if (fixedText.startsWith('```')) {
                        fixedText = fixedText.replace(/^```json?\s*/, '').replace(/\s*```$/, '');
                    }
                    
                    const retryParsed = JSON.parse(fixedText);
                    
                    // Validate MCQs here too
                    if (retryParsed.worksheet_questions) {
                        retryParsed.worksheet_questions = retryParsed.worksheet_questions.map(q => {
                            const isMultipleChoice = q.question_type?.toLowerCase().includes('multiple choice') || 
                                                   q.question_type?.toLowerCase().includes('mcq');
                            
                            if (isMultipleChoice && (!q.options || q.options.length < 2)) {
                                q.question_type = "Short Answer";
                                q.options = null;
                            }
                            return q;
                        });
                    }
                    
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