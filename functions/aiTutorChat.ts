import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { messages, lessonContext, documentContent, specificContext } = await req.json();

    const apiKey = Deno.env.get('API_KEY');
    if (!apiKey) {
      throw new Error('API_KEY not configured');
    }

    // Get document content - prefer explicit documentContent, then lessonContext
    const docContent = documentContent || lessonContext?.extracted_content || '';
    const hasDocument = docContent && docContent.length > 50;

    // Build specific context section
    let specificContextSection = '';
    if (specificContext) {
      if (specificContext.type === 'question' && specificContext.question) {
        specificContextSection = `
SPECIFIC CONTEXT - EXAM QUESTION:
The student needs help with this exam question:
Question: "${specificContext.question.text}"
${specificContext.question.options ? `Options: ${specificContext.question.options.join(', ')}` : ''}
Correct Answer: "${specificContext.question.correct_answer}"
${specificContext.question.explanation ? `Explanation: ${specificContext.question.explanation}` : ''}

Help the student understand WHY the correct answer is correct. Explain the underlying concept.`;
      } else if (specificContext.type === 'flashcard' && specificContext.flashcard) {
        specificContextSection = `
SPECIFIC CONTEXT - FLASHCARD:
The student wants to understand this flashcard better:
Question: "${specificContext.flashcard.question}"
Answer: "${specificContext.flashcard.answer}"
${specificContext.flashcard.topics ? `Topics: ${specificContext.flashcard.topics.join(', ')}` : ''}

Explain this concept in more depth with examples and connections to related ideas.`;
      } else if (specificContext.type === 'document' && specificContext.selectedText) {
        specificContextSection = `
SPECIFIC CONTEXT - SELECTED TEXT:
The student selected this text from their notes and wants it explained:
"${specificContext.selectedText}"

Break this down clearly and explain any technical terms or concepts.`;
      }
    }

    // Build system prompt with lesson context
    const systemPrompt = `You are Polli, an expert AI study tutor in StudyApp. Keep responses SHORT and concise (2-4 sentences unless explaining something complex).

${lessonContext?.course_name ? `Course: ${lessonContext.course_name}` : ''}
${specificContextSection}

${hasDocument ? `
DOCUMENT CONTENT (use this to answer questions):
---
${docContent.substring(0, 12000)}
---

You have access to the student's uploaded document above. When they ask about it:
- Reference specific content from the document
- Quote relevant sections when helpful
- Provide accurate answers based on the actual content
` : 'No document uploaded - provide general help.'}

CAPABILITIES:
- Explain exam questions and why answers are correct
- Help understand flashcard concepts deeply
- Break down complex text selections
- Summarize documents
- Quiz students on the material

RULES:
- Be concise - students have limited attention
- Use bullet points for lists
- If explaining a question, focus on the WHY not just the WHAT
- Be encouraging and supportive
- Give practical examples when helpful`;

    // Prepare messages for Gemini
    const geminiMessages = [
      {
        role: 'user',
        parts: [{ text: systemPrompt }]
      },
      {
        role: 'model',
        parts: [{ text: 'I understand. I\'m ready to help you with your studies!' }]
      }
    ];

    // Add conversation history
    for (const msg of messages) {
      geminiMessages.push({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }]
      });
    }

    // Call Gemini API
    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey
      },
      body: JSON.stringify({
        contents: geminiMessages.slice(2), // Skip system message setup
        systemInstruction: {
          parts: [{ text: systemPrompt }]
        },
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 1024,
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API error: ${errorText}`);
    }

    const data = await response.json();
    const reply = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!reply) {
      throw new Error('No response from Gemini');
    }

    return Response.json({ reply });

  } catch (error) {
    console.error('AI Tutor error:', error);
    return Response.json({ 
      error: error.message || 'Failed to get tutor response'
    }, { status: 500 });
  }
});