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

    // Build grading context
    const questionContext = questions.map((q, idx) => {
      const userAnswer = userAnswers.find(a => a.question_index === idx);
      return `Q${idx + 1}: ${q.question_text}
Correct: ${q.correct_answer}
User: ${userAnswer?.answer || 'Not answered'}
Result: ${userAnswer?.answer === q.correct_answer ? '✓' : '✗'}
Competencies: ${(q.assessed_competencies || []).join(', ')}`;
    }).join('\n\n');

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-flash-latest'
    });

    const prompt = `You are an expert educational assessment analyst. A student named "${studentName || 'Student'}" studying "${courseCode}" at "${school}" has completed a diagnostic assessment.

${curriculumData ? `
COURSE CURRICULUM PROFILE:
Use this curriculum profile to inform your analysis and recommendations.

Core Competencies:
${JSON.stringify(curriculumData.core_competencies || [], null, 2)}

Competency Weightings:
${JSON.stringify(curriculumData.competency_weightings || [], null, 2)}

Assessment Formats:
${JSON.stringify(curriculumData.assessment_formats || [], null, 2)}

High Yield Topics:
${JSON.stringify(curriculumData.high_yield_focal_points || [], null, 2)}

Common Misconceptions:
${JSON.stringify(curriculumData.common_misconceptions || [], null, 2)}

IMPORTANT: Use this curriculum data to:
- Identify weak areas that match actual course competencies
- Calculate grade impact based on competency weightings
- Select preview questions that match actual assessment formats
- Reference common misconceptions in your analysis
` : ''}

STUDENT PERFORMANCE:
${questionContext}

ANALYSIS REQUIREMENTS:

1. PREDICTED GRADE CALCULATION
   - Analyze performance across all questions
   - Calculate predicted letter grade (A+, A, A-, B+, B, B-, C+, C, C-, D+, D, F)
   - Calculate predicted percentage (0-100)
   - Consider difficulty weighting of questions

2. WEAK AREAS ANALYSIS (Critical - This drives the entire report)
   - Identify 3-5 specific weak topics (not generic statements)
   - Rank by severity and impact on grade
   - Calculate realistic grade impact for each (as percentage points)
   - Select which learning tool will fix each weakness

3. PREVIEW QUESTION SELECTION
   - Choose THE MOST IMPACTFUL weak topic (highest grade impact)
   - Generate ONE preview question for this topic that:
     * Tests the specific skill they're missing
     * Is authentic to ${courseCode} at ${school}
     * Has a clear correct answer
     * Would appear on their actual exam
   - Provide the correct answer (will be shown after signup)

4. PERSONALIZATION
   - Write a brief, encouraging message about their performance in EXACTLY 3 SHORT LINES
   - Format: Line 1: "[Name], you're starting at [percentage]."
             Line 2: "[Hope statement with specific improvement timeline]."
             Line 3: "[Reframe from 'behind' to 'catching up' or similar positive spin]."
   - Reference their actual quiz performance, not generic statements
   - Create urgency based on realistic exam timeline

LEARNING TOOLS AVAILABLE:
- "Teach It Cards": Student explains concepts back to AI (best for theories, frameworks, conceptual understanding)
- "Practice Questions": Adaptive questions targeting weak spots (best for calculations, problem-solving, application)
- "AI Tutor": 24/7 chat support (best for getting unstuck, clarifying confusion)
- "Note Generator": Creates comprehensive notes (best for organizing information)

TOOL SELECTION LOGIC:
- If weakness is conceptual/theoretical → "Teach It Cards"
- If weakness is calculation/problem-solving → "Practice Questions"  
- If weakness is application/analysis → "Practice Questions"
- If weakness is understanding complex topics → "AI Tutor"
- Default to "Teach It Cards" when uncertain (it's most effective)

OUTPUT FORMAT:
You MUST respond with ONLY valid JSON (no markdown, no backticks, no explanation):

{
  "predicted_grade": "B-",
  "predicted_percentage": 80,
  "confidence_level": "high",
  "strong_areas": [
    "Basic understanding of IPE institutions",
    "Identifying major economic theories"
  ],
  "weak_areas_detailed": [
    {
      "topic": "Core IPE theoretical motivations (realism vs liberalism)",
      "severity": "high",
      "grade_impact": "15%",
      "recommended_tool": "Teach It Cards",
      "tool_reason": "Explaining theoretical differences solidifies conceptual understanding",
      "specific_fix": "Division of Powers, Oakes Test, Charter Application"
    },
    {
      "topic": "IMF lending practice calculations",
      "severity": "high",
      "grade_impact": "12%",
      "recommended_tool": "Practice Questions",
      "tool_reason": "Calculation problems require repetition to master",
      "specific_fix": "Fiscal Federalism calculations, Institutional analysis"
    },
    {
      "topic": "Applying Hegemonic Stability Theory to current geopolitics",
      "severity": "medium",
      "grade_impact": "8%",
      "recommended_tool": "Practice Questions",
      "tool_reason": "Application scenarios need practice with feedback",
      "specific_fix": "Theory application to real-world events"
    }
  ],
  "preview_question": {
    "topic": "Core IPE theoretical motivations (realism vs liberalism)",
    "question_text": "Explain how realist theory would view the IMF's role in the 2008 financial crisis, focusing on state-centric motivations.",
    "question_type": "Short Answer",
    "correct_answer": "Realists would argue that the IMF serves the interests of powerful states (particularly the US) rather than being a neutral institution. In the 2008 crisis, realist theory would emphasize how dominant states used the IMF to protect their own economic interests and maintain hegemonic power, with lending conditions designed to preserve the existing global power structure rather than purely economic recovery.",
    "why_this_matters": "This concept appears in 15% of exam questions and tests your ability to apply theory to real-world scenarios",
    "impact_statement": "This single topic is the difference between B- and B+"
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
    "week_3_target": "A+",
    "week_3_percentage": 95,
    "week_3_description": "Practice and polish",
    "final_target": "A+"
  },
  "personalized_message_line1": "${studentName || 'Student'}, you're starting at 80%.",
  "personalized_message_line2": "Students at your level who use StudyApp reach B+ in 2 weeks.",
  "personalized_message_line3": "You're not behind—you're about to catch up fast.",
  "urgency_timeline": {
    "start_today": "A+ is realistic",
    "wait_5_days": "B+ is your ceiling",
    "wait_10_days": "You'll stay at B-"
  },
  "top_priority_action": "Start with 'Core IPE theoretical motivations' - this single topic is worth 15% of your grade and can be mastered in 3 days with Teach It Cards.",
  "toolkit_social_proof": {
    "teach_it_cards": {
      "testimonial": "This tool took me from C to A in 2 weeks",
      "testimonial_author": "Sarah, UBC",
      "stats": "1,200+ students • Avg improvement: +12%"
    },
    "practice_questions": {
      "testimonial": "15 min/day for a week and I finally understood it",
      "testimonial_author": "Marcus, McGill",
      "stats": "Avg improvement: +18% in 2 weeks"
    },
    "ai_tutor": {
      "testimonial": "24/7 help meant I never stayed stuck",
      "testimonial_author": "Priya, UofT",
      "stats": "Course-specific • Instant answers"
    }
  }
}

VALIDATION CHECKLIST:
□ Predicted grade matches percentage (80% = B-)
□ Weak areas are SPECIFIC (not "needs improvement in general")
□ Grade impacts add up to reasonable total (not exceeding 50%)
□ Preview question is course-authentic and tests the #1 weakness
□ Personalized message is EXACTLY 3 lines, uses student's name
□ Tool recommendations match weakness type
□ Timeline is realistic (not overpromising)
□ Each weak area has "specific_fix" field populated
□ Grade trajectory includes percentages and descriptions for each week
□ Urgency timeline uses actual grade variables
□ Toolkit testimonials are realistic and varied

CRITICAL FORMATTING RULES:
- personalized_message must be split into 3 separate fields (line1, line2, line3)
- Each line should be a complete sentence
- Line 1 MUST include student name and percentage
- Line 2 MUST include specific improvement timeline
- Line 3 MUST reframe positively
- study_intensity must show "30-45 min/day" format
- All grade_impact values must include "%" symbol
- All tool_reason must be single sentence under 15 words
- specific_fix should list 2-3 concrete topics this tool will address

Generate the comprehensive assessment now.`;

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
      return Response.json({ error: 'Failed to grade exam' }, { status: 500 });
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