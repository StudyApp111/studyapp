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

        console.log('=== CURRICULUM MAPPING ===');
        console.log('Prompt length:', prompt.length);
        console.log('Prompt preview (first 500 chars):', prompt.substring(0, 500));

        // CRITICAL: Do NOT use add_context_from_internet as it pollutes the response
        // with irrelevant web search results that override the actual curriculum content.
        // The prompt already contains all the extracted content from the uploaded document.
        const result = await base44.integrations.Core.InvokeLLM({
            prompt: prompt,
            response_json_schema: response_json_schema,
            add_context_from_internet: false
        });

        console.log('Result preview:', JSON.stringify(result).substring(0, 500));

        return Response.json(result);

    } catch (error) {
        console.error('Curriculum mapping error:', error);
        return Response.json({ 
            error: 'Internal server error',
            details: error.message
        }, { status: 500 });
    }
});