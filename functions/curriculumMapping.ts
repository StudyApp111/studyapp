import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { GoogleGenerativeAI } from 'npm:@google/generative-ai';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { courseName, learningProfile, extractedContent } = await req.json();

        if (!courseName) {
            return Response.json({ error: 'Course name is required' }, { status: 400 });
        }

        const apiKey = Deno.env.get("GEMINIAPIKEY");
        if (!apiKey) {
            return Response.json({ error: 'GEMINIAPIKEY not configured' }, { status: 500 });
        }

        // Build the prompt with user's context
        const prompt = `Role: Curriculum Analyst
Task: Generate a JSON curriculum profile for the course defined below.
Input Context:
- Grade Level: ${learningProfile?.grade || "Post-Secondary"}
- Course: ${courseName}
- School: ${learningProfile?.school || "Not specified"}
- Location: ${learningProfile?.city || "Not specified"}
- User Notes: ${extractedContent || "None provided"}

Directives:
1. Search Execution: Perform a targeted Google Search for the official course syllabus, outline, or calendar description for [${courseName}] at [${learningProfile?.school || "a typical university"}]. Look for:
   - Official Learning Outcomes / Core Competencies
   - Assessment methods (weighting, formats)
   - Required texts/readings (specifically authors and titles)
   - If the specific school syllabus is unavailable, search for standard curriculum requirements for this course code in [${learningProfile?.city || "North America"}] or [${learningProfile?.grade || "Post-Secondary"}] standards.

2. Data Synthesis: Map your findings to the JSON schema below.
   - If User Notes are present, prioritize them for "Areas of Emphasis".
   - If specific weightings are not found, estimate based on standard pedagogical practices for this discipline (e.g., STEM courses prioritize exams; Humanities prioritize essays).

3. Output Format: Return ONLY valid JSON.
{
  "core_competencies": [
    { "competency": "string (Title)", "description": "string (1-2 sentences)" }
  ],
  "competency_weightings": [
    { "topic": "string", "weight_percentage": "string (e.g. '20%')" }
  ],
  "assessment_formats": [
    {
      "type": "string (e.g. Essay, Multiple Choice)",
      "frequency": "string (e.g. Common, Rare)",
      "example_question": "string (Realistic example)",
      "related_resource": "string (Relevant theorist/textbook/concept)"
    }
  ],
  "high_yield_focal_points": [
    { "concept": "string", "description": "string", "key_figures_or_works": "string" }
  ],
  "common_misconceptions": [
    "string"
  ]
}

Generate 6-10 core_competencies, 5-8 competency_weightings that sum to ~100%, 3-4 assessment_formats, 3-5 high_yield_focal_points, and 3-4 common_misconceptions.`;

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

        const jsonSchemaString = JSON.stringify(response_json_schema, null, 2);
        const enhancedPrompt = `${prompt}

CRITICAL OUTPUT REQUIREMENTS:
You must respond with ONLY a valid JSON object matching this EXACT schema. No markdown, no explanations, no text before or after the JSON. Start with { and end with }.

Required JSON Schema:
${jsonSchemaString}

IMPORTANT FORMATTING RULES:
- weight_percentage must be strings like "20%" or "15%" (include % symbol)
- frequency must be strings like "30%" or "Common" or "Rare"
- All string fields must use double quotes
- Ensure all required fields are included
- Make sure arrays are properly formatted

Your response must be valid, parseable JSON that exactly matches the schema above.`;

        console.log('Calling Gemini Flash Lite for curriculum mapping...');

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ 
            model: 'gemini-flash-lite-latest',
            generationConfig: {
                temperature: 0.3,
                maxOutputTokens: 8192,
                responseMimeType: "application/json"
            }
        });

        const result = await model.generateContent({
            contents: [{ 
                role: 'user', 
                parts: [{ text: enhancedPrompt }] 
            }]
        });

        const response = result.response;
        const generatedText = response.text();

        if (!generatedText) {
            console.error('No content generated');
            return Response.json({ 
                error: 'No content generated from AI'
            }, { status: 500 });
        }

        console.log('Generated curriculum map - text length:', generatedText.length);

        // Parse JSON response with multiple cleanup attempts
        let parsedResponse;
        let cleanedText = generatedText.trim();
        
        // Remove markdown code blocks if present
        if (cleanedText.startsWith('```json')) {
            cleanedText = cleanedText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
        } else if (cleanedText.startsWith('```')) {
            cleanedText = cleanedText.replace(/^```\s*/, '').replace(/\s*```$/, '');
        }
        
        try {
            parsedResponse = JSON.parse(cleanedText);
            console.log('Successfully parsed curriculum map with Gemini');
            return Response.json(parsedResponse);
        } catch (parseError) {
            console.error('First parse attempt failed:', parseError.message);
            
            // Find JSON object in text
            const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                try {
                    parsedResponse = JSON.parse(jsonMatch[0]);
                    console.log('Successfully parsed curriculum map (extracted from text)');
                    return Response.json(parsedResponse);
                } catch (extractError) {
                    console.error('Extract parse failed:', extractError.message);
                }
            }
            
            console.error('All parse attempts failed. Raw text preview:', cleanedText.substring(0, 500));
            return Response.json({ 
                error: 'Failed to parse AI response as JSON', 
                details: parseError.message,
                raw_text_preview: cleanedText.substring(0, 500)
            }, { status: 500 });
        }

    } catch (error) {
        console.error('Error in curriculumMapping function:', error);
        return Response.json({ 
            error: error.message,
            stack: error.stack
        }, { status: 500 });
    }
});