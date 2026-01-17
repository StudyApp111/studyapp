import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204 });
  }
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { messages, lessonContext, documentContent, specificContext } = await req.json();

    const apiKey = Deno.env.get('GEMINI_API_KEY');
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
        const q = specificContext.question;
        const hasUserAnswer = q.user_answer && q.user_answer.trim() !== '';
        
        if (!hasUserAnswer) {
          specificContextSection = `
SPECIFIC CONTEXT - EXAM QUESTION (NOT YET ANSWERED):
The student is working on this question and needs help understanding it:
Question: "${q.text}"
${q.options ? `Options: ${q.options.join(', ')}` : ''}

IMPORTANT: The student has NOT answered yet. Do NOT reveal the correct answer!
- Explain the underlying concept
- Give hints and guidance to help them figure it out
- Help them eliminate wrong options through reasoning
- Do NOT say which answer is correct`;
        } else {
          specificContextSection = `
SPECIFIC CONTEXT - EXAM QUESTION (ANSWERED):
The student answered this question:
Question: "${q.text}"
${q.options ? `Options: ${q.options.join(', ')}` : ''}
Student's Answer: "${q.user_answer}"
Correct Answer: "${q.correct_answer}"
${q.explanation ? `Explanation: ${q.explanation}` : ''}

Help the student understand WHY the correct answer is correct. If they got it wrong, explain their misconception.`;
        }
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
    const systemPrompt = `You are Polly, an expert AI study tutor in StudyApp. Keep responses SHORT and concise (2-4 sentences unless explaining something complex).

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
    const geminiMessages = [];

    // Add conversation history
    for (const msg of messages) {
      geminiMessages.push({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }]
      });
    }

    // Call Gemini API
    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey
      },
      body: JSON.stringify({
        contents: geminiMessages,
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