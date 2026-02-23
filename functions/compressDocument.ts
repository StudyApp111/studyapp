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
        const MAX_TOTAL_INPUT = 200000; // Cap total input to ~200K chars to prevent timeouts on huge documents

        // For very large documents (180+ pages), sample strategically instead of processing everything
        let workingContent = content;
        if (content.length > MAX_TOTAL_INPUT) {
            console.log(`⚠️ Very large document (${content.length} chars), sampling strategically...`);
            const third = Math.floor(MAX_TOTAL_INPUT / 3);
            const midStart = Math.floor(content.length / 2) - Math.floor(third / 2);
            workingContent = content.substring(0, third) + 
                "\n\n...[beginning section ends, middle section begins]...\n\n" + 
                content.substring(midStart, midStart + third) + 
                "\n\n...[middle section ends, final section begins]...\n\n" + 
                content.substring(content.length - third);
            console.log(`📐 Sampled down to ${workingContent.length} chars (from ${content.length})`);
        }

        // ── PHASE 1: Extract structured topics from the document ──
        console.log('📋 Phase 1: Extracting structured topics...');
        
        // Use up to 60K chars for topic detection to get good structural coverage
        const topicInputContent = workingContent.length > 60000 
            ? workingContent.substring(0, 30000) + "\n\n...[middle content omitted]...\n\n" + workingContent.substring(workingContent.length - 30000)
            : workingContent;

        const topicPrompt = `You are a document structure analyzer. Analyze this educational document and extract its organizational structure into topics.

DOCUMENT CONTENT:
${topicInputContent}

INSTRUCTIONS:
1. Identify the document's natural organizational structure: chapters, lectures, units, modules, sections, parts, classes, weeks, etc.
2. For each top-level section, extract sub-topics if they exist.
3. Each topic needs a clear title and a detailed description (2-3 sentences) summarizing what that section covers — enough detail for an AI to generate flashcards, quiz questions, or study cards about it.
4. Preserve the original naming convention (e.g., "Chapter 1:", "Lecture 2:", "Unit 3:", "Week 4:" etc.)
5. If no clear structural divisions exist, extract 5-10 major conceptual topics from the content.

OUTPUT FORMAT:
Return a JSON object with a "topics" array. Each topic has:
- "title": The section/chapter/lecture name exactly as it appears
- "description": 2-3 sentence summary of what this topic covers, including key concepts, terms, and ideas
- "key_content": A detailed paragraph (4-6 sentences) capturing the essential information, definitions, formulas, arguments, or facts from this section — enough for question generation
- "subtopics": Optional array of child topic objects (same structure, without further nesting)`;

        let topics = [];
        try {
            const topicResponse = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent?key=' + apiKey, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: topicPrompt }] }],
                    generationConfig: { 
                        temperature: 0.1, 
                        maxOutputTokens: 4000,
                        responseMimeType: "application/json",
                        responseSchema: {
                            type: "object",
                            properties: {
                                topics: {
                                    type: "array",
                                    items: {
                                        type: "object",
                                        properties: {
                                            title: { type: "string" },
                                            description: { type: "string" },
                                            key_content: { type: "string" },
                                            subtopics: {
                                                type: "array",
                                                items: {
                                                    type: "object",
                                                    properties: {
                                                        title: { type: "string" },
                                                        description: { type: "string" },
                                                        key_content: { type: "string" }
                                                    },
                                                    required: ["title", "description"]
                                                }
                                            }
                                        },
                                        required: ["title", "description"]
                                    }
                                }
                            },
                            required: ["topics"]
                        }
                    }
                })
            });

            if (topicResponse.ok) {
                const topicData = await topicResponse.json();
                const topicText = topicData.candidates?.[0]?.content?.parts?.[0]?.text;
                if (topicText) {
                    const parsed = JSON.parse(topicText);
                    topics = parsed.topics || [];
                    console.log('✅ Extracted', topics.length, 'topics');
                }
            } else {
                console.warn('⚠️ Topic extraction failed:', topicResponse.status);
            }
        } catch (topicErr) {
            console.warn('⚠️ Topic extraction error:', topicErr.message);
        }

        // ── PHASE 2: Compress document content (existing logic) ──
        console.log('📦 Phase 2: Compressing document content...');

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

        if (workingContent.length <= MAX_CHUNK_SIZE) {
            console.log('📤 Direct compression (small document)');
            compressedContent = await compressChunk(workingContent, true);
        } else {
            console.log('📤 Chunked compression - document size:', workingContent.length);
            
            // Split into chunks
            const chunks = [];
            for (let i = 0; i < workingContent.length; i += MAX_CHUNK_SIZE) {
                chunks.push(workingContent.slice(i, i + MAX_CHUNK_SIZE));
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
        console.log('✅ Topics extracted:', topics.length);
        
        return Response.json({ 
            compressed_content: compressedContent,
            topics: topics
        });

    } catch (error) {
        console.error('❌ Error compressing document:', error.message);
        return Response.json({ error: error.message }, { status: 500 });
    }
});