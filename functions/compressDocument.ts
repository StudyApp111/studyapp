import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    console.log('=== compressDocument Function Start ===');
    
    try {
        const base44 = createClientFromRequest(req);
        console.log('✅ Base44 client created');
        
        const user = await base44.auth.me();
        console.log('✅ User authenticated:', user?.email);

        if (!user) {
            console.error('❌ Authentication failed - no user');
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { content } = await req.json();
        console.log('✅ Request body parsed, content length:', content?.length);

        if (!content) {
            console.error('❌ Missing content in request');
            return Response.json({ error: 'Content is required' }, { status: 400 });
        }

        const apiKey = Deno.env.get('API_KEY');
        if (!apiKey) {
            console.error('❌ CRITICAL: API_KEY not found in environment');
            return Response.json({ error: 'API key not configured' }, { status: 500 });
        }
        console.log('✅ API key found');

        const prompt = `Context You are a document compression and structuring engine.
Your sole function is to extract and reorganize information that is explicitly present in the provided content and compress it to <1500 characters. You must not interpret, infer, explain, prioritize, or add any knowledge.
Input Content to process: ${content}
Task Produce a compact, structured digest that can replace the content in downstream prompts.
You MUST NOT:
* search the web
* infer missing topics
* add canonical knowledge
* normalize or "clean up" concepts
* decide what should be important
* rewrite content pedagogically
* introduce examples not present in the text
If a category has no information in the content, write: None found.
Output (MUST be simple text, exactly these headings, in this order)
KEY TERMS / DEFINITIONS
* Extract terms that are explicitly defined or clearly described in the content.
* Use the definition exactly as written or lightly paraphrased without interpretation.
* Format: Term: definition
THEOREMS / FORMULAS / METHODS
* Extract any theorem, formula, algorithm, method, procedure, or step-by-step process explicitly present.
* Include equations or formal statements if present.
* Format: Name or Label: statement / steps
READING THEMES / ARGUMENTS
* Extract themes, arguments, positions, or claims explicitly stated in the content.
* Do not synthesize or generalize beyond the text.
* Format: • short label — 1 sentence
EXAMPLES TO REUSE IN QUESTIONS
* Extract worked examples, case studies, sample problems, scenarios, or illustrations explicitly included.
* Preserve original intent and scope; keep them concise but specific.
* Format: Example: brief description (include any numbers/names if present)
EMPHASIZED VS OPTIONAL Emphasized (explicit signals only)
* Extract items emphasized by repetition, headings, bolding, or explicit cues like "important", "focus", "key". Optional / De-emphasized (explicit signals only)
* Extract items explicitly labeled optional/supplementary/review/background/not required.
* If none: None found.
Strict Rules
* Use only information present in the content.
* Do not merge or rename concepts unless the document does.
* Do not add commentary or explanation.
* Do not add any extra headings, fields, bullets, or metadata.
* This is a compression, not an analysis.
* Total output should be no more than 1500 characters.`;

        const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=' + apiKey, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: prompt
                    }]
                }],
                generationConfig: {
                    temperature: 0.1,
                    maxOutputTokens: 2024
                }
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Gemini API error:', errorText);
            return Response.json({ error: 'Failed to compress document' }, { status: 500 });
        }

        const data = await response.json();
        const compressedContent = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!compressedContent) {
            return Response.json({ error: 'No compressed content received' }, { status: 500 });
        }

        return Response.json({ compressed_content: compressedContent });

    } catch (error) {
        console.error('Error compressing document:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});