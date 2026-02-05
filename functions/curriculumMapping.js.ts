import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { GoogleGenerativeAI } from 'npm:@google/generative-ai';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        // Try to get user but don't require authentication (onboarding flow)
        let user = null;
        try {
            user = await base44.auth.me();
            console.log('User authenticated:', user?.email);
        } catch (authError) {
            console.log('No user authentication - proceeding for onboarding flow');
        }

        const { courseName, learningProfile, extractedContent, lessonId } = await req.json();

        if (!courseName) {
            return Response.json({ error: 'Course name is required' }, { status: 400 });
        }

        console.log('Request params:', { courseName, lessonId, hasLearningProfile: !!learningProfile, hasExtractedContent: !!extractedContent });

        const apiKey = Deno.env.get("GEMINIAPIKEY");
        if (!apiKey) {
            return Response.json({ error: 'GEMINIAPIKEY not configured' }, { status: 500 });
        }

        const genAI = new GoogleGenerativeAI(apiKey);

        // --- STEP 1: Research with Google Search ---
        console.log('--- Step 1: Researching curriculum with Google Search ---');
        
        const researchModel = genAI.getGenerativeModel({ 
            model: 'gemini-flash-latest', // Using 1.5-flash as "gemini-flash-latest" alias might vary, but user asked for flash-latest. Let's try to stick to what works or standard. User said "gemini-flash-latest".
            // Actually, for tools support in the SDK, we often use specific models. 
            // User explicitly asked for "gemini-flash-latest".
            tools: [{ googleSearch: {} }]
        });
        
        // Note: The library might require "gemini-1.5-flash" or similar. 
        // I will use "gemini-1.5-flash" which is the current "flash-latest" equivalent usually.
        // User asked for "gemini-flash-latest", I will try to use that string if possible, 
        // but typically "gemini-1.5-flash" is the safe ID. 
        // I'll stick to "gemini-1.5-flash" to be safe with tools, or check if "gemini-flash-latest" is valid.
        // Actually, let's use the user's specific request: "gemini-flash-latest".
        
        const researchPrompt = `Role: Curriculum Analyst
Task: Research and compile a comprehensive curriculum profile for the course defined below.
Input Context:
- Course: ${courseName}
- School: ${learningProfile?.school || "Not specified"}
- User Notes: ${extractedContent || "None provided"}

Directives:
1. Search Execution: Perform a targeted Google Search for the official course syllabus, outline, or calendar description for [${courseName}] at [${learningProfile?.school || "a typical university"}]. Look for:
   - Official Learning Outcomes / Core Competencies
   - Assessment methods (weighting, formats)
   - Required texts/readings (specifically authors and titles)
   - If the specific school syllabus is unavailable, search for standard curriculum requirements for this course code in [${learningProfile?.city || "North America"}] or [${learningProfile?.grade || "Post-Secondary"}] standards.

2. Data Synthesis: Compile your findings into a detailed report.
   - If User Notes are present, prioritize them for "Areas of Emphasis".
   - If specific weightings are not found, estimate based on similar courses at local universities around ${learningProfile?.school || "Not specified"}.
   

Output detailed notes on:
- Core Competencies (what students learn)
- Assessment Structure (how they are graded)
- Key Topics/Focal Points
- Common Misconceptions`;

        const researchResult = await researchModel.generateContent({
            contents: [{ role: 'user', parts: [{ text: researchPrompt }] }],
            generationConfig: {
                temperature: 0.5
            }
        });
        
        const researchText = researchResult.response.text();
        console.log('Research completed. Length:', researchText.length);
        // console.log('Research preview:', researchText.substring(0, 200));


        // --- STEP 2: Reformat to JSON ---
        console.log('--- Step 2: Formatting to JSON with Schema ---');

        const formattingModel = genAI.getGenerativeModel({ 
            model: 'gemini-flash-lite-latest', // "h is the actual model name for Flash Lite.
        });

        // JSON schema for structured output
        const response_json_schema = {
            type: "object",
            properties: {
                core_competencies: {
                    type: "array",
                    items: {
                        type: "object",
                        properties: {
                            competency: { type: "string" },
                            description: { type: "string" }
                        },
                        required: ["competency", "description"]
                    }
                },
                competency_weightings: {
                    type: "array",
                    items: {
                        type: "object",
                        properties: {
                            topic: { type: "string" },
                            weight_percentage: { type: "string" }
                        },
                        required: ["topic", "weight_percentage"]
                    }
                },
                assessment_formats: {
                    type: "array",
                    items: {
                        type: "object",
                        properties: {
                            type: { type: "string" },
                            frequency: { type: "string" },
                            example_question: { type: "string" },
                            related_resource: { type: "string" }
                        },
                        required: ["type", "frequency", "example_question", "related_resource"]
                    }
                },
                high_yield_focal_points: {
                    type: "array",
                    items: {
                        type: "object",
                        properties: {
                            concept: { type: "string" },
                            description: { type: "string" },
                            key_figures_or_works: { type: "string" }
                        },
                        required: ["concept", "description", "key_figures_or_works"]
                    }
                },
                common_misconceptions: {
                    type: "array",
                    items: { type: "string" }
                }
            },
            required: ["core_competencies", "competency_weightings", "assessment_formats", "high_yield_focal_points", "common_misconceptions"]
        };

        const formatPrompt = `Role: Data Formatter
Task: Convert the provided Curriculum Research data into a specific JSON format.
Input Data:
${researchText}

Directives:
- Extract all relevant details from the input data.
- Format strictly according to the provided JSON schema.
- Ensure "weight_percentage" are strings like "20%".
- Ensure "frequency" are strings like "Common" or "Rare".

Output:
JSON ONLY.`;

        const formatResult = await formattingModel.generateContent({
            contents: [{ role: 'user', parts: [{ text: formatPrompt }] }],
            generationConfig: {
                temperature: 0.2, // Lower temp for formatting
                responseMimeType: "application/json",
                responseSchema: response_json_schema
            }
        });

        const formatResponse = formatResult.response;
        const generatedJsonText = formatResponse.text();
        
        console.log('Formatting completed. Length:', generatedJsonText.length);

        let parsedResponse;
        try {
            parsedResponse = JSON.parse(generatedJsonText);
        } catch (e) {
            console.error("JSON Parse Error:", e);
            // Fallback cleanup if somehow it's not pure JSON despite mimeType
             let cleanedText = generatedJsonText.trim();
            if (cleanedText.startsWith('```json')) {
                cleanedText = cleanedText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
            } else if (cleanedText.startsWith('```')) {
                cleanedText = cleanedText.replace(/^```\s*/, '').replace(/\s*```$/, '');
            }
            parsedResponse = JSON.parse(cleanedText);
        }

        // If lessonId provided and user authenticated, save to lesson
        if (lessonId && user) {
            console.log('Saving curriculum map to lesson:', lessonId);
            try {
                await base44.entities.Lesson.update(lessonId, {
                    curriculum_map: parsedResponse
                });
                console.log('✅ Curriculum map saved to Lesson entity');
            } catch (saveError) {
                console.error('Failed to save curriculum map to lesson:', saveError.message);
            }
        }

        return Response.json(parsedResponse);

    } catch (error) {
        console.error('Error in curriculumMapping function:', error);
        return Response.json({ 
            error: error.message,
            stack: error.stack
        }, { status: 500 });
    }
});