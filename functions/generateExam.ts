import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    console.log('=== generateExam Function Start ===');
    
    try {
        const base44 = createClientFromRequest(req);
        console.log('✅ Base44 client created');
        
        const user = await base44.auth.me();
        console.log('✅ User authenticated:', user?.email);

        if (!user) {
            console.error('❌ Authentication failed - no user');
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { prompt, response_json_schema } = await req.json();
        console.log('✅ Request body parsed');
        console.log('📝 Prompt length:', prompt?.length);
        console.log('📋 Schema provided:', !!response_json_schema);

        if (!prompt) {
            console.error('❌ Missing prompt in request');
            return Response.json({ error: 'Prompt is required' }, { status: 400 });
        }

        const apiKey = Deno.env.get("API_KEY");
        if (!apiKey) {
            console.error('❌ CRITICAL: API_KEY not found in environment');
            return Response.json({ error: 'Service configuration error' }, { status: 500 });
        }
        console.log('✅ API key found');

        const enhancedPrompt = prompt;

        const requestBody = {
            contents: [{
                parts: [{
                    text: enhancedPrompt
                }]
            }],
            systemInstruction: {
                parts: [{
                    text: "You are an expert assessment designer. Use minimal internal reasoning to provide fast, accurate responses."
                }]
            },
            generationConfig: {
                temperature: 0.2,
                topP: 0.95,
                maxOutputTokens: 60000
            },
            tools: [{
                googleSearchRetrieval: {}
            }],
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

        console.log('⏳ Calling Gemini API for exam generation...');
        console.log('📋 Request body:', JSON.stringify(requestBody, null, 2));
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
            console.error('❌ Full error response:', errorText);
            return Response.json({ 
                error: 'Failed to generate content',
                details: errorText 
            }, { status: 500 });
        }

        const data = await response.json();
        console.log('✅ Gemini API response received');
        
        // Check for safety blocks first
        const candidate = data.candidates?.[0];
        if (candidate?.finishReason === 'SAFETY') {
            console.error('❌ Content blocked by safety filter');
            console.error('📊 Safety message:', candidate.finishMessage);
            return Response.json({ 
                error: 'Content generation blocked by safety filters. Please try rephrasing your content or contact support.' 
            }, { status: 500 });
        }
        
        const generatedText = candidate?.content?.parts?.[0]?.text;
        
        if (!generatedText) {
            console.error('❌ No content generated from Gemini');
            console.error('📊 Finish reason:', candidate?.finishReason);
            console.error('📊 Full response:', JSON.stringify(data, null, 2));
            return Response.json({ 
                error: 'No content generated. Please try again.' 
            }, { status: 500 });
        }
        
        console.log('✅ Generated text extracted');
        console.log('📏 Response length:', generatedText.length, 'characters');
        
        if (generatedText.length > 50000) {
            console.error('⚠️ WARNING: Response is extremely large - likely not following JSON schema');
        }

        try {
            const parsedResponse = JSON.parse(generatedText);
            console.log('✅ JSON parsed successfully');
            console.log('📊 Questions generated:', parsedResponse.exam_questions?.length || 0);
            
            // Validate question formats
            if (parsedResponse.exam_questions) {
                parsedResponse.exam_questions = parsedResponse.exam_questions.map((q, idx) => {
                    const type = q.question_type?.toLowerCase() || '';
                    
                    if (type.includes('multiple choice') || type.includes('mcq')) {
                        if (!q.options || q.options.length !== 4) {
                            console.warn(`⚠️ Q${idx + 1}: MCQ should have exactly 4 options, got ${q.options?.length || 0}`);
                        }
                    } else if (type.includes('true') && type.includes('false')) {
                        if (!q.options || q.options.length !== 2 || !q.options.includes('True') || !q.options.includes('False')) {
                            console.warn(`⚠️ Q${idx + 1}: T/F should have ["True", "False"], got`, q.options);
                        }
                    } else if (type.includes('fill') || type.includes('blank')) {
                        if (q.options && q.options.length > 0) {
                            console.warn(`⚠️ Q${idx + 1}: Fill in the Blank should have empty options, got ${q.options.length}`);
                            q.options = [];
                        }
                    } else if (type.includes('short answer')) {
                        if (q.options && q.options.length > 0) {
                            console.warn(`⚠️ Q${idx + 1}: Short Answer should have empty options, got ${q.options.length}`);
                            q.options = [];
                        }
                    }
                    
                    return q;
                });
            }
            
            return Response.json(parsedResponse);
        } catch (parseError) {
            console.error('❌ JSON parse failed:', parseError.message);
            console.error('📄 Raw response (first 1000 chars):', generatedText.substring(0, 1000));
            console.error('📄 Raw response (last 500 chars):', generatedText.substring(Math.max(0, generatedText.length - 500)));
            
            return Response.json({ 
                error: 'Failed to parse AI response as JSON',
                details: parseError.message
            }, { status: 500 });
        }

    } catch (error) {
        console.error('❌ CRITICAL ERROR in generateExam:', error);
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
        return Response.json({ 
            error: 'Internal server error' 
        }, { status: 500 });
    }
});