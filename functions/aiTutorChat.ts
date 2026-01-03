import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { messages, lessonContext, documentContent } = await req.json();

    const apiKey = Deno.env.get('API_KEY');
    if (!apiKey) {
      throw new Error('API_KEY not configured');
    }

    // Get document content - prefer explicit documentContent, then lessonContext
    const docContent = documentContent || lessonContext?.extracted_content || '';
    const hasDocument = docContent && docContent.length > 50;

    // Build system prompt with lesson context
    const systemPrompt = `You are Polli, an expert AI study tutor in StudyApp. Keep responses SHORT and concise (2-4 sentences unless explaining something complex).

${lessonContext?.course_name ? `Course: ${lessonContext.course_name}` : ''}

${hasDocument ? `
DOCUMENT CONTENT (use this to answer questions):
---
${docContent.substring(0, 15000)}
---

You have access to the student's uploaded document above. When they ask about it:
- Reference specific content from the document
- Quote relevant sections when helpful
- Provide accurate answers based on the actual content
` : 'No document uploaded - provide general help.'}

CAPABILITIES:
- Summarize documents
- Extract key points and concepts
- Answer questions about the content
- Quiz students on the material
- Explain concepts simply

RULES:
- Be concise - students have limited attention
- Use bullet points for lists
- If asked about content not in the document, say so
- Be encouraging and supportive`;

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