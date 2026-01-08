import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Uses OpenAI Chat Completions to generate exam questions.
// Honors an optional response_json_schema by instructing the model to strictly follow it
// and enforces JSON-only output via response_format.
// NOTE: Requires OPENAI_API_KEY (preferred). Falls back to OpenAI / OPENAI_KEY if present.

Deno.serve(async (req) => {
  console.log('=== generateExam (GPT-5.1) Start ===');
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const prompt = body?.prompt;
    const responseJsonSchema = body?.response_json_schema; // optional

    if (!prompt || typeof prompt !== 'string') {
      return Response.json({ error: 'Prompt is required' }, { status: 400 });
    }

    const apiKey =
      Deno.env.get('OPENAI_API_KEY') ||
      Deno.env.get('OpenAI') ||
      Deno.env.get('OPENAI_KEY');

    if (!apiKey) {
      console.error('Missing OPENAI_API_KEY (or OpenAI/OPENAI_KEY)');
      return Response.json({ error: 'Service configuration error' }, { status: 500 });
    }

    const systemDirectives = [
      'You are an expert assessment designer.',
      'Always return ONLY valid JSON. No markdown, no commentary.',
      'If a JSON schema is provided, the output MUST strictly conform to it (keys, types, and structure).',
      'If schema is not provided, output a JSON object with an "exam_questions" array where each item contains:',
      '{ question_number, question_type, difficulty_index, question_text, options, correct_answer, explanation, assessed_competencies, targeted_misconception }',
    ].join(' ');

    // Build messages; include schema as a final system message (model will be instructed to follow it)
    const messages = [
      { role: 'system', content: systemDirectives },
      { role: 'user', content: prompt },
    ];

    if (responseJsonSchema && typeof responseJsonSchema === 'object') {
      messages.push({
        role: 'system',
        content: `JSON Schema (strict):\n${JSON.stringify(responseJsonSchema)}`,
      });
    }

    // Prepare Chat Completions payload
    const payload = {
      model: 'gpt-5.1',
      messages,
      temperature: 0.2,
      top_p: 0.95,
      response_format: responseJsonSchema && typeof responseJsonSchema === 'object'
        ? {
            type: 'json_schema',
            json_schema: {
              name: 'exam_schema',
              schema: responseJsonSchema,
              strict: true,
            },
          }
        : { type: 'json_object' },
    };

    console.log('Calling OpenAI chat.completions with GPT-5.1...');

    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      console.error('OpenAI error:', resp.status, errText);
      return Response.json({ error: 'Failed to generate content', details: errText }, { status: 500 });
    }

    const data = await resp.json();
    const content = data?.choices?.[0]?.message?.content;

    if (!content) {
      console.error('No content from OpenAI');
      return Response.json({ error: 'No content generated. Please try again.' }, { status: 500 });
    }

    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch (e) {
      console.error('JSON parse failed:', e?.message);
      return Response.json({ error: 'Failed to parse AI response as JSON' }, { status: 500 });
    }

    // Minimal normalization/validation for exam questions
    if (parsed?.exam_questions && Array.isArray(parsed.exam_questions)) {
      parsed.exam_questions = parsed.exam_questions.map((q, idx) => {
        const type = String(q?.question_type || '').toLowerCase();
        // Default options shape per type
        if (type.includes('true') && type.includes('false')) {
          q.options = ['True', 'False'];
        } else if (type.includes('fill') || type.includes('blank') || type.includes('short answer')) {
          q.options = [];
        }
        // Ensure question_number present
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