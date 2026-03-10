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

        const { content, lessonId, pre_made_course_id } = await req.json();
        
        let contentToUse = content;
        if (!contentToUse && lessonId) {
            const lessons = await base44.asServiceRole.entities.Lesson.filter({ id: lessonId });
            if (lessons.length > 0) {
                contentToUse = lessons[0].extracted_content || lessons[0].description;
            }
        } else if (!contentToUse && pre_made_course_id) {
            const courses = await base44.asServiceRole.entities.PreMadeCourse.filter({ id: pre_made_course_id });
            if (courses.length > 0) {
                contentToUse = courses[0].extracted_content || courses[0].description || courses[0].course_name;
            }
        }

        console.log('✅ Request body parsed, content length:', contentToUse?.length);

        if (!contentToUse) {
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
        let workingContent = contentToUse;
        if (contentToUse.length > MAX_TOTAL_INPUT) {
            console.log(`⚠️ Very large document (${contentToUse.length} chars), sampling strategically...`);
            const third = Math.floor(MAX_TOTAL_INPUT / 3);
            const midStart = Math.floor(contentToUse.length / 2) - Math.floor(third / 2);
            workingContent = contentToUse.substring(0, third) + 
                "\n\n...[beginning section ends, middle section begins]...\n\n" + 
                contentToUse.substring(midStart, midStart + third) + 
                "\n\n...[middle section ends, final section begins]...\n\n" + 
                contentToUse.substring(contentToUse.length - third);
            console.log(`📐 Sampled down to ${workingContent.length} chars (from ${contentToUse.length})`);
        }

        // ── Run Phase 1 (topic extraction) and Phase 2 (compression) in PARALLEL ──
        console.log('🚀 Starting Phase 1 (topics) + Phase 2 (compression) in PARALLEL...');

        // ── PHASE 1: Extract structured topics (async) ──
        // Limit topic extraction input for faster processing (target ~5s per LLM call)
        // For large documents, sample beginning + end only (structure is usually in headers/TOC)
        const MAX_TOPIC_INPUT = 25000;
        let topicInputContent;
        if (workingContent.length > MAX_TOPIC_INPUT) {
            const halfMax = Math.floor(MAX_TOPIC_INPUT / 2);
            topicInputContent = workingContent.substring(0, halfMax) + "\n\n...[middle content omitted]...\n\n" + workingContent.substring(workingContent.length - halfMax);
            console.log(`📐 Topic input capped at ${topicInputContent.length} chars (from ${workingContent.length})`);
        } else {
            topicInputContent = workingContent;
        }

        const topicPrompt = `You are a document structure analyzer. Your task is to extract the HIERARCHICAL structure from this educational document.

═══════════════════════════════════════════════════════════════
CRITICAL: OUTPUT MUST BE A 2-LEVEL HIERARCHY
═══════════════════════════════════════════════════════════════

LEVEL 1 = SECTIONS (the document's major organizational divisions)
LEVEL 2 = TOPICS (the specific concepts discussed WITHIN each section)

Think of it like a textbook Table of Contents:
- "Chapter 1: Introduction" ← SECTION (Level 1)
  - "What is Biology?" ← TOPIC (Level 2)
  - "The Scientific Method" ← TOPIC (Level 2)
- "Chapter 2: Cells" ← SECTION (Level 1)
  - "Cell Structure" ← TOPIC (Level 2)
  - "Organelles" ← TOPIC (Level 2)

═══════════════════════════════════════════════════════════════
STEP 1: IDENTIFY SECTIONS (Top-Level Divisions)
═══════════════════════════════════════════════════════════════

Scan for the document's major organizational markers:
• "Lecture 1", "Lecture 2", "Lecture 3"...
• "Chapter 1", "Chapter 2"...
• "Unit 1", "Module 1", "Week 1", "Part I"...
• Roman numerals: I., II., III.
• Slide deck title pages
• Bold/large headings that separate content blocks
• "Class 1", "Session 1", "Day 1"...

These become your TOP-LEVEL items in the output array.
PRESERVE THE ORIGINAL NAMES EXACTLY (e.g., "Lecture 3: The Roman Empire", "Chapter 5: Thermodynamics").

═══════════════════════════════════════════════════════════════
STEP 2: EXTRACT TOPICS WITHIN EACH SECTION
═══════════════════════════════════════════════════════════════

For EACH section identified above, list the specific concepts/topics discussed WITHIN that section as "subtopics".

Example: If "Lecture 2" discusses photosynthesis and cellular respiration, output:
{
  "title": "Lecture 2: Energy in Cells",
  "description": "...",
  "subtopics": [
    { "title": "Photosynthesis", "description": "..." },
    { "title": "Cellular Respiration", "description": "..." }
  ]
}

═══════════════════════════════════════════════════════════════
MANDATORY RULES
═══════════════════════════════════════════════════════════════

1. EVERY top-level item MUST have a "subtopics" array with AT LEAST 2 items.
2. NEVER output a flat list of topics without subtopics. That is WRONG.
3. If the document has no clear sections, create 3-5 thematic groupings yourself.
4. Subtopics must be SPECIFIC (e.g., "Krebs Cycle" not "Key Concepts").
5. Descriptions should be 2-3 sentences with enough detail to generate study materials.

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