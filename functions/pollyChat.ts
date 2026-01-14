import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

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

    const docContent = documentContent || lessonContext?.extracted_content || '';
    const hasDocument = docContent && docContent.length > 50;

    let specificContextSection = '';
    if (specificContext) {
      if (specificContext.type === 'question' && specificContext.question) {
        const q = specificContext.question;
        const hasUserAnswer = q.user_answer && q.user_answer.trim() !== '';
        
        if (!hasUserAnswer) {
          specificContextSection = `
SPECIFIC CONTEXT - EXAM QUESTION (NOT YET ANSWERED):
Question: "${q.text}"
${q.options ? `Options: ${q.options.join(', ')}` : ''}

IMPORTANT: Do NOT reveal the correct answer! Give hints and guidance only.`;
        } else {
          specificContextSection = `
SPECIFIC CONTEXT - EXAM QUESTION (ANSWERED):
Question: "${q.text}"
${q.options ? `Options: ${q.options.join(', ')}` : ''}
Student's Answer: "${q.user_answer}"
Correct Answer: "${q.correct_answer}"
${q.explanation ? `Explanation: ${q.explanation}` : ''}

Help explain WHY the correct answer is correct.`;
        }
      } else if (specificContext.type === 'flashcard' && specificContext.flashcard) {
        specificContextSection = `
SPECIFIC CONTEXT - FLASHCARD:
Question: "${specificContext.flashcard.question}"
Answer: "${specificContext.flashcard.answer}"
${specificContext.flashcard.topics ? `Topics: ${specificContext.flashcard.topics.join(', ')}` : ''}

Explain this concept in more depth.`;
      } else if (specificContext.type === 'document' && specificContext.selectedText) {
        specificContextSection = `
SPECIFIC CONTEXT - SELECTED TEXT:
"${specificContext.selectedText}"

Break this down clearly.`;
      }
    }

    const systemPrompt = `You are Polly, an expert AI study tutor. Keep responses SHORT and concise (2-4 sentences unless explaining something complex).

${lessonContext?.course_name ? `Course: ${lessonContext.course_name}` : ''}
${specificContextSection}

${hasDocument ? `
DOCUMENT CONTENT:
---
${docContent.substring(0, 12000)}
---
Reference specific content from the document when answering.
` : 'No document uploaded - provide general help.'}

RULES:
- Be concise
- Use bullet points for lists
- Be encouraging and supportive`;

    const geminiMessages = [];
    for (const msg of messages) {
      geminiMessages.push({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }]
      });
    }

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
    console.error('Polly error:', error);
    return Response.json({ 
      error: error.message || 'Failed to get response'
    }, { status: 500 });
  }
});