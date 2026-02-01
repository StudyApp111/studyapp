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

    const prompt = `You are a curriculum expert. Generate 4 concise, specific study topic suggestions for a student taking "${courseName}" ${grade ? `in grade ${grade}` : ''} ${school ? `at ${school}` : ''}.

REQUIREMENTS:
- Each topic should be 30-80 characters
- Be specific to likely course content (chapters, units, key concepts)
- Focus on testable material
- Use academic language appropriate for the level
- Make them diverse (cover different course areas if possible)

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