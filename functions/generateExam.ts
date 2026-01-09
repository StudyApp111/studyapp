import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Uses Google Gemini 2.0 Flash Thinking with minimal thinking for exam generation
// Requires API_KEY environment variable (Google AI API key)

Deno.serve(async (req) => {
  console.log('=== generateExam (Gemini 2.0 Flash Thinking) Start ===');
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const prompt = body?.prompt;
    const responseJsonSchema = body?.response_json_schema;

    if (!prompt || typeof prompt !== 'string') {
      return Response.json({ error: 'Prompt is required' }, { status: 400 });
    }

    const apiKey = Deno.env.get('API_KEY');
    if (!apiKey) {
      console.error('Missing API_KEY (Google AI API key)');
      return Response.json({ error: 'Service configuration error' }, { status: 500 });
    }

    const systemInstruction = [
      'You are an expert assessment designer.',
      'Always return ONLY valid JSON. No markdown, no commentary.',
      'Output must be a JSON object with an "exam_questions" array where each item contains:',
      '{ question_number, question_type, difficulty_index, question_text, options, correct_answer, explanation, assessed_competencies, targeted_misconception }',
    ].join(' ');

    let fullPrompt = prompt;
    if (responseJsonSchema && typeof responseJsonSchema === 'object') {
      fullPrompt += `\n\nJSON Schema (strict):\n${JSON.stringify(responseJsonSchema)}`;
    }

    const payload = {
      contents: [{
        parts: [{
          text: fullPrompt
        }]
      }],
      systemInstruction: {
        parts: [{ text: systemInstruction }]
      },
      generationConfig: {
        temperature: 0.2,
        topP: 0.95,
        topK: 40,
        maxOutputTokens: 8192,
        responseMimeType: "application/json"
      },
      thinkingConfig: {
        thinkingBudget: "low"
      }
    };

    console.log('Calling Gemini 2.0 Flash Thinking with minimal thinking budget...');

    const resp = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-thinking-exp-01-21:generateContent?key=' + apiKey, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      console.error('Gemini error:', resp.status, errText);
      return Response.json({ error: 'Failed to generate content', details: errText }, { status: 500 });
    }

    const data = await resp.json();
    const content = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!content) {
      console.error('No content from Gemini');
      return Response.json({ error: 'No content generated. Please try again.' }, { status: 500 });
    }

    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch (e) {
      console.error('JSON parse failed:', e?.message);
      return Response.json({ error: 'Failed to parse AI response as JSON' }, { status: 500 });
    }

    // Normalize exam questions
    if (parsed?.exam_questions && Array.isArray(parsed.exam_questions)) {
      parsed.exam_questions = parsed.exam_questions.map((q, idx) => {
        const type = String(q?.question_type || '').toLowerCase();
        if (type.includes('true') && type.includes('false')) {
          q.options = ['True', 'False'];
        } else if (type.includes('fill') || type.includes('blank') || type.includes('short answer')) {
          q.options = [];
        }
        if (typeof q.question_number !== 'number') q.question_number = idx + 1;
        return q;
      });
    }

    return Response.json(parsed);
  } catch (error) {
    console.error('CRITICAL ERROR in generateExam:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
});