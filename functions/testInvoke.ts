import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        console.log("Invoking testGoogleSearch...");
        const res = await base44.asServiceRole.functions.invoke('testGoogleSearch', {});
        return Response.json({ success: true, data: res.data });
    } catch (error) {
        return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
    }
});