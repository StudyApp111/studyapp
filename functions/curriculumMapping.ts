import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { prompt, response_json_schema, extracted_content, course_name, school, grade, city } = await req.json();

        if (!prompt) {
            return Response.json({ error: 'Prompt is required' }, { status: 400 });
        }

        console.log('=== CURRICULUM MAPPING DEBUG ===');
        console.log('Prompt length:', prompt.length);
        console.log('Course:', course_name, 'School:', school, 'Grade:', grade);
        
        // Two-step approach for reliability:
        // Step 1: Analyze the user's uploaded content directly (this is the PRIMARY source)
        console.log('Step 1: Analyzing user content...');
        
        const contentAnalysisPrompt = `You are analyzing educational content provided by a student for ${course_name} at ${school || 'their school'}.

STUDENT'S UPLOADED CONTENT (THIS IS YOUR PRIMARY SOURCE - ANALYZE THIS THOROUGHLY):
---BEGIN CONTENT---
${extracted_content || ''}
---END CONTENT---

Based on the above content, identify:
1. The main topics and concepts covered
2. Key terminology and vocabulary used
3. Any learning objectives mentioned or implied
4. Important figures, authors, or theorists referenced
5. Assessment types or question formats mentioned

Provide a detailed analysis focusing ONLY on what is in the student's content above.`;

        const contentAnalysis = await base44.integrations.Core.InvokeLLM({
            prompt: contentAnalysisPrompt,
            add_context_from_internet: false
        });

        console.log('Content analysis done, length:', String(contentAnalysis).length);

        // Step 2: Now do web search for curriculum standards, but CONSTRAINED by what we found
        console.log('Step 2: Enhancing with curriculum standards...');
        
        const enhancedPrompt = `${prompt}

CRITICAL INSTRUCTION: The student has provided their own course materials. Your analysis MUST be grounded in their content.

Here is what we found in the student's uploaded materials:
${contentAnalysis}

Your curriculum profile MUST reflect the topics, terminology, and focus areas from the student's materials above.
Use web search ONLY to:
1. Find official curriculum standards for ${course_name} at ${school || grade + ' level'} to validate competency weightings
2. Identify standard assessment formats for this type of course
3. Find common misconceptions related to the specific topics in the student's materials

DO NOT generate a generic curriculum. Every competency, focal point, and misconception must relate to what's in the student's uploaded content.`;

        const result = await base44.integrations.Core.InvokeLLM({
            prompt: enhancedPrompt,
            response_json_schema: response_json_schema,
            add_context_from_internet: true
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