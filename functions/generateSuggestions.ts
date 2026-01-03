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

        const prompt = `Generate 4 study topic suggestions for a student.

Course: ${courseName}
${userSchool ? `School: ${userSchool}` : ''}
${userGrade ? `Grade: ${userGrade}` : ''}

Instructions:
- Use search to find an official or commonly cited course outline/syllabus for this course.
- Identify the actual units, modules, or sections used to structure the course.
- Each suggestion MUST correspond to a different real unit or section found in those sources.
- Use the unit’s original wording where possible (minor shortening allowed).
- Do NOT invent units or rephrase the same unit multiple ways.

Return ONLY a JSON array of 4 unit-style topics (15–30 words each).

Example format:
["Unit 1: Greek prefixes and roots in medical terminology",
 "Unit 2: Latin suffixes and morphological patterns in life sciences",
 "Unit 3: Etymology of medical vocabulary from classical sources",
 "Unit 4: Scientific term formation and structural analysis"]

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