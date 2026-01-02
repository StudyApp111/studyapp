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

        // If grounded search returned empty, fall back to direct structured call
        if (!generatedText || generatedText.trim() === '') {
            console.log('⚠️ Grounded response empty, falling back to direct structured call...');

            const directRequestBody = {
                contents: [{
                    parts: [{
                        text: prompt
                    }]
                }],
                generationConfig: {
                    temperature: 0.2,
                    topP: 0.95,
                    maxOutputTokens: 8192,
                    responseMimeType: "application/json",
                    responseSchema: response_json_schema
                }
            };

            const directResponse = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(directRequestBody)
                }
            );

            if (directResponse.ok) {
                const directData = await directResponse.json();
                const directText = directData.candidates?.[0]?.content?.parts?.[0]?.text;

                if (directText) {
                    let directJson = directText.trim();
                    if (!directJson.startsWith('{')) {
                        const start = directJson.indexOf('{');
                        const end = directJson.lastIndexOf('}');
                        if (start !== -1 && end !== -1) {
                            directJson = directJson.substring(start, end + 1);
                        }
                    }

                    try {
                        const parsedDirect = JSON.parse(directJson);
                        if (parsedDirect.core_competencies) {
                            console.log('✅ Direct structured call succeeded');
                            return Response.json(parsedDirect);
                        }
                    } catch (parseErr) {
                        console.error('❌ Direct call parse failed:', parseErr.message);
                    }
                }
            }

            // If direct call also failed, return error
            console.error('❌ No content in response:', JSON.stringify(data));

            try {
                await base44.asServiceRole.entities.ErrorLog.create({
                    error_type: 'function_error',
                    error_message: 'No content generated from Gemini API (grounded + direct fallback failed)',
                    error_stack: JSON.stringify(data),
                    context: {
                        function: 'curriculumMapping',
                        user_email: user.email,
                        error_code: 'CURR_MAP_002'
                    },
                    user_email: user.email,
                    resolved: false
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
        let parsedResponse = null;
        
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

        // Try to parse the extracted JSON
        try {
            parsedResponse = JSON.parse(jsonStr);
            console.log('✅ JSON parsed successfully from grounded response');
        } catch (parseError) {
            console.log('⚠️ Grounded response was not JSON, making structured follow-up call...');
        }
        
        // If parsing failed or no JSON found, make a second structured call
        if (!parsedResponse) {
            console.log('⏳ Making structured JSON call with grounded context...');
            const structuredRequestBody = {
                contents: [{
                    parts: [{
                        text: `Based on the following research context, generate a curriculum profile JSON.

RESEARCH CONTEXT:
${generatedText}

ORIGINAL REQUEST:
${prompt}

Generate the curriculum profile with these exact keys: core_competencies, competency_weightings, question_formats, high_yield_focal_points, common_misconceptions.`
                    }]
                }],
                generationConfig: {
                    temperature: 0.2,
                    topP: 0.95,
                    maxOutputTokens: 8192,
                    responseMimeType: "application/json",
                    responseSchema: response_json_schema
                }
            };
            
            const structuredResponse = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(structuredRequestBody)
                }
            );
            
            if (structuredResponse.ok) {
                const structuredData = await structuredResponse.json();
                const structuredText = structuredData.candidates?.[0]?.content?.parts?.[0]?.text;
                
                if (structuredText) {
                    let structuredJson = structuredText.trim();
                    if (!structuredJson.startsWith('{')) {
                        const start = structuredJson.indexOf('{');
                        const end = structuredJson.lastIndexOf('}');
                        if (start !== -1 && end !== -1) {
                            structuredJson = structuredJson.substring(start, end + 1);
                        }
                    }
                    
                    try {
                        parsedResponse = JSON.parse(structuredJson);
                        console.log('✅ JSON parsed from structured follow-up call');
                    } catch (structuredParseError) {
                        console.error('❌ Structured call parse also failed:', structuredParseError.message);
                    }
                }
            } else {
                console.error('❌ Structured call failed:', structuredResponse.status);
            }
        }
        
        // Handle wrapped responses - unwrap before returning
        if (parsedResponse) {
            // Deep search for the actual curriculum data - may be nested multiple levels
            const findCurriculumData = (obj, depth = 0) => {
                if (!obj || typeof obj !== 'object' || depth > 3) return null;
                
                // Check if this object has core_competencies directly
                if (obj.core_competencies && Array.isArray(obj.core_competencies)) {
                    return obj;
                }
                
                // Check common wrapper keys
                const wrapperKeys = ['curriculum_profile', 'course_profile', 'profile', 'data', 'result', 
                                     'curriculum_data', 'response', 'output', 'content'];
                for (const key of wrapperKeys) {
                    if (obj[key] && typeof obj[key] === 'object') {
                        const found = findCurriculumData(obj[key], depth + 1);
                        if (found) return found;
                    }
                }
                
                // Check any key that might contain curriculum data
                for (const key of Object.keys(obj)) {
                    const lowerKey = key.toLowerCase();
                    if (lowerKey.includes('curriculum') || lowerKey.includes('profile') || lowerKey.includes('competenc')) {
                        if (typeof obj[key] === 'object') {
                            const found = findCurriculumData(obj[key], depth + 1);
                            if (found) return found;
                        }
                    }
                }
                
                return null;
            };
            
            const unwrapped = findCurriculumData(parsedResponse);
            if (unwrapped && unwrapped !== parsedResponse) {
                console.log('✅ Unwrapped nested curriculum data');
                parsedResponse = unwrapped;
            }
            
            // Normalize keys if they have prefixes like "A. Core Competencies..."
            if (!parsedResponse.core_competencies) {
                const keyMapping = {
                    'core_competencies': ['core_competencies', 'core competencies', 'learning outcomes', 'corecompetencies'],
                    'competency_weightings': ['competency_weightings', 'competency weightings', 'emphasis', 'weightings'],
                    'question_formats': ['question_formats', 'question formats', 'assessment', 'questionformats'],
                    'high_yield_focal_points': ['high_yield_focal_points', 'high-yield', 'focal points', 'key topics', 'highyieldfocalpoints'],
                    'common_misconceptions': ['common_misconceptions', 'misconceptions', 'difficulties', 'commonmisconceptions']
                };
                
                const normalized = {};
                for (const [targetKey, searchTerms] of Object.entries(keyMapping)) {
                    for (const originalKey of Object.keys(parsedResponse)) {
                        const lowerKey = originalKey.toLowerCase().replace(/[^a-z]/g, '');
                        if (searchTerms.some(term => lowerKey.includes(term.replace(/[^a-z]/g, '')))) {
                            normalized[targetKey] = parsedResponse[originalKey];
                            console.log(`✅ Mapped "${originalKey}" -> "${targetKey}"`);
                            break;
                        }
                    }
                }
                
                if (normalized.core_competencies) {
                    console.log('✅ Normalized response keys');
                    parsedResponse = { ...parsedResponse, ...normalized };
                }
            }
        }

        // If we have a valid response, return it
        if (parsedResponse && parsedResponse.core_competencies) {
            console.log('📊 Response keys:', Object.keys(parsedResponse).join(', '));
            console.log('=== curriculumMapping Function Complete ===');
            return Response.json(parsedResponse);
        }
        
        // All strategies failed - log and return error
        console.error('❌ All JSON extraction strategies failed');
        console.error('Raw text preview:', generatedText.substring(0, 1000));
        
        try {
            await base44.asServiceRole.entities.ErrorLog.create({
                error_type: 'function_error',
                error_message: 'Failed to extract JSON from response',
                error_stack: null,
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
                body: `User: ${user.email}\nRaw: ${generatedText.substring(0, 500)}`
            });
        } catch (logError) {
            console.error('Failed to log error:', logError);
        }
        
        return Response.json({ 
            error: 'Failed to parse response as JSON',
            code: 'CURR_MAP_003',
            raw: generatedText.substring(0, 500)
        }, { status: 500 });

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