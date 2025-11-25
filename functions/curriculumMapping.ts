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

        // For large content, we need a two-step approach:
        // 1. First analyze the user content directly (no web search to avoid interference)
        // 2. Then enhance with web context using the extracted topics

        console.log('=== CURRICULUM MAPPING DEBUG ===');
        console.log('Prompt length:', prompt.length);

        // Extract course info for targeted web search
        const courseMatch = prompt.match(/Course\/Unit Name:\s*([^\n]+)/);
        const schoolMatch = prompt.match(/School Context:\s*([^\n]+)/);
        const gradeMatch = prompt.match(/Student Grade Level:\s*([^\n]+)/);
        
        const courseName = courseMatch?.[1]?.trim() || '';
        const school = schoolMatch?.[1]?.trim() || '';
        const grade = gradeMatch?.[1]?.trim() || '';

        console.log('Extracted - Course:', courseName, 'School:', school, 'Grade:', grade);

        // Step 1: Analyze user content directly WITHOUT web search
        const result = await base44.integrations.Core.InvokeLLM({
            prompt: prompt,
            response_json_schema: response_json_schema,
            add_context_from_internet: false
        });

        console.log('LLM Result preview:', JSON.stringify(result).substring(0, 500));

        return Response.json(result);

    } catch (error) {
        console.error('Curriculum mapping error:', error);
        return Response.json({ 
            error: 'Internal server error',
            details: error.message
        }, { status: 500 });
    }
});