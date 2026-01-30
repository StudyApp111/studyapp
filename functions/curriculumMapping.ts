import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

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

        const grokApiKey = Deno.env.get("GROK_API_KEY");
        if (!grokApiKey) {
            return Response.json({ error: 'GROK_API_KEY not configured' }, { status: 500 });
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

        // Enhanced prompt with explicit JSON schema instructions
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

        // Prepare the request body for Grok-3
        const requestBody = {
            messages: [{
                role: "user",
                content: enhancedPrompt
            }],
            model: "grok-3",
            temperature: 0.3,
            max_tokens: 8192,
            response_format: {
                type: "json_object"
            }
        };

        console.log('Calling Grok-3 API for curriculum mapping...');

        // Call Grok-3 API
        const response = await fetch(
            'https://api.x.ai/v1/chat/completions',
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${grokApiKey}`
                },
                body: JSON.stringify(requestBody)
            }
        );

        if (!response.ok) {
            const errorData = await response.text();
            console.error('Grok API Error:', errorData);
            return Response.json({ 
                error: 'Grok API request failed', 
                details: errorData,
                status: response.status
            }, { status: response.status });
        }

        const data = await response.json();
        console.log('Grok-3 response received');
        
        // Extract the generated content
        const generatedText = data.choices?.[0]?.message?.content;
        
        if (!generatedText) {
            console.error('No content generated:', JSON.stringify(data, null, 2));
            return Response.json({ 
                error: 'No content generated from AI', 
                details: data 
            }, { status: 500 });
        }

        console.log('Generated curriculum map - text length:', generatedText.length);

        // Parse JSON response with multiple cleanup attempts
        let parsedResponse;
        let cleanedText = generatedText.trim();
        
        // Attempt 1: Remove markdown code blocks
        if (cleanedText.startsWith('```json')) {
            cleanedText = cleanedText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
        } else if (cleanedText.startsWith('```')) {
            cleanedText = cleanedText.replace(/^```\s*/, '').replace(/\s*```$/, '');
        }
        
        // Attempt 2: Try parsing
        try {
            parsedResponse = JSON.parse(cleanedText);
            console.log('Successfully parsed curriculum map with Grok-3');
            return Response.json(parsedResponse);
        } catch (parseError) {
            console.error('First parse attempt failed:', parseError.message);
            
            // Attempt 3: Find JSON object in text
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
            
            // Final attempt failed
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