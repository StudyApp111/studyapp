import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * compressDocument
 *
 * Two-phase, runs in PARALLEL:
 *   PHASE 1 — Topic extraction (hierarchical 2-level tree).
 *             For MULTI-DOC uploads (detected by "=== Document N: ..." markers
 *             from CreateLesson's labeled concatenation), each document is
 *             topic-extracted independently in parallel and merged into one
 *             tree. Each doc becomes its OWN top-level section so the user
 *             can see which content came from which file.
 *   PHASE 2 — Compress full corpus to ≤2000 chars for downstream prompt use.
 *
 * Model: gemini-flash-lite-latest (do not change — instruction from owner).
 */

const TOPIC_MODEL_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent';
const COMPRESS_MODEL_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent';

const MAX_TOTAL_INPUT = 200000;       // hard cap on compression input
const MAX_TOPIC_INPUT_PER_DOC = 25000; // per-doc cap for topic extraction

// ── Topic extraction prompts ────────────────────────────────────────────────

const TOPIC_PROMPT_SINGLE_DOC = (content) => `You are a document structure analyzer. Your task is to extract the HIERARCHICAL structure from this educational document.

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
${content}`;

// Same instructions but framed for a single uploaded file inside a multi-doc lesson.
// The output for THIS doc becomes ONE top-level section (named after the file)
// whose subtopics are the topics discussed inside that file.
const TOPIC_PROMPT_PER_DOC = (docLabel, content) => `You are a document structure analyzer. Extract the SPECIFIC TOPICS discussed inside this single document. The student uploaded multiple documents — your output will be merged with the others, so focus ONLY on this file.

The document is titled: "${docLabel}"

═══════════════════════════════════════════════════════════════
OUTPUT FORMAT
═══════════════════════════════════════════════════════════════

Output a JSON object: { "topics": [ ... ] }
The "topics" array must contain EXACTLY ONE top-level item:
{
  "title": "${docLabel}",
  "description": "A 1-2 sentence summary of what this document covers.",
  "subtopics": [
    { "title": "Specific concept 1", "description": "..." },
    { "title": "Specific concept 2", "description": "..." },
    ...
  ]
}

═══════════════════════════════════════════════════════════════
RULES FOR SUBTOPICS
═══════════════════════════════════════════════════════════════

1. List 3–10 specific topics actually discussed in THIS document.
2. Subtopics must be SPECIFIC (e.g., "Krebs Cycle" not "Key Concepts").
3. Descriptions: 2–3 sentences with enough detail to generate study materials.
4. Do NOT invent topics not present in the source.
5. If the document is very short, 2 subtopics is acceptable. Never zero.

DOCUMENT CONTENT:
${content}`;

const TOPIC_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    topics: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          description: { type: 'string' },
          key_content: { type: 'string' },
          subtopics: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                title: { type: 'string' },
                description: { type: 'string' },
                key_content: { type: 'string' },
              },
              required: ['title', 'description'],
            },
          },
        },
        required: ['title', 'description'],
      },
    },
  },
  required: ['topics'],
};

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Split the labeled corpus produced by CreateLesson back into per-doc chunks.
 * Marker format (from CreateLesson):  "=== Document N: filename ===\n\n<body>"
 * Returns [] if no markers found (i.e. single-doc lesson).
 */
function splitMultiDocCorpus(content) {
  const MARKER = /^=== (Document \d+:[^=]+?) ===\s*$/gm;
  const matches = [...content.matchAll(MARKER)];
  if (matches.length < 2) return []; // <2 markers means it's effectively single-doc

  const docs = [];
  for (let i = 0; i < matches.length; i++) {
    const label = matches[i][1].trim();
    const bodyStart = matches[i].index + matches[i][0].length;
    const bodyEnd = i + 1 < matches.length ? matches[i + 1].index : content.length;
    const body = content.substring(bodyStart, bodyEnd).trim();
    if (body.length > 0) docs.push({ label, body });
  }
  return docs;
}

/** Sample a doc down to a target size by taking head + tail (preserves structure). */
function sampleForTopicExtraction(text, maxChars = MAX_TOPIC_INPUT_PER_DOC) {
  if (text.length <= maxChars) return text;
  const half = Math.floor(maxChars / 2);
  return (
    text.substring(0, half) +
    '\n\n...[middle content omitted]...\n\n' +
    text.substring(text.length - half)
  );
}

/** Call Gemini topic extraction. Returns the parsed topics[] array, or []. */
async function extractTopics(apiKey, prompt) {
  try {
    const resp = await fetch(`${TOPIC_MODEL_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 4000,
          responseMimeType: 'application/json',
          responseSchema: TOPIC_RESPONSE_SCHEMA,
        },
      }),
    });
    if (!resp.ok) {
      console.warn('⚠️ Topic extraction HTTP error:', resp.status);
      return [];
    }
    const json = await resp.json();
    const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return [];
    const parsed = JSON.parse(text);
    return parsed.topics || [];
  } catch (err) {
    console.warn('⚠️ Topic extraction error:', err.message);
    return [];
  }
}

// ── Main handler ────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  console.log('=== compressDocument Function Start ===');
  try {
    const base44 = createClientFromRequest(req);
    console.log('✅ Base44 client created');

    let user = null;
    try {
      user = await base44.auth.me();
      console.log('✅ User authenticated:', user?.email);
    } catch {
      console.log('ℹ️ No user authentication - proceeding for onboarding flow');
    }

    const { content } = await req.json();
    console.log('✅ Request body parsed, content length:', content?.length);

    if (!content) {
      return Response.json({ error: 'Content is required' }, { status: 400 });
    }

    const apiKey = Deno.env.get('GEMINIAPIKEY');
    if (!apiKey) {
      return Response.json({ error: 'API key not configured' }, { status: 500 });
    }

    // ── Cap total input for compression ──
    let workingContent = content;
    if (content.length > MAX_TOTAL_INPUT) {
      console.log(`⚠️ Very large document (${content.length} chars), sampling strategically...`);
      const third = Math.floor(MAX_TOTAL_INPUT / 3);
      const midStart = Math.floor(content.length / 2) - Math.floor(third / 2);
      workingContent =
        content.substring(0, third) +
        '\n\n...[beginning section ends, middle section begins]...\n\n' +
        content.substring(midStart, midStart + third) +
        '\n\n...[middle section ends, final section begins]...\n\n' +
        content.substring(content.length - third);
      console.log(`📐 Sampled down to ${workingContent.length} chars`);
    }

    console.log('🚀 Starting Phase 1 (topics) + Phase 2 (compression) in PARALLEL...');

    // ── PHASE 1: Topic extraction ──
    // Detect multi-doc by markers. If found, extract topics PER DOC in parallel
    // and merge — preserves which topics came from which file.
    const docs = splitMultiDocCorpus(workingContent);
    let topicPromise;

    if (docs.length >= 2) {
      console.log(`📚 Multi-doc detected: ${docs.length} documents — extracting topics per doc in parallel`);
      topicPromise = Promise.all(
        docs.map((doc) =>
          extractTopics(apiKey, TOPIC_PROMPT_PER_DOC(doc.label, sampleForTopicExtraction(doc.body))),
        ),
      ).then((perDocResults) => {
        // Each per-doc call returns a topics[] array. We expect one top-level
        // section per doc (named after the doc), each with their own subtopics.
        // Flatten into one merged tree, preserving doc order.
        const merged = [];
        perDocResults.forEach((arr, idx) => {
          if (!arr || arr.length === 0) {
            // Doc returned nothing — insert a placeholder section so the user
            // still sees which doc was processed.
            merged.push({
              title: docs[idx].label,
              description: 'Topic extraction did not return results for this document.',
              subtopics: [],
            });
            return;
          }
          // Use ALL top-level items the model returned for this doc, but
          // normalize the first one's title to the doc label so the UI groups
          // them clearly.
          arr.forEach((section, sIdx) => {
            if (sIdx === 0) {
              merged.push({ ...section, title: docs[idx].label });
            } else {
              merged.push(section);
            }
          });
        });
        console.log(`✅ Phase 1: Merged ${merged.length} top-level sections from ${docs.length} docs`);
        return merged;
      });
    } else {
      // Single doc — sample then extract
      const topicInputContent = sampleForTopicExtraction(workingContent);
      if (topicInputContent.length < workingContent.length) {
        console.log(`📐 Topic input capped at ${topicInputContent.length} chars (from ${workingContent.length})`);
      }
      topicPromise = extractTopics(apiKey, TOPIC_PROMPT_SINGLE_DOC(topicInputContent)).then((topics) => {
        console.log(`✅ Phase 1: Extracted ${topics.length} top-level sections`);
        return topics;
      });
    }

    // ── PHASE 2: Compression ──
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

      const response = await fetch(`${COMPRESS_MODEL_URL}?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 2500 },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Gemini compression error:', errorText);
        throw new Error(`Gemini API error: ${response.status}`);
      }

      const data = await response.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    })();

    const [topics, compressedContent] = await Promise.all([topicPromise, compressionPromise]);

    if (!compressedContent) {
      return Response.json({ error: 'No compressed content received' }, { status: 500 });
    }

    console.log('✅ Compression successful, output length:', compressedContent.length);
    console.log('✅ Topics extracted:', topics.length);

    return Response.json({
      compressed_content: compressedContent,
      topics,
    });
  } catch (error) {
    console.error('❌ Error compressing document:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});