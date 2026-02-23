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

        const topicPrompt = `You are a document structure analyzer. Analyze this educational document and extract its hierarchical organizational structure.

STEP 1 — IDENTIFY THE TOP-LEVEL STRUCTURE:
Look for the document's major divisions. These are typically marked by:
- Numbered headings: "Lecture 1", "Chapter 1", "Unit 1", "Module 1", "Week 1", "Part 1", "Section 1", "Class 1", "Session 1", "Topic 1"
- Roman numerals: "I.", "II.", "III."
- Textbook chapters with titles
- Slide deck separators or title slides
- Bold/uppercase section headers
- Any other clear top-level organizational pattern

STEP 2 — EXTRACT SUBTOPICS WITHIN EACH TOP-LEVEL SECTION:
For each major section identified above, find the specific topics, concepts, or sub-headings discussed WITHIN that section. These become subtopics.

CRITICAL RULES:
1. HIERARCHY IS MANDATORY: Every document has at least 2 levels. Top-level sections contain subtopics. NEVER output a flat list of topics with no subtopics — always nest specific concepts under their parent section.
2. If the document has "Lecture 1" covering topics A, B, C and "Lecture 2" covering topics D, E, F — output 2 top-level items, each with their respective subtopics nested inside.
3. Preserve the original naming exactly (e.g., "Lecture 1: Introduction to Hinduism", "Chapter 3: Cell Division").
4. Each top-level section MUST have at least 2 subtopics. If a section seems to have only one concept, break it into finer-grained subtopics.
5. If NO clear structural divisions exist (e.g., a single essay or notes dump), create 3-5 thematic sections yourself and nest specific concepts under each.
6. Subtopics should be specific and actionable (e.g., "Karma and Dharma" not "Key Concepts").
7. Each description should be 2-3 sentences with enough detail for an AI to generate study materials about it.

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
                                    required: ["title", "description"]
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