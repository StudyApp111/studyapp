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

        const MAX_TOTAL_INPUT = 200000; // Cap total input to ~200K chars

        // For very large documents (180+ pages), sample strategically
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

        // ── Run Phase 1 (topic extraction) and Phase 2 (compression) in PARALLEL ──
        console.log('🚀 Starting Phase 1 (topics) + Phase 2 (compression) in PARALLEL...');

        // ── PHASE 1: Extract structured topics (async) ──
        const topicInputContent = workingContent.length > 60000 
            ? workingContent.substring(0, 30000) + "\n\n...[middle content omitted]...\n\n" + workingContent.substring(workingContent.length - 30000)
            : workingContent;

        const topicPrompt = `You are a document structure analyzer. Your job is to extract a TWO-LEVEL hierarchy from this educational document.

OUTPUT STRUCTURE (MANDATORY):
- Level 1 = SECTIONS: The document's major structural divisions (chapters, lectures, units, modules, weeks, parts, etc.)
- Level 2 = TOPICS: The specific concepts, ideas, or sub-headings discussed WITHIN each section. These go in the "subtopics" array.

HOW TO IDENTIFY SECTIONS (Level 1):
Look for headings like "Lecture 1", "Chapter 1", "Unit 1", "Module 1", "Week 1", "Part 1", "Section 1", etc.
Also look for: Roman numerals (I, II, III), bold/uppercase headers, slide deck title pages, or any clear top-level organizational markers.
Preserve the original naming exactly as it appears in the document (e.g., "LECTURE 1: INTRODUCTION TO HINDUISM").

HOW TO IDENTIFY TOPICS (Level 2):
For EACH section above, list the specific concepts, themes, or sub-headings covered within it.
Topics should be specific and study-able (e.g., "Karma and Dharma", "The Four Noble Truths") — NOT vague labels like "Key Concepts" or "Main Ideas".

ABSOLUTE RULES:
1. The top-level array items are ONLY sections (chapters/lectures/units). Individual topics MUST go inside subtopics.
2. Every section MUST have at least 2 items in its subtopics array.
3. A topic must NEVER appear at the top level. If you find a concept like "Karma and Dharma", it belongs inside the subtopics of whichever section covers it.
4. If the document has 2 lectures with 4 topics each, output 2 items (not 8). The 4 topics go in each section's subtopics.
5. If NO clear structural divisions exist (single essay or notes dump), create 2-4 thematic sections and nest concepts under each.
6. Each description should be 2-3 sentences summarizing the content.

DOCUMENT CONTENT:
${topicInputContent}`;

        const topicPromise = fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent?key=' + apiKey, {
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
                                    required: ["title", "description", "subtopics"]
                                }
                            }
                        },
                        required: ["topics"]
                    }
                }
            })
        }).then(async (topicResponse) => {
            if (topicResponse.ok) {
                const topicData = await topicResponse.json();
                const topicText = topicData.candidates?.[0]?.content?.parts?.[0]?.text;
                if (topicText) {
                    const parsed = JSON.parse(topicText);
                    console.log('✅ Phase 1: Extracted', (parsed.topics || []).length, 'topics');
                    return parsed.topics || [];
                }
            } else {
                console.warn('⚠️ Topic extraction failed:', topicResponse.status);
            }
            return [];
        }).catch((topicErr) => {
            console.warn('⚠️ Topic extraction error:', topicErr.message);
            return [];
        });

        // ── PHASE 2: Single-pass compression (no chunking — Gemini handles 124K input fine) ──
        const compressionPromise = (async () => {
            console.log('📤 Single-pass compression, input size:', workingContent.length);

            const prompt = `You are a document compression engine. Extract and compress the key educational content from this document into a structured summary.

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
- No extra commentary.

DOCUMENT TO COMPRESS:
${workingContent}`;

            const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent?key=' + apiKey, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: { temperature: 0.1, maxOutputTokens: 2500 }
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('❌ Gemini compression error:', errorText);
                throw new Error(`Gemini API error: ${response.status}`);
            }

            const data = await response.json();
            return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        })();

        // Wait for BOTH phases to finish in parallel
        const [topics, compressedContent] = await Promise.all([topicPromise, compressionPromise]);

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