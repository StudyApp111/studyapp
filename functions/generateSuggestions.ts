import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { courseName, school, grade } = await req.json();
    
    if (!courseName) {
      return Response.json({ error: 'Course name required' }, { status: 400 });
    }

    const prompt = `You are an expert educator. Generate exactly 4 high-quality study topics for this course by doing a quick google search.

Course: ${courseName}
${school ? `School context: ${school}` : ''}

Return ONLY a JSON array with 4 specific, actionable study topics. Each topic should be 10-20 words describing a key concept or unit from this course.

Output only the JSON array, no other text:

Return ONLY the 4 topics as a JSON array of strings. Example format:
["Topic 1 description", "Topic 2 description", "Topic 3 description", "Topic 4 description"]`;

    const response = await base44.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: {
        type: "object",
        properties: {
          topics: {
            type: "array",
            items: { type: "string" },
            minItems: 4,
            maxItems: 4
          }
        },
        required: ["topics"]
      }
    });

    return Response.json({
      success: true,
      topics: response.topics || []
    });
    
  } catch (error) {
    console.error('Generate suggestions error:', error);
    return Response.json({ 
      error: error.message || 'Failed to generate suggestions' 
    }, { status: 500 });
  }
});