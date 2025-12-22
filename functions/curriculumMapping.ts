import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    console.log('=== curriculumMapping Function Start ===');
    
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

        // Google Search grounding cannot be combined with JSON response mode
        // So we request grounded content and ask for JSON in the prompt
        const requestBody = {
            contents: [{
                parts: [{
                    text: prompt + "\n\nIMPORTANT: Return ONLY a valid JSON object with no markdown formatting, no code blocks, no extra text."
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
            ],
            tools: [{
                googleSearch: {}
            }]
        };

        console.log('⏳ Calling Gemini API with Google Search grounding...');
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`,
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
            
            // Log error and send email
            try {
                await base44.asServiceRole.entities.ErrorLog.create({
                    error_type: 'api_error',
                    error_message: `Gemini API error: ${response.status}`,
                    error_stack: errorText,
                    context: {
                        function: 'curriculumMapping',
                        api_status: response.status,
                        user_email: user.email,
                        error_code: 'CURR_MAP_001'
                    },
                    user_email: user.email,
                    resolved: false
                });
                
                await base44.asServiceRole.integrations.Core.SendEmail({
                    to: 'support@study-app.ai',
                    subject: `[CURR_MAP_001] Gemini API Error - ${response.status}`,
                    body: `User: ${user.email}\nStatus: ${response.status}\nError: ${errorText}`
                });
            } catch (logError) {
                console.error('Failed to log error:', logError);
            }
            
            return Response.json({ 
                error: 'Failed to generate content',
                code: 'CURR_MAP_001',
                details: errorText
            }, { status: 500 });
        }

        const data = await response.json();
        console.log('✅ Gemini API response received');
        
        // Find text content from grounded response (may be in different parts)
        let generatedText = null;
        const parts = data.candidates?.[0]?.content?.parts || [];
        for (const part of parts) {
            if (part.text) {
                generatedText = part.text;
                break;
            }
        }
        
        if (!generatedText) {
            console.error('❌ No content in response:', JSON.stringify(data));
            
            // Log error and send email
            try {
                await base44.asServiceRole.entities.ErrorLog.create({
                    error_type: 'function_error',
                    error_message: 'No content generated from Gemini API',
                    error_stack: JSON.stringify(data),
                    context: {
                        function: 'curriculumMapping',
                        user_email: user.email,
                        error_code: 'CURR_MAP_002'
                    },
                    user_email: user.email,
                    resolved: false
                });
                
                await base44.asServiceRole.integrations.Core.SendEmail({
                    to: 'support@study-app.ai',
                    subject: `[CURR_MAP_002] No Content Generated`,
                    body: `User: ${user.email}\nResponse: ${JSON.stringify(data)}`
                });
            } catch (logError) {
                console.error('Failed to log error:', logError);
            }
            
            return Response.json({ 
                error: 'No content generated',
                code: 'CURR_MAP_002'
            }, { status: 500 });
        }
        
        console.log('✅ Generated text extracted, length:', generatedText.length);

        // Extract JSON - try multiple strategies
        let jsonStr = generatedText.trim();
        
        // Strategy 1: Check for markdown code blocks
        const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (jsonMatch) {
            jsonStr = jsonMatch[1].trim();
        }
        
        // Strategy 2: Find JSON object boundaries
        if (!jsonStr.startsWith('{')) {
            const jsonStartIdx = jsonStr.indexOf('{');
            const jsonEndIdx = jsonStr.lastIndexOf('}');
            if (jsonStartIdx !== -1 && jsonEndIdx !== -1 && jsonEndIdx > jsonStartIdx) {
                jsonStr = jsonStr.substring(jsonStartIdx, jsonEndIdx + 1);
            }
        }

        try {
            const parsedResponse = JSON.parse(jsonStr);
            console.log('✅ JSON parsed successfully');
            console.log('📊 Response keys:', Object.keys(parsedResponse).join(', '));
            console.log('=== curriculumMapping Function Complete ===');
            return Response.json(parsedResponse);
        } catch (parseError) {
            console.error('❌ Initial JSON parse failed, attempting repair...');
            
            // Strategy 3: Make a second API call to fix/extract JSON
            console.log('⏳ Making repair call to extract JSON...');
            const repairRequestBody = {
                contents: [{
                    parts: [{
                        text: `Extract and return ONLY a valid JSON object from the following text. The JSON should have these keys: core_competencies, competency_weightings, question_formats, high_yield_focal_points, common_misconceptions.

If you cannot find all the data, create reasonable defaults based on the context.

TEXT TO EXTRACT FROM:
${generatedText}

Return ONLY the JSON object, no explanations.`
                    }]
                }],
                generationConfig: {
                    temperature: 0.1,
                    topP: 0.95,
                    maxOutputTokens: 8192,
                    responseMimeType: "application/json",
                    responseSchema: response_json_schema
                }
            };
            
            const repairResponse = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(repairRequestBody)
                }
            );
            
            if (repairResponse.ok) {
                const repairData = await repairResponse.json();
                const repairText = repairData.candidates?.[0]?.content?.parts?.[0]?.text;
                
                if (repairText) {
                    let repairJson = repairText.trim();
                    if (!repairJson.startsWith('{')) {
                        const start = repairJson.indexOf('{');
                        const end = repairJson.lastIndexOf('}');
                        if (start !== -1 && end !== -1) {
                            repairJson = repairJson.substring(start, end + 1);
                        }
                    }
                    
                    try {
                        const repairedResponse = JSON.parse(repairJson);
                        console.log('✅ JSON repaired and parsed successfully');
                        return Response.json(repairedResponse);
                    } catch (repairParseError) {
                        console.error('❌ Repair parse also failed');
                    }
                }
            }
            
            console.error('❌ JSON parse error:', parseError.message);
            console.error('Raw text preview:', generatedText.substring(0, 1000));
            
            // Log error and send email
            try {
                await base44.asServiceRole.entities.ErrorLog.create({
                    error_type: 'function_error',
                    error_message: `JSON parse error: ${parseError.message}`,
                    error_stack: parseError.stack,
                    context: {
                        function: 'curriculumMapping',
                        user_email: user.email,
                        raw_preview: generatedText.substring(0, 500),
                        error_code: 'CURR_MAP_003'
                    },
                    user_email: user.email,
                    resolved: false
                });
                
                await base44.asServiceRole.integrations.Core.SendEmail({
                    to: 'support@study-app.ai',
                    subject: `[CURR_MAP_003] JSON Parse Error`,
                    body: `User: ${user.email}\nError: ${parseError.message}\nRaw: ${generatedText.substring(0, 500)}`
                });
            } catch (logError) {
                console.error('Failed to log error:', logError);
            }
            
            return Response.json({ 
                error: 'Failed to parse response as JSON',
                code: 'CURR_MAP_003',
                raw: generatedText.substring(0, 500)
            }, { status: 500 });
        }

    } catch (error) {
        console.error('❌ CRITICAL ERROR in curriculumMapping:', error);
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
        
        // Log critical error and send email
        try {
            const base44 = createClientFromRequest(req);
            const user = await base44.auth.me().catch(() => null);
            
            await base44.asServiceRole.entities.ErrorLog.create({
                error_type: 'function_error',
                error_message: error.message || 'Unknown error',
                error_stack: error.stack,
                context: {
                    function: 'curriculumMapping',
                    user_email: user?.email,
                    error_code: 'CURR_MAP_000'
                },
                user_email: user?.email,
                resolved: false
            });
            
            await base44.asServiceRole.integrations.Core.SendEmail({
                to: 'support@study-app.ai',
                subject: `[CURR_MAP_000] Critical Error in curriculumMapping`,
                body: `User: ${user?.email || 'Unknown'}\nError: ${error.message}\nStack: ${error.stack}`
            });
        } catch (logError) {
            console.error('Failed to log critical error:', logError);
        }
        
        return Response.json({ 
            error: 'Internal server error',
            code: 'CURR_MAP_000'
        }, { status: 500 });
    }
});