import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { prompt, response_json_schema } = await req.json();

    const response = await base44.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema,
      add_context_from_internet: true
    });

    return Response.json(response);
  } catch (error) {
    console.error('Error generating teach it cards:', error);
    return Response.json(
      { error: error.message || 'Failed to generate cards' },
      { status: 500 }
    );
  }
});