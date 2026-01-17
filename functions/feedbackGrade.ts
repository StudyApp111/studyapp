import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    console.log('=== feedbackGrade Function Start ===');
    try {
        const base44 = createClientFromRequest(req);
        console.log('✅ Base44 client created');
        
        const user = await base44.auth.me();
        console.log('✅ User authenticated:', user?.email);

        if (!user) {
            console.error('❌ Authentication failed - no user');
            return Response.json({ error: 'Unauthorized', code: 'AUTH_001' }, { status: 401 });
        }

        const { prompt, response_json_schema } = await req.json();
        console.log('✅ Request body parsed');
        console.log('📝 Prompt length:', prompt?.length);
        console.log('📋 Schema provided:', !!response_json_schema);

        if (!prompt) {
            console.error('❌ Missing prompt in request');
            return Response.json({ error: 'Prompt is required', code: 'PARAM_001' }, { status: 400 });
        }

        const apiKey = Deno.env.get("GEMINIAPIKEY");
        if (!apiKey) {
            console.error('❌ CRITICAL: API_KEY not found in environment');
            return Response.json({ error: 'Service configuration error', code: 'CONFIG_001' }, { status: 500 });
        }
        console.log('✅ API key found');

        const requestBody = {
            contents: [{
                parts: [{
                    text: prompt
                }]
            }],
            generationConfig: {
                temperature: 0.2,
                topP: 0.95,
                maxOutputTokens: 16384
            },
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

        console.log('⏳ Calling Gemini API for feedback grading...');
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

        console.log('📥 Gemini API response status:', response.status);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ Gemini API error:', response.status, errorText);
            return Response.json({ 
                error: 'Gemini API error',
                code: 'API_001',
                details: errorText.substring(0, 500)
            }, { status: 502 });
        }

        const data = await response.json();
        console.log('✅ Gemini API response received');
        const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text;
        
        if (!generatedText) {
            console.error('❌ No content generated:', JSON.stringify(data).substring(0, 500));
            return Response.json({ 
                error: 'No content generated',
                code: 'API_002',
                details: 'Empty response from Gemini'
            }, { status: 503 });
        }

        console.log('✅ Generated text extracted, length:', generatedText.length);

        if (response_json_schema) {
            try {
                // Validate JSON completeness before parsing
                if (!generatedText.trim().endsWith('}') && !generatedText.trim().endsWith(']')) {
                    console.error('❌ Incomplete JSON detected - missing closing bracket');
                    console.error('Last 200 chars:', generatedText.slice(-200));
                    return Response.json({ 
                        error: 'Incomplete JSON response from AI',
                        code: 'JSON_001',
                        details: 'Response was truncated or incomplete',
                        textPreview: generatedText.substring(0, 1000)
                    }, { status: 504 });
                }

                const parsedResponse = JSON.parse(generatedText);
                
                console.log('✅ JSON parsed successfully');
                console.log('📋 Response fields:', Object.keys(parsedResponse));
                console.log('=== feedbackGrade Function Complete ===');
                return Response.json(parsedResponse);
            } catch (parseError) {
                console.error('=== JSON PARSE ERROR ===');
                console.error('Error message:', parseError.message);
                console.error('Error position:', parseError.message.match(/position (\d+)/)?.[1]);
                console.error('Full text length:', generatedText.length);
                console.error('Full text:', generatedText);
                
                return Response.json({ 
                    error: 'Failed to parse JSON response',
                    code: 'JSON_003',
                    details: parseError.message,
                    textPreview: generatedText.substring(0, 1000),
                    textEnd: generatedText.slice(-200)
                }, { status: 506 });
            }
        }

        console.log('=== feedbackGrade Function Complete ===');
        return Response.json({ text: generatedText });

    } catch (error) {
        console.error('❌ CRITICAL ERROR in feedbackGrade:', error.message);
        console.error('Error stack:', error.stack);
        return Response.json({ 
            error: 'Internal server error',
            code: 'INTERNAL_001',
            details: error.message
        }, { status: 507 });
    }
});