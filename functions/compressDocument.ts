import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    console.log('=== compressDocument Function Start ===');
    
    try {
        const base44 = createClientFromRequest(req);
        console.log('✅ Base44 client created');
        
        // Try to get user but don't require authentication (onboarding flow)
        let user = null;
        try {
            user = await base44.auth.me();
            console.log('✅ User authenticated:', user?.email);
        } catch (authError) {
            console.log('ℹ️ No user authentication - proceeding for onboarding flow');
        }

        const { content } = await req.json();
        console.log('✅ Request body parsed, content length:', content?.length);

        if (!content) {
            console.error('❌ Missing content in request');
            return Response.json({ error: 'Content is required' }, { status: 400 });
        }

        const apiKey = Deno.env.get('GEMINIAPIKEY');
        if (!apiKey) {
            console.error('❌ CRITICAL: API_KEY not found in environment');
            return Response.json({ error: 'API key not configured' }, { status: 500 });
        }
        console.log('✅ API key found');

        const MAX_CHUNK_SIZE = 40000; // ~10K tokens safe limit

        const compressChunk = async (chunkContent, isFinalPass = false) => {
            const prompt = isFinalPass 
                ? `You are a document compression engine. Consolidate this extracted information into a final summary.

Input:
${chunkContent}

OUTPUT (simple text only, EXACT headings):

KEY TERMS / DEFINITIONS
- Format: Term: definition

THEOREMS / FORMULAS / METHODS
- Format: Name: statement/steps

READING THEMES / ARGUMENTS
- Format: • label — 1 sentence

EXAMPLES TO REUSE IN QUESTIONS
- Format: Example: brief description

EMPHASIZED VS OPTIONAL
Emphasized: items marked important
Optional: items marked optional

RULES:
- Total output MUST be ≤ 2000 characters.
- No extra commentary.`
                : `Extract key educational content from this text section. Be concise.

Input:
${chunkContent}

Extract:
1. KEY TERMS with definitions
2. FORMULAS/METHODS/THEOREMS
3. MAIN ARGUMENTS/THEMES
4. EXAMPLES mentioned
5. What's EMPHASIZED vs OPTIONAL

Output concise bullet points only. No commentary.`;

            const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent?key=' + apiKey, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: { temperature: 0.1, maxOutputTokens: isFinalPass ? 2500 : 1500 }
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('❌ Gemini chunk error:', errorText);
                throw new Error(`Gemini API error: ${response.status}`);
            }

            const data = await response.json();
            return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        };

        let compressedContent;

        if (content.length <= MAX_CHUNK_SIZE) {
            console.log('📤 Direct compression (small document)');
            compressedContent = await compressChunk(content, true);
        } else {
            console.log('📤 Chunked compression - document size:', content.length);
            
            // Split into chunks
            const chunks = [];
            for (let i = 0; i < content.length; i += MAX_CHUNK_SIZE) {
                chunks.push(content.slice(i, i + MAX_CHUNK_SIZE));
            }
            console.log('📦 Split into', chunks.length, 'chunks');

            // Process chunks in parallel (max 3 concurrent)
            const chunkResults = [];
            const batchSize = 3;
            
            for (let i = 0; i < chunks.length; i += batchSize) {
                const batch = chunks.slice(i, i + batchSize);
                console.log(`📤 Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(chunks.length/batchSize)}`);
                
                const batchResults = await Promise.all(
                    batch.map(chunk => compressChunk(chunk, false))
                );
                chunkResults.push(...batchResults);
            }

            // Merge and do final compression
            const mergedContent = chunkResults.filter(r => r).join('\n\n');
            console.log('🔗 Merged extractions, length:', mergedContent.length);

            console.log('📤 Final consolidation pass');
            compressedContent = await compressChunk(mergedContent, true);
        }

        if (!compressedContent) {
            console.error('❌ No content in response');
            return Response.json({ error: 'No compressed content received' }, { status: 500 });
        }

        console.log('✅ Compression successful, output length:', compressedContent.length);
        return Response.json({ compressed_content: compressedContent });

    } catch (error) {
        console.error('❌ Error compressing document:', error.message);
        return Response.json({ error: error.message }, { status: 500 });
    }
});