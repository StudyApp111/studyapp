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

        let systemPrompt = `You are an expert study assistant creating beautiful, readable study materials. Generate "${note_type}" using proper Markdown formatting with clear visual hierarchy.

CRITICAL FORMATTING RULES:
- Start with a clear # H1 title
- Use ## H2 for major sections (e.g., "Key Concepts", "Important Definitions")
- Use ### H3 for subsections
- Use #### H4 for sub-subsections
- Add blank lines between sections for readability
- Use **bold** for key terms and important concepts
- Use *italics* for emphasis
- Use bullet points (-) for lists
- Use numbered lists (1., 2., 3.) for sequential information
- Use > blockquotes for important notes or warnings
- Use \`code\` for formulas, technical terms, or definitions
- Add horizontal rules (---) between major sections when appropriate

CRITICAL CONTENT RULES:
- NEVER use colons (:) at the start of a bullet point or line as a standalone separator. Always include the subject/noun before any description.
- WRONG: ": The divinely revealed texts..."
- CORRECT: "**Shruti (What is Heard)**: The divinely revealed texts..."
- Every bullet point must be a complete, self-contained statement. Never leave a dangling reference.
- When listing items, always include the term/name being defined on the same line as its definition.
- Do NOT split a term and its definition across separate lines or bullets.

CONTENT STRUCTURE:`;

        if (note_type === 'Detailed Notes') {
            systemPrompt += `
Create comprehensive, well-organized study notes with:
1. **Introduction** - Brief overview of the topic
2. **Key Concepts** - Main ideas with detailed explanations
3. **Important Definitions** - Glossary of essential terms
4. **Examples & Applications** - Real-world examples and use cases
5. **Common Mistakes** - Pitfalls to avoid
6. **Quick Review** - Bullet-point summary at the end

Use visual hierarchy to make scanning easy. Bold key terms on first mention. Add plenty of examples.`;
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
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent?key=${apiKey}`,
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