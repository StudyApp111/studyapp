import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    console.log('=== generateWorksheet Function Start ===');
    
    try {
        const base44 = createClientFromRequest(req);
        console.log('✅ Base44 client created');
        
        const user = await base44.auth.me();
        console.log('✅ User authenticated:', user?.email);

        if (!user) {
            console.error('❌ Authentication failed - no user');
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { examNumber, lessonData, learningProfile, contentDescription, curriculumMap, response_json_schema } = await req.json();
        console.log('✅ Request body parsed');
        console.log('📝 Exam number:', examNumber);
        console.log('📝 Content length:', contentDescription?.length);
        console.log('📋 Schema provided:', !!response_json_schema);

        if (!lessonData || !contentDescription) {
            console.error('❌ Missing required data');
            return Response.json({ error: 'Lesson data and content are required' }, { status: 400 });
        }

        const apiKey = Deno.env.get("API_KEY");
        if (!apiKey) {
            console.error('❌ CRITICAL: API_KEY not found in environment');
            return Response.json({ error: 'Service configuration error' }, { status: 500 });
        }
        console.log('✅ API key found');

        // Use prompt as-is, schema already defines output structure
        const enhancedPrompt = prompt;

        const requestBody = {
            contents: [{
                parts: [{
                    text: enhancedPrompt
                }]
            }],
            generationConfig: {
                temperature: 0.2,
                topP: 0.95,
                maxOutputTokens: 65536
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

        console.log('⏳ Calling Gemini API for worksheet generation...');
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody)
            }
        );

        console.log('📥 Gemini API response status:', response.status);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ Gemini API error:', response.status, errorText);
            return Response.json({ 
                error: 'Failed to generate content' 
            }, { status: 500 });
        }

        const data = await response.json();
        console.log('✅ Gemini API response received');
        
        // Check for truncation
        const finishReason = data.candidates?.[0]?.finishReason;
        console.log('📋 Finish reason:', finishReason);
        
        if (finishReason === 'MAX_TOKENS') {
            console.error('❌ Output truncated due to MAX_TOKENS limit');
            return Response.json({ 
                error: 'Response was truncated - output exceeded token limit. Please try again.' 
            }, { status: 500 });
        }
        
        const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text;
        
        if (!generatedText) {
            console.error('❌ No content generated');
            return Response.json({ 
                error: 'No content generated' 
            }, { status: 500 });
        }
        
        console.log('✅ Generated text extracted, length:', generatedText.length);

        if (response_json_schema) {
            try {
                let cleanedText = generatedText.trim();
                if (cleanedText.startsWith('```json')) {
                    cleanedText = cleanedText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
                } else if (cleanedText.startsWith('```')) {
                    cleanedText = cleanedText.replace(/^```\s*/, '').replace(/\s*```$/, '');
                }
                
                const parsedResponse = JSON.parse(cleanedText);
                console.log('✅ JSON parsed successfully');
                console.log('📊 Worksheet questions:', parsedResponse.worksheet_questions?.length || 0);
                
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
                    console.error('❌ Retry parse also failed:', retryError.message);
                    console.error('❌ Raw text snippet:', generatedText.substring(0, 500));
                    
                    // Try to extract partial valid JSON for worksheet_questions
                    try {
                        const questionsMatch = generatedText.match(/"worksheet_questions"\s*:\s*\[[\s\S]*?\}\s*\]/);
                        if (questionsMatch) {
                            const partialJson = `{${questionsMatch[0]}}`;
                            const partialParsed = JSON.parse(partialJson);
                            console.log('✅ Recovered partial JSON with', partialParsed.worksheet_questions?.length, 'questions');
                            return Response.json(partialParsed);
                        }
                    } catch (partialError) {
                        console.error('❌ Partial recovery also failed');
                    }
                    
                    return Response.json({ 
                        error: 'Failed to process response - output may have been truncated' 
                    }, { status: 500 });
                }
            }
        }

        console.log('=== generateWorksheet Function Complete ===');
        return Response.json({ text: generatedText });

    } catch (error) {
        console.error('❌ CRITICAL ERROR in generateWorksheet:', error);
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
        return Response.json({ 
            error: 'Internal server error' 
        }, { status: 500 });
    }
});