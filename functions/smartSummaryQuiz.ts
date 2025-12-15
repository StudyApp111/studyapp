import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    console.log('=== smartSummaryQuiz Function Start ===');
    
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

        const requestBody = {
            contents: [{
                parts: [{
                    text: prompt
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

        console.log('⏳ Calling Gemini API for quiz generation...');
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

        console.log('📥 Gemini API response status:', response.status);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ Gemini API error:', response.status, errorText);
            return Response.json({ 
                error: 'Failed to generate content' 
            }, { status: 501 });
        }

        const data = await response.json();
        console.log('✅ Gemini API response received');
        
        const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text;
        
        if (!generatedText) {
            console.error('❌ No content generated');
            return Response.json({ 
                error: 'No content generated' 
            }, { status: 502 });
        }
        
        console.log('✅ Generated text extracted, length:', generatedText.length);

        if (response_json_schema) {
            try {
                const parsedResponse = JSON.parse(generatedText);
                console.log('✅ JSON parsed successfully');
                console.log('📊 Questions generated:', parsedResponse.questions?.length || 0);
                console.log('=== smartSummaryQuiz Function Complete ===');
                return Response.json(parsedResponse);
            } catch (parseError) {
                console.error('❌ JSON parse error:', parseError.message);
                console.error('Raw text preview:', generatedText.substring(0, 1000));
                return Response.json({ 
                    error: 'Failed to process response' 
                }, { status: 503 });
            }
        }

        console.log('=== smartSummaryQuiz Function Complete ===');
        return Response.json({ text: generatedText });

    } catch (error) {
        console.error('❌ CRITICAL ERROR in smartSummaryQuiz:', error);
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
        return Response.json({ 
            error: 'Internal server error' 
        }, { status: 504 });
    }
});