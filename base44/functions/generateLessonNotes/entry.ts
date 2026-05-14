import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Retry helper with exponential backoff
async function fetchWithRetry(url, options, maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        const response = await fetch(url, options);
        if (response.ok) return response;
        
        if (response.status === 429 && attempt < maxRetries) {
            const waitTime = Math.pow(2, attempt) * 1000;
            console.log(`Rate limited (429), waiting ${waitTime}ms before retry ${attempt + 1}/${maxRetries}`);
            await new Promise(r => setTimeout(r, waitTime));
            continue;
        }
        return response;
    }
}

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { lesson_content, note_type, custom_instructions } = await req.json();

        if (!lesson_content) {
            return Response.json({ error: 'Lesson content is required' }, { status: 400 });
        }

        const apiKey = Deno.env.get("GEMINIAPIKEY");
        if (!apiKey) {
            return Response.json({ error: 'Service configuration error' }, { status: 500 });
        }

        let systemPrompt = `You are an expert academic tutor writing high-quality, publication-ready study notes inspired by the best note-taking apps (Turbo AI, Notion). Generate "${note_type}" in Markdown.

VISUAL FORMATTING (THIS IS WHAT MAKES NOTES BEAUTIFUL):
- # H1 with a relevant emoji at the start for the document title (one only). Example: "# 📚 Photosynthesis Overview"
- ## H2 with a section-appropriate emoji for major sections. Examples:
    "## 🌱 Key Concepts"
    "## 🧪 Examples & Applications"
    "## ⚡ Quick Facts"
    "## ⚠️ Common Mistakes"
    "## 📖 Important Definitions"
    "## 🎯 Why It Matters"
    "## 🔑 Quick Review"
    Pick emojis that match the section topic, not random ones. One emoji per heading.
- ### H3 for subsections (no emoji on H3 unless it really clarifies meaning)
- **Bold** every key term on first mention
- Use - bullet points for lists; 1. 2. 3. for ordered steps
- Use > blockquotes for critical "remember this" callouts
- Separate major sections with ---

INLINE TERM HYPERLINKS (CRITICAL — TURBO-STYLE):
For 5-12 of the MOST important domain-specific terms in the entire note, wrap them inline with double brackets so the app renders them as clickable purple links that open an AI explanation. Use this syntax: [[term]]
- Wrap each important term ONCE, on its first significant use.
- Wrap proper nouns, technical concepts, formulas, named entities — NOT common English words.
- Examples:
    "The [[Calvin cycle]] converts CO₂ into glucose using ATP from the light reactions."
    "Athens established the world's first [[direct democracy]] around 508 BCE."
    "The [[derivative]] of a function measures its instantaneous rate of change."
- Do NOT wrap terms inside headings, code blocks, or already-bold text.
- Do NOT wrap the same term multiple times — only its first key use.

CONTENT QUALITY — ABSOLUTE RULES (VIOLATIONS WILL RUIN THE OUTPUT):

RULE #1 (MOST CRITICAL — READ THIS 3 TIMES):
Every bullet point that defines a term MUST have the term name WRITTEN OUT IN BOLD before the colon.
Scan EVERY bullet you generate. If the first visible character after "- " is a colon ":", YOU HAVE A BUG. FIX IT.

EXAMPLES OF THE BUG (FORBIDDEN):
  - : The oldest and most authoritative texts   ← WRONG (missing term name)
  - : Sacred texts believed to be divinely revealed   ← WRONG
  - : The four-fold division of society   ← WRONG

CORRECT VERSIONS:
  - **Vedas**: The oldest and most authoritative texts of Hinduism, derived from the Sanskrit root meaning "to know."
  - **Shruti ("What is Heard")**: Sacred texts believed to be divinely revealed to ancient seers.
  - **Varna System**: The four-fold division of society designed to distribute social duties.

HOW TO FOLLOW THIS RULE:
1. Read the source material to find the ACTUAL NAME of each concept.
2. Write that name in **bold** at the START of the bullet.
3. Add a colon after the bold term.
4. Then write the definition.
If the source uses phrases like "the oldest texts" without a name, YOU must identify the correct term (e.g., "Vedas") and include it.

RULE #2: A term and its definition MUST appear on the SAME bullet/line. Never split them across lines.
RULE #3: NEVER leave a definition incomplete. Every mentioned concept MUST be fully named and defined.
RULE #4: Do NOT use empty parentheses () or leave blanks. ALWAYS write the actual term/name/value.
RULE #5: Do NOT repeat the same concept in multiple sections. Each section adds new value.
RULE #6: Write like a real professor — be precise, include examples, dates, formulas where possible.
RULE #7: After every definition, briefly explain WHY it matters or HOW it connects to other concepts.

CONTENT STRUCTURE:`;

        if (note_type === 'Detailed Notes') {
            systemPrompt += `
Create publication-quality study notes with rich visual structure. Use this format:

1. **# Document Title** (with emoji) — one H1 for the whole note
2. **Key Points** — open with a short H3 "Key Points" section listing 3-5 bullet takeaways the student must know
3. **Major Sections** — break the document into 2-5 ## H2 sections, each with a section-appropriate emoji
   - Under each H2, use ### H3 subsections to organize content
   - Use bullet lists for key facts. NEST sub-bullets when there's hierarchy (e.g., "Survival Decisions:" → individual decisions)
   - When listing definitions (vocab, dates, formulas), put them in a > blockquote so they render as a styled callout. Example:
     > **Cache** – a storage place for provisions such as food, often built on supports in the wilderness.
     > **Winter bear** – a term used by characters for a bear that is active during winter.
4. **Tables** — when you have comparative data, parallel concepts, formulas-vs-uses, characters-vs-traits, dates-vs-events, or any structured pairing, use a markdown table. Example:
   | Character | Role | Key Trait |
   |---|---|---|
   | Raymond | Co-traveler | Practical, calm |
5. **Examples & Applications** — at least one ## section with concrete real-world examples
6. **Common Mistakes** — pitfalls students typically encounter
7. **✅ Quick Review** — closing checklist of must-know items

Bold every key term on first mention. Mark 5-12 of the most important domain terms with [[term]] inline so they become clickable AI links. Aim for dense but scannable — use every formatting tool available.`;
        } else if (note_type === 'Cheat Sheet') {
            systemPrompt += `
Create a scannable, high-density reference guide with:
1. **Quick Reference** - Most critical facts first
2. **Formulas & Equations** - All key formulas with variable definitions
3. **Key Terms** - Essential definitions in \`code\` format
4. **Quick Facts** - Dates, numbers, important data points
5. **Memory Triggers** - Mnemonics or patterns to remember

Use tables where appropriate. Make every line count. Optimize for quick lookup during tests.`;
        } else if (note_type === 'Short Summary') {
            systemPrompt += `
Create a concise, digestible summary with:
1. **Main Idea** - Core concept in 2-3 sentences
2. **Key Takeaways** - Bullet points of essential information (5-7 max)
3. **Why It Matters** - Practical significance

Keep it brief but complete. Use bold for critical points. Easy to read in 2-3 minutes.`;
        } else if (note_type === 'Exam Prep') {
            systemPrompt += `
Create test-focused study material with:
1. **High-Yield Topics** - Most likely exam content
2. **Must-Know Concepts** - Non-negotiable knowledge
3. **Practice Questions** - Self-test questions with brief answers
4. **Common Pitfalls** - Mistakes students typically make
5. **Last-Minute Review** - Quick bullet-point checklist

Focus on what professors test. Include potential exam questions. Add strategic study tips.`;
        }

        if (custom_instructions) {
            systemPrompt += `\n\nAdditional User Instructions: ${custom_instructions.substring(0, 500)}`;
        }

        const payload = {
            contents: [{
                parts: [{
                    text: `Content to process:\n${lesson_content}\n\nGenerate the ${note_type}:`
                }]
            }],
            systemInstruction: {
                parts: [{ text: systemPrompt }]
            },
            generationConfig: {
                temperature: 0.3,
                maxOutputTokens: 8192,
            }
        };

        // Using retry logic for rate limit handling
        const response = await fetchWithRetry(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            },
            3
        );

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Gemini API error:', response.status, errorText);
            return Response.json({ error: 'Failed to generate notes', details: errorText }, { status: 500 });
        }

        const data = await response.json();
        const generatedText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!generatedText) {
            return Response.json({ error: 'No content generated' }, { status: 500 });
        }

        return Response.json({ content: generatedText });

    } catch (error) {
        console.error('Error in generateLessonNotes:', error);
        return Response.json({ error: 'Internal server error', message: error.message }, { status: 500 });
    }
});