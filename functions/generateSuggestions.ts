import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { courseName, school, grade } = await req.json();

        if (!courseName) {
            return Response.json({ error: 'Course name is required' }, { status: 400 });
        }

        const apiKey = Deno.env.get("API_KEY");
        if (!apiKey) {
            return Response.json({ error: 'Service configuration error' }, { status: 500 });
        }

        const prompt = `Generate 4 specific study topic suggestions for a student.

Use the course name and available context to guide a brief search so that topics are accurate to the subject matter.

Course: ${courseName}
${school ? `School: ${school}` : ''}
${grade ? `Grade: ${grade}` : ''}

Instructions:
- Search for curriculum standards, syllabi, or common exam topics for this course.
- If official documents are available online (school, department, state/province standards), use them to inform topic selection.
- Otherwise, infer likely high-yield topics based on the course name and typical curriculum for this level.

Return ONLY a JSON object with a "topics" array containing 4 short, specific topic descriptions (15–30 words each) that would be good for studying this course.
Focus on common chapters, units, or exam topics that students are typically tested on.

Example output format:
{"topics": ["Chapter 3: Photosynthesis - light reactions, Calvin cycle, chloroplast structure", "Unit 2: Cell Division - mitosis phases, chromosome separation"]}

IMPORTANT: Return ONLY valid JSON with no markdown formatting, no code blocks, no extra text.`;

        const requestBody = {
            contents: [{
                parts: [{
                    text: prompt
                }]
            }],
            generationConfig: {
                temperature: 0.2,
                topP: 0.95,
                maxOutputTokens: 2048
            },
            tools: [{
                googleSearch: {}
            }]
        };

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody)
            }
        );

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Gemini API error:', response.status, errorText);
            return Response.json({ error: 'Failed to generate suggestions' }, { status: 500 });
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
            return Response.json({ error: 'No suggestions generated' }, { status: 500 });
        }

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
        } catch (parseError) {
            console.error('JSON parse failed:', parseError.message);
            return Response.json({ topics: [] });
        }

        return Response.json({ topics: parsedResponse.topics || [] });

    } catch (error) {
        console.error('Error in generateSuggestions:', error.message);
        return Response.json({ error: 'Internal server error' }, { status: 500 });
    }
});