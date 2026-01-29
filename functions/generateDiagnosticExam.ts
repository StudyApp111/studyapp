import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { GoogleGenerativeAI } from 'npm:@google/generative-ai';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    const { subject, school, courseCode } = await req.json();

    if (!subject || !school || !courseCode) {
      return Response.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    const apiKey = Deno.env.get('GEMINIAPIKEY');
    if (!apiKey) {
      return Response.json({ error: 'API key not configured' }, { status: 500 });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-flash-latest'
    });

    const prompt = `You are an expert educational assessment designer. Generate exactly 3 diagnostic questions for a student studying "${courseCode}" (${subject}) at "${school}".

REQUIREMENTS:
1. Questions must broadly assess key competencies for this course
2. Use real-world context and application-based scenarios
3. Questions should be multiple-choice with 4 options each
4. Difficulty should range from medium to hard to properly assess understanding
5. Each question should target a distinct core competency
6. Use Google Search to find accurate, current information about this course

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

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      tools: [{
        googleSearch: {}
      }],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 8000,
        responseMimeType: "application/json",
        responseSchema: {
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
      }
    });

    const response = result.response;
    const text = response.text();
    
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (parseError) {
      console.error("Failed to parse AI response:", text);
      return Response.json({ error: 'Failed to generate questions' }, { status: 500 });
    }

    return Response.json({
      success: true,
      questions: parsed.questions || []
    });

  } catch (error) {
    console.error('Error generating diagnostic exam:', error);
    return Response.json({ 
      error: error.message || 'Failed to generate diagnostic exam' 
    }, { status: 500 });
  }
});