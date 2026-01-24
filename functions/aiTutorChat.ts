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

    const apiKey = Deno.env.get('GEMINIAPIKEY');
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

    // Check for pending Polly intervention message
    let pollyIntervention = null;
    if (user.polly_pending_message) {
      pollyIntervention = {
        message: user.polly_pending_message,
        type: user.polly_intervention_type
      };
      // Clear the pending message after reading
      await base44.auth.updateMe({
        polly_pending_message: null,
        polly_intervention_type: null
      });
    }

    // Build Polly context from user data
    const pollyContext = user.polly_predicted_grade ? `
POLLY'S CURRENT ANALYSIS:
- Predicted Grade: ${user.polly_predicted_grade} (${user.polly_predicted_score}%)
- Confidence: ${user.polly_confidence}%
- Learning Velocity: ${user.polly_velocity || 'Unknown'}
- Mastery Gap: ${user.polly_mastery_gap || 'Not identified'}
${user.polly_next_action ? `- Recommended Action: ${user.polly_next_action.action_title}` : ''}
` : '';

    // Build system prompt with lesson context
    const courseName = lessonContext?.course_name || 'this course';
    
    const systemPrompt = `You are Polly, a helpful and knowledgeable AI study assistant. Your role is to help students learn effectively and provide clear, accurate information.

Keep responses SHORT and concise (2-4 sentences unless explaining something complex).

${courseName !== 'this course' ? `Course: ${courseName}` : ''}
${pollyContext}
${specificContextSection}

${hasDocument ? `
DOCUMENT CONTENT (the student's uploaded materials):
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
- Provide grade predictions and study advice based on available data

RULES:
- Be concise and clear
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

    // Call Gemini API with retry logic
    const response = await fetchWithRetry('https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent?key=' + apiKey, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
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
    }, 3);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API error: ${errorText}`);
    }

    const data = await response.json();
    const reply = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!reply) {
      throw new Error('No response from Gemini');
    }

    return Response.json({ 
      reply,
      polly_intervention: pollyIntervention
    });

  } catch (error) {
    console.error('AI Tutor error:', error);
    return Response.json({ 
      error: error.message || 'Failed to get tutor response'
    }, { status: 500 });
  }
});