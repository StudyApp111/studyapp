import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    console.log('=== curriculumMapping Function Start ===');
    
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { prompt, lessonId, courseName, content, school, grade } = await req.json();
        
        // Support both old (prompt-only) and new (lessonId-based) API
        let mappingPrompt = prompt;
        
        // If lessonId provided, build prompt from lesson data
        if (!mappingPrompt && lessonId && content) {
            mappingPrompt = `You are an expert curriculum analyst.

Your task is to analyze the provided lesson content and create a comprehensive curriculum profile that identifies the core competencies, their weightings, common question formats, high-yield topics, and common misconceptions.

INPUT CONTEXT:
- Course Name: ${courseName || "Unknown Course"}
- School: ${school || "N/A"}
- Grade Level: ${grade || "N/A"}

LESSON CONTENT:
${content.substring(0, 15000)}

OUTPUT REQUIREMENTS:
Return a JSON object with these fields:
{
  "core_competencies": [
    { "name": "Competency Name", "description": "Brief description" }
  ],
  "competency_weightings": [
    { "competency_name": "Competency Name", "weight_percentage": "30%" }
  ],
  "question_formats": [
    { "type": "Multiple Choice", "frequency": "High", "examples": ["Example question type"] }
  ],
  "high_yield_focal_points": ["Topic 1", "Topic 2"],
  "common_misconceptions": ["Misconception 1", "Misconception 2"]
}

Be specific to the actual content provided. Identify 4-6 core competencies relevant to this material.`;
        }

        if (!mappingPrompt) {
            return Response.json({ error: 'Prompt or lessonId+content is required' }, { status: 400 });
        }

        const apiKey = Deno.env.get("API_KEY");
        if (!apiKey) {
            return Response.json({ error: 'Service configuration error' }, { status: 500 });
        }

        // Single call with Google Search grounding, temp 0.2
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
            tools: [{
                googleSearch: {}
            }]
        };

        console.log('Calling Gemini API with Google Search grounding...');
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody)
            }
        );

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Gemini API error:', response.status, errorText);
            return Response.json({ 
                error: 'Failed to generate content',
                details: errorText
            }, { status: 500 });
        }

        const data = await response.json();
        
        // Extract text from response
        let generatedText = null;
        const parts = data.candidates?.[0]?.content?.parts || [];
        for (const part of parts) {
            if (part.text) {
                generatedText = part.text;
                break;
            }
        }

        if (!generatedText || generatedText.trim() === '') {
            console.error('No content in response');
            return Response.json({ error: 'No content generated' }, { status: 500 });
        }

        console.log('Generated text length:', generatedText.length);

        // Parse JSON from response
        let jsonStr = generatedText.trim();
        
        // Remove markdown code blocks if present
        const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (jsonMatch) {
            jsonStr = jsonMatch[1].trim();
        }
        
        // Find JSON object boundaries
        if (!jsonStr.startsWith('{')) {
            const jsonStartIdx = jsonStr.indexOf('{');
            const jsonEndIdx = jsonStr.lastIndexOf('}');
            if (jsonStartIdx !== -1 && jsonEndIdx !== -1 && jsonEndIdx > jsonStartIdx) {
                jsonStr = jsonStr.substring(jsonStartIdx, jsonEndIdx + 1);
            }
        }

        let parsedResponse;
        try {
            parsedResponse = JSON.parse(jsonStr);
            console.log('JSON parsed successfully');
        } catch (parseError) {
            console.error('JSON parse failed:', parseError.message);
            return Response.json({ 
                error: 'Failed to parse response as JSON',
                raw: generatedText.substring(0, 500)
            }, { status: 500 });
        }
        
        // Unwrap nested curriculum data if needed
        if (parsedResponse && !parsedResponse.core_competencies) {
            const wrapperKeys = ['curriculum_profile', 'course_profile', 'profile', 'data', 'result'];
            for (const key of wrapperKeys) {
                if (parsedResponse[key]?.core_competencies) {
                    parsedResponse = parsedResponse[key];
                    console.log(`Unwrapped from "${key}"`);
                    break;
                }
            }
        }

        // If no core_competencies, create a generic structure for non-standard content
        if (!parsedResponse?.core_competencies) {
            console.log('No core_competencies found, creating generic structure');
            parsedResponse = {
                core_competencies: [
                    { name: "Reading Comprehension", description: "Understanding and analyzing text passages" },
                    { name: "Critical Analysis", description: "Evaluating and interpreting content" },
                    { name: "Vocabulary", description: "Understanding word meanings in context" }
                ],
                competency_weightings: [
                    { competency_name: "Reading Comprehension", weight_percentage: "40%" },
                    { competency_name: "Critical Analysis", weight_percentage: "35%" },
                    { competency_name: "Vocabulary", weight_percentage: "25%" }
                ],
                question_formats: [
                    { type: "Multiple Choice", frequency: "High", examples: ["Reading comprehension questions"] }
                ],
                high_yield_focal_points: ["Main idea identification", "Supporting details", "Author's purpose"],
                common_misconceptions: ["Confusing inference with stated facts"]
            };
        }

        console.log('=== curriculumMapping Complete ===');
        return Response.json(parsedResponse);

    } catch (error) {
        console.error('Error in curriculumMapping:', error.message);
        return Response.json({ 
            error: 'Internal server error',
            message: error.message
        }, { status: 500 });
    }
});