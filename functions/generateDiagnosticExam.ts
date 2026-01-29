import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // No auth required - this is part of the public onboarding flow
    
    const { subject, school, courseCode } = await req.json();

    if (!subject || !school || !courseCode) {
      return Response.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    // Use Gemini Flash Latest to generate 3 diagnostic questions
    const prompt = `You are an expert educational assessment designer. Generate exactly 3 diagnostic questions for a student studying "${courseCode}" (${subject}) at "${school}".

REQUIREMENTS:
1. Questions must broadly assess key competencies for this course
2. Use real-world context and application-based scenarios
3. Questions should be multiple-choice with 4 options each
4. Difficulty should range from medium to hard to properly assess understanding
5. Each question should target a distinct core competency

OUTPUT FORMAT (strict JSON):
{
  "questions": [
    {
      "question_text": "Clear, concise question text",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correct_answer": "Option A",
      "assessed_competencies": ["Competency 1", "Competency 2"]
    }
  ]
}

Generate the 3 questions now.`;

    const result = await base44.integrations.Core.InvokeLLM({
      prompt,
      model: "gemini-flash-latest",
      add_context_from_internet: true,
      temperature: 0.2,
      max_tokens: 8000,
      response_json_schema: {
        type: "object",
        properties: {
          questions: {
            type: "array",
            items: {
              type: "object",
              properties: {
                question_text: { type: "string" },
                options: { type: "array", items: { type: "string" } },
                correct_answer: { type: "string" },
                assessed_competencies: { type: "array", items: { type: "string" } }
              },
              required: ["question_text", "options", "correct_answer", "assessed_competencies"]
            }
          }
        },
        required: ["questions"]
      }
    });

    return Response.json({
      success: true,
      questions: result.questions || []
    });

  } catch (error) {
    console.error('Error generating diagnostic exam:', error);
    return Response.json({ 
      error: error.message || 'Failed to generate diagnostic exam' 
    }, { status: 500 });
  }
});