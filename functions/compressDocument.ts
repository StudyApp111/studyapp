import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

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

        const prompt = `You are a document compression engine.

Your ONLY task is to extract and reorganize information that is explicitly present in the input text. 
Compress the result to a maximum of 2000 characters.

Input Content:
${content}

DO NOT:
- search the web
- infer or guess missing topics
- add background or canonical knowledge
- explain, prioritize, or interpret
- rewrite pedagogically
- introduce examples not in the text
- merge or rename concepts unless the document does

If a section has no content, write: None found.

OUTPUT (simple text only, EXACT headings, in this order):

KEY TERMS / DEFINITIONS
- Terms explicitly defined or clearly described.
- Format: Term: definition (use original wording or light paraphrase only)

THEOREMS / FORMULAS / METHODS
- Any theorem, formula, algorithm, method, or step-by-step process explicitly stated.
- Include equations if present.
- Format: Name or Label: statement / steps

READING THEMES / ARGUMENTS
- Explicit themes, claims, or arguments.
- No synthesis.
- Format: • label — 1 sentence

EXAMPLES TO REUSE IN QUESTIONS
- Worked examples, cases, sample problems, or scenarios explicitly included.
- Keep concise and specific.
- Format: Example: brief description

EMPHASIZED VS OPTIONAL
Emphasized:
- Items marked by repetition, headings, or cues like “important”, “key”, “focus”.
Optional:
- Items explicitly labeled optional, supplementary, background, or not required.
- If none: None found.

RULES:
- Use ONLY information from the input.
- No extra headings, bullets, metadata, or commentary.
- This is compression, NOT analysis.
- Total output MUST be ≤ 2000 characters.
`;

        const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent?key=' + apiKey, {
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
                    maxOutputTokens: 2500
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