import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    console.log('=== gradeAssignment Function Start ===');
    
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
            return Response.json({ error: 'prompt is required' }, { status: 400 });
        }

        const apiKey = Deno.env.get("GEMINIAPIKEY");
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
                temperature: 0,
                topP: 0.95,
                topK: 40,
                maxOutputTokens: 16384
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

        const apiUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' + apiKey;

        console.log('⏳ Calling Gemini API for assignment grading...');
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });

        console.log('📥 Gemini API response status:', response.status);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ Gemini API error:', response.status, errorText);
            return Response.json({
                error: 'Failed to grade assignment'
            }, { status: 500 });
        }

        const data = await response.json();
        console.log('✅ Gemini API response received');

        if (!data.candidates || data.candidates.length === 0) {
            console.error('❌ No candidates in response');
            return Response.json({
                error: 'No grading result generated'
            }, { status: 500 });
        }

        const generatedText = data.candidates[0].content.parts[0].text;
        console.log('✅ Generated text extracted, length:', generatedText.length);

        if (response_json_schema) {
            try {
                const parsed = JSON.parse(generatedText);
                console.log('✅ JSON parsed successfully');
                console.log('📊 Grade:', parsed.predicted_grade || 'N/A');
                console.log('=== gradeAssignment Function Complete ===');
                return Response.json(parsed);
            } catch (parseError) {
                console.error('❌ JSON parse error:', parseError.message);
                console.error('Raw text preview:', generatedText.substring(0, 1000));
                return Response.json({
                    error: 'Failed to process grading result'
                }, { status: 500 });
            }
        }

        console.log('=== gradeAssignment Function Complete ===');
        return Response.json({ data: generatedText });

    } catch (error) {
        console.error('❌ CRITICAL ERROR in gradeAssignment:', error);
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
        return Response.json({
            error: 'Internal server error'
        }, { status: 500 });
    }
});