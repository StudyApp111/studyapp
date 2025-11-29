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
            return Response.json({ error: 'Prompt is required' }, { status: 400 });
        }

        const apiKey = Deno.env.get("API_KEY");
        if (!apiKey) {
            return Response.json({ error: 'Service configuration error' }, { status: 500 });
        }

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
            return Response.json({ 
                error: 'Failed to generate content' 
            }, { status: 500 });
        }

        const data = await response.json();
        const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text;
        
        if (!generatedText) {
            return Response.json({ 
                error: 'No content generated' 
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
                
                if (parsedResponse.worksheet_questions) {
                    parsedResponse.worksheet_questions = parsedResponse.worksheet_questions.map(q => {
                        const isMultipleChoice = q.question_type?.toLowerCase().includes('multiple choice') || 
                                               q.question_type?.toLowerCase().includes('mcq');
                        
                        if (isMultipleChoice) {
                            if (!q.options || q.options.length < 2) {
                                q.question_type = "Short Answer";
                                q.options = null;
                            } else if (q.options.length < 4) {
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
                    
                    return Response.json(retryParsed);
                } catch (retryError) {
                    return Response.json({ 
                        error: 'Failed to process response' 
                    }, { status: 500 });
                }
            }
        }

        return Response.json({ text: generatedText });

    } catch (error) {
        return Response.json({ 
            error: 'Internal server error' 
        }, { status: 500 });
    }
});