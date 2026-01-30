import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { GoogleGenerativeAI } from 'npm:@google/generative-ai';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    const { school, courseCode } = await req.json();

    if (!school || !courseCode) {
      return Response.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    const apiKey = Deno.env.get('GEMINIAPIKEY');
    if (!apiKey) {
      return Response.json({ error: 'API key not configured' }, { status: 500 });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-2.0-flash'
    });

    const prompt = `You are an expert educational assessment designer. Generate exactly 3 diagnostic questions for a student studying "${courseCode}" at "${school}".

REQUIREMENTS:
1. Questions must broadly assess key competencies for this course
2. Use real-world context and application-based scenarios
3. Questions should be multiple-choice with 4 options each
4. Difficulty should range from medium to hard to properly assess understanding
5. Each question should target a distinct core competency

You MUST respond with ONLY valid JSON in this exact format (no markdown, no explanation):
{
  "questions": [
    {
      "question_text": "Clear, concise question text",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correct_answer": "Option A",
      "assessed_competencies": ["Competency 1", "Competency 2"]
    },
    {
      "question_text": "Second question text",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correct_answer": "Option B",
      "assessed_competencies": ["Competency 3"]
    },
    {
      "question_text": "Third question text",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correct_answer": "Option C",
      "assessed_competencies": ["Competency 4"]
    }
  ]
}

Generate the 3 questions now.`;

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 4000
      }
    });

    const response = result.response;
    const text = response.text();
    
    // Clean up the response - remove markdown code blocks if present
    let cleanedText = text.trim();
    if (cleanedText.startsWith('```json')) {
      cleanedText = cleanedText.slice(7);
    } else if (cleanedText.startsWith('```')) {
      cleanedText = cleanedText.slice(3);
    }
    if (cleanedText.endsWith('```')) {
      cleanedText = cleanedText.slice(0, -3);
    }
    cleanedText = cleanedText.trim();
    
    let parsed;
    try {
      parsed = JSON.parse(cleanedText);
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