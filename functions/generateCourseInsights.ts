import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { GoogleGenerativeAI } from 'npm:@google/generative-ai';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { course_name, school, grade } = await req.json();

    if (!course_name) {
      return Response.json({ error: 'Course name is required' }, { status: 400 });
    }

    const apiKey = Deno.env.get('GEMINIAPIKEY');
    if (!apiKey) {
      return Response.json({ error: 'API key not configured' }, { status: 500 });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-flash-lite-latest',
      generationConfig: {
        temperature: 0.7,
        responseMimeType: "application/json"
      }
    });

    const prompt = `You are an expert academic advisor analyzing course difficulty and student performance patterns.

Course: ${course_name}
${school ? `School: ${school}` : ''}
${grade ? `Student Year: ${grade}` : ''}

Generate a JSON response with the following structure:
{
  "predicted_grade": "B-" (realistic starting grade for average student in ${school ? `School: ${school}` : ''} in ${grade ? `Student Year: ${grade}` : ''} taking Course: ${course_name} - choose from: A+, A, A-, B+, B, B-, C+, C, C-, D, F),
  "score_percentage": 78 (numeric score matching the grade),
  "confidence_level": "Medium" (Low/Medium/High),
  "course_difficulty": "Moderate" (Easy/Moderate/Challenging/Very Challenging),
  "key_insights": [
    "Brief struggle point 1 - one sentence max",
    "Brief struggle point 2 - one sentence max"
  ],
  "success_strategies": [
    "Brief actionable tip 1 - max 8 words",
    "Brief actionable tip 2 - max 8 words",
    "Brief actionable tip 3 - max 8 words"
  ],
  "time_commitment": "8-12 hours/week" (realistic estimate)
}

Be realistic based on google searching, direct, and super concise. No fluff.`;

    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();
    
    let insights;
    try {
      insights = JSON.parse(text);
    } catch (parseError) {
      console.error("Failed to parse AI response:", text);
      return Response.json({ error: 'Failed to generate insights' }, { status: 500 });
    }

    return Response.json({ success: true, insights });

  } catch (error) {
    console.error("Error generating course insights:", error);
    return Response.json({ 
      error: error.message || 'Failed to generate insights',
      details: error.toString()
    }, { status: 500 });
  }
});