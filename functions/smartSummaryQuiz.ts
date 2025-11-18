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

        const enhancedPrompt = prompt + `\n\nCRITICAL FORMATTING INSTRUCTIONS:
- For multiple choice options: provide ONLY the answer text without any letter labels (A, B, C, D), numbers, or punctuation prefixes
- Example: options should be ["Carbon and Oxygen", "Sodium and Chlorine"] NOT ["A. Carbon and Oxygen", "B) Sodium and Chlorine"]
- The correct_answer must exactly match one of the options`;

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
                const parsedResponse = JSON.parse(generatedText);
                
                // Clean diagnostic quiz options if present
                if (parsedResponse.diagnostic_quiz?.questions) {
                    parsedResponse.diagnostic_quiz.questions = parsedResponse.diagnostic_quiz.questions.map(q => {
                        if (q.options && Array.isArray(q.options)) {
                            q.options = q.options.map(opt => 
                                String(opt)
                                    .replace(/^[A-Za-z][\s,.\-)]+/g, '')
                                    .replace(/^[,.\s)]+/g, '')
                                    .trim()
                            );
                            
                            if (q.correct_answer) {
                                q.correct_answer = String(q.correct_answer)
                                    .replace(/^[A-Za-z][\s,.\-)]+/g, '')
                                    .replace(/^[,.\s)]+/g, '')
                                    .trim();
                            }
                        }
                        return q;
                    });
                }
                
                return Response.json(parsedResponse);
            } catch (parseError) {
                return Response.json({ 
                    error: 'Failed to process response' 
                }, { status: 500 });
            }
        }

        return Response.json({ text: generatedText });

    } catch (error) {
        return Response.json({ 
            error: 'Internal server error' 
        }, { status: 500 });
    }
});