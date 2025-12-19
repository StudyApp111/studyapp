import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { messages, lessonContext } = await req.json();

    const apiKey = Deno.env.get('API_KEY');
    if (!apiKey) {
      throw new Error('API_KEY not configured');
    }

    // Build system prompt with lesson context
    const systemPrompt = `You are an expert AI tutor helping a student with their coursework. You have access to their course materials and notes.

${lessonContext ? `
COURSE CONTEXT:
Course: ${lessonContext.course_name}
Materials: ${lessonContext.extracted_content || 'No materials available'}

Use this context to provide relevant, accurate answers to the student's questions.
` : ''}

Your role:
- Answer questions clearly and concisely
- Explain concepts step-by-step when needed
- Encourage critical thinking
- Provide examples to illustrate concepts
- Be patient and supportive
- If you don't know something, admit it honestly`;

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
    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent', {
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
          maxOutputTokens: 2048,
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