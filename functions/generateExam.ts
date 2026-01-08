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

        const apiKey = Deno.env.get("OpenAI");
        if (!apiKey) {
            console.error('❌ CRITICAL: OpenAI API key not found in environment');
            return Response.json({ error: 'Service configuration error' }, { status: 500 });
        }
        console.log('✅ OpenAI API key found');

        // Build messages array
        const messages = [
            {
                role: "system",
                content: "You are an expert assessment designer. Always respond with valid JSON matching the provided schema."
            },
            {
                role: "user",
                content: prompt
            }
        ];

        const requestBody = {
            model: "gpt-5.1-chat-latest",
            messages: messages,
            temperature: 1,
            max_completion_tokens: 16000
        };

        // Add JSON schema if provided
        if (response_json_schema) {
            requestBody.response_format = {
                type: "json_schema",
                json_schema: {
                    name: "exam_response",
                    strict: true,
                    schema: response_json_schema
                }
            };
        }

        console.log('⏳ Calling OpenAI API for exam generation...');
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify(requestBody)
        });

        console.log('📥 OpenAI API response status:', response.status);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ OpenAI API error:', response.status, errorText);
            return Response.json({ 
                error: 'Failed to generate content',
                details: errorText 
            }, { status: 500 });
        }

        const data = await response.json();
        console.log('✅ OpenAI API response received');
        
        const generatedText = data.choices?.[0]?.message?.content;
        
        if (!generatedText) {
            console.error('❌ No content generated from OpenAI');
            console.error('📊 Full response:', JSON.stringify(data, null, 2));
            return Response.json({ 
                error: 'No content generated. Please try again.' 
            }, { status: 500 });
        }
        
        console.log('✅ Generated text extracted');
        console.log('📏 Response length:', generatedText.length, 'characters');

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