import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { GoogleGenerativeAI } from 'npm:@google/generative-ai';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    const { school, courseCode, questions, userAnswers, studentName, curriculumData } = await req.json();

    if (!school || !courseCode || !questions || !userAnswers) {
      return Response.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    const apiKey = Deno.env.get('GEMINIAPIKEY');
    if (!apiKey) {
      return Response.json({ error: 'API key not configured' }, { status: 500 });
    }

    // Calculate correct/total for context
    const totalQuestions = questions.length;
    let correctCount = 0;
    
    // Build grading context
    const questionContext = questions.map((q, idx) => {
      const userAnswer = userAnswers.find(a => a.question_index === idx);
      const isCorrect = userAnswer?.answer === q.correct_answer;
      if (isCorrect) correctCount++;
      
      return `Q${idx + 1}: ${q.question_text}
Correct: ${q.correct_answer}
User: ${userAnswer?.answer || 'Not answered'}
Result: ${isCorrect ? '✓' : '✗'}
Competencies: ${(q.assessed_competencies || []).join(', ')}`;
    }).join('\n\n');

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-flash-latest',
      generationConfig: {
        responseMimeType: "application/json"
      }
    });

    const curriculumContext = curriculumData ? `
Competency Analysis (use curriculum map):
- Map wrong answers to curriculum competencies
- Weight by assessment_weightings (e.g., "Final Paper - 40%" = higher impact)
- Match preview question to assessment_formats style
- Reference high_yield_focal_points for weak areas

Curriculum Data:
${JSON.stringify(curriculumData, null, 2)}
` : '';

    const prompt = `Expert educator for ${courseCode} at ${school}. Analyze diagnostic performance using curriculum map to predict grade as if you were teaching this course.

Input: ${courseCode}, ${school}, Student: ${studentName || 'Student'}
Curriculum: ${curriculumData ? 'Available (see below)' : 'Not available'}
Performance: ${questionContext}

Data Points:
- Questions answered: ${correctCount}/${totalQuestions}
- Competencies from curriculum: ${curriculumData?.core_competencies?.length || 0}

Prediction Algorithm:
1) Per-item scoring: base=1.0(correct) or 0.0(wrong). Apply difficulty: Easy×1.0, Moderate×1.2, Challenging×1.5.
2) Calculate: (total_weighted_correct / total_weighted_possible) × 100 = percentage.
3) Map to grade: A+(97-100), A(93-96), A-(90-92), B+(87-89), B(83-86), B-(80-82), C+(77-79), C(73-76), C-(70-72), D+(67-69), D(63-66), D-(60-62), F(0-59).
4) Confidence: (answered/total × 50) + 30. Range: [30,80]. Level: <50="Medium", ≥50="High".

${curriculumContext}

Weak Areas Requirements:
- Identify 3 specific topics from WRONG answers
- Align with curriculum competencies if available
- Calculate grade_impact based on assessment weights
- Assign tool: Conceptual→"Teach It Cards", Application→"Practice Questions", Complex→"AI Tutor"

Preview Question:
- Test the #1 weak area (highest impact)
- Match course assessment format if curriculum available
- Different question than diagnostic
- Include complete model answer

Grade Trajectory Rules (CRITICAL - MUST BE REALISTIC):
Based on starting percentage, calculate realistic weekly improvements:
- If 0-30% (F): +8-12% per week max (Week 1→D-, Week 2→D+, Week 3→C)
- If 31-50% (F/D): +10-15% per week (Week 1→D, Week 2→C-, Week 3→C+)
- If 51-70% (D/C): +8-12% per week (Week 1→C+, Week 2→B-, Week 3→B)
- If 71-85% (C/B): +5-10% per week (Week 1→B, Week 2→B+, Week 3→A-)
- If 86-95% (B/A): +3-5% per week (Week 1→A-, Week 2→A, Week 3→A+)
- If 96-100% (A+): Already at peak, focus on maintenance

DO NOT promise A+ from F in 3 weeks. Be realistic based on ACTUAL starting grade.

Personalized Message Rules:
- Line 1: Use ACTUAL calculated percentage (not placeholder)
- Line 2: Reference realistic target based on starting grade (if F→aim for C, not A+)
- Line 3: Encouraging reframe appropriate to their situation

JSON Output (exact schema):
{
  "predicted_grade": "B-",
  "predicted_percentage": 80,
  "confidence_level": "High",
  "strong_areas": ["Specific topic from correct answer", "Another strength"],
  "weak_areas_detailed": [
    {
      "topic": "Specific topic from wrong answer",
      "related_competency": "Curriculum competency name or null",
      "severity": "critical",
      "grade_impact": "20%",
      "assessment_context": "Final Paper - 40% or General exam",
      "recommended_tool": "Teach It Cards",
      "tool_reason": "Short explanation under 15 words",
      "specific_fix": "Subtopic 1, Subtopic 2, Subtopic 3"
    },
    {
      "topic": "Second weak topic",
      "related_competency": "Another competency or null",
      "severity": "high",
      "grade_impact": "18%",
      "assessment_context": "Midterm - 25% or General exam",
      "recommended_tool": "Practice Questions",
      "tool_reason": "Short explanation under 15 words",
      "specific_fix": "Subtopic A, Subtopic B"
    },
    {
      "topic": "Third weak topic",
      "related_competency": "Third competency or null",
      "severity": "high",
      "grade_impact": "15%",
      "assessment_context": "Participation - 20% or General",
      "recommended_tool": "AI Tutor",
      "tool_reason": "Short explanation under 15 words",
      "specific_fix": "Concept X, Concept Y"
    }
  ],
  "preview_question": {
    "topic": "Same as first weak area",
    "related_competency": "Competency name or null",
    "assessment_format": "Short Answer or Multiple Choice",
    "question_text": "New question testing same concept",
    "question_type": "Short Answer",
    "correct_answer": "Complete model answer with explanation",
    "why_this_matters": "Appears in X% of assessments or similar",
    "impact_statement": "Affects Final Paper worth 40% or similar"
  },
  "estimated_study_time_days": 21,
  "study_intensity": "30-45 min/day",
  "grade_trajectory": {
    "current": "B-",
    "week_1_target": "B",
    "week_1_percentage": 85,
    "week_1_description": "Fix theoretical gaps",
    "week_2_target": "B+",
    "week_2_percentage": 88,
    "week_2_description": "Master calculations",
    "week_3_target": "A-",
    "week_3_percentage": 92,
    "week_3_description": "Practice and polish",
    "final_target": "A"
  },
  "personalized_message_line1": "${studentName || 'Student'}, you're starting at 80%.",
  "personalized_message_line2": "Students at your level who use StudyApp reach B+ in 2 weeks.",
  "personalized_message_line3": "You're not behind—you're about to catch up fast.",
  "urgency_timeline": {
    "start_today": "A is realistic",
    "wait_5_days": "B+ is your ceiling",
    "wait_10_days": "You'll stay at B-"
  },
  "top_priority_action": "Start with Core IPE Theory - this is worth 20% of your grade.",
  "toolkit_social_proof": {
    "teach_it_cards": {
      "testimonial": "Took me from C to A in 2 weeks",
      "testimonial_author": "Sarah, UBC",
      "stats": "1,200+ students • +12% avg"
    },
    "practice_questions": {
      "testimonial": "15 min/day and I finally got it",
      "testimonial_author": "Marcus, McGill",
      "stats": "+18% in 2 weeks"
    },
    "ai_tutor": {
      "testimonial": "24/7 help kept me unstuck",
      "testimonial_author": "Priya, UofT",
      "stats": "Instant answers"
    }
  }
}

Critical Rules:
- Use ACTUAL score for percentage (don't default to 80%)
- Grade trajectory MUST be realistic based on starting grade
- Week-to-week improvements follow the ranges above
- If starting F (0-59%), target C or B max (not A+)
- If starting D (60-69%), target B or B+ max
- If starting C (70-79%), target A- or A max
- Personalized message line 2 must reference realistic target
- Severity levels: "critical" (for F/D students), "high", "medium", "low"
- Weak areas must match WRONG answers
- Use curriculum competencies if available

Generate assessment now.`;

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 16000
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
      return Response.json({ error: 'Failed to grade exam', details: parseError.message }, { status: 500 });
    }

    return Response.json({
      success: true,
      ...parsed
    });

  } catch (error) {
    console.error('Error grading diagnostic exam:', error);
    return Response.json({ 
      error: error.message || 'Failed to grade diagnostic exam' 
    }, { status: 500 });
  }
});