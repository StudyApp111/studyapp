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

        const result = await base44.integrations.Core.InvokeLLM({
            prompt: prompt,
            response_json_schema: response_json_schema,
            add_context_from_internet: true
        });

        return Response.json(result);

    } catch (error) {
        return Response.json({ 
            error: 'Internal server error'
        }, { status: 500 });
    }
});