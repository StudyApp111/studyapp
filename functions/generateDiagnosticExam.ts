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
      model: 'gemini-flash-latest'
    });

    const prompt = `You are generating a diagnostic exam for ${courseCode} at ${school}.

CRITICAL FIRST STEP - RESEARCH:
Before generating ANY questions, you MUST search for:
1. "${courseCode} ${school} syllabus" OR "${courseCode} syllabus"
2. "${courseCode} exam questions" OR "${courseCode} typical assessments"
3. "${courseCode} course outline" OR "${courseCode} learning outcomes"

Use search results to identify:
- Actual topics covered in this specific course
- How students are assessed (exam format, question types)
- Common difficulty progression
- Key competencies tested

If you cannot find ${school}-specific information, use general ${courseCode} curriculum but note this in output.

────────────────────────────
QUESTION DESIGN RULES

Generate EXACTLY 5 questions that require students to PERFORM the skill, not describe or define it.

Here are extensive examples by subject area:

═══════════════════════════════════════════════════════════
ENGLISH / LITERATURE / HUMANITIES
═══════════════════════════════════════════════════════════

✓ GOOD (Task-Based):
1. "In this passage from 'The Great Gatsby': [200-word excerpt]
   Which literary device is used in the phrase 'her voice is full of money'?
   A. Simile  B. Metaphor  C. Personification  D. Hyperbole"

2. "Read this argument: 'We should ban plastic bags because they harm wildlife.'
   Which logical fallacy is present?
   A. Ad hominem  B. Hasty generalization  C. False cause  D. Slippery slope"

3. "Analyze this thesis statement: 'Shakespeare's Hamlet explores madness.'
   What makes this thesis weak?
   A. Too broad  B. Too specific  C. Not arguable  D. Lacks evidence"

4. "Given this source: [citation]
   Which MLA in-text citation is correct?
   A. (Smith 2020, p. 45)  B. (Smith 45)  C. (Smith, 2020)  D. Smith (45)"

5. "In this poem: [4-line stanza]
   What is the rhyme scheme?
   A. ABAB  B. AABB  C. ABBA  D. ABCB"

6. "This essay claims: 'Social media causes depression in teens.'
   What type of evidence would BEST support this?
   A. Personal anecdote  B. Peer-reviewed study  C. Expert opinion  D. Survey of 10 people"

7. "Identify the tone in: 'Obviously, anyone with half a brain knows...'
   A. Neutral  B. Condescending  C. Enthusiastic  D. Melancholic"

✗ BAD (Definition-Based - DO NOT USE):
- "What is a metaphor?"
- "Define thesis statement"
- "Explain what MLA format is"
- "What does tone mean in literature?"

═══════════════════════════════════════════════════════════
MATH / STATISTICS
═══════════════════════════════════════════════════════════

✓ GOOD (Problem-Solving):
1. "Solve: 3x + 7 = 22
   A. x = 3  B. x = 5  C. x = 7  D. x = 15"

2. "Factor: x² - 5x + 6
   A. (x-2)(x-3)  B. (x+2)(x+3)  C. (x-1)(x-6)  D. Cannot be factored"

3. "If f(x) = 2x² + 3, what is f(4)?
   A. 19  B. 35  C. 11  D. 67"

4. "Find the derivative: f(x) = x³ + 2x
   A. 3x² + 2  B. x² + 2  C. 3x² + 2x  D. x³ + 2"

5. "Data set: {2, 5, 5, 8, 12}. What is the median?
   A. 2  B. 5  C. 6.4  D. 8"

6. "Simplify: (3x²y)(2xy³)
   A. 6x³y⁴  B. 5x³y⁴  C. 6x²y³  D. 6xy"

7. "In triangle ABC, if angle A = 40° and angle B = 60°, what is angle C?
   A. 80°  B. 90°  C. 100°  D. 180°"

8. "Evaluate: ∫(2x + 3)dx
   A. x² + 3x + C  B. 2x² + 3x + C  C. x² + 3  D. 2x + C"

✗ BAD (Conceptual Only - DO NOT USE):
- "What is the quadratic formula?"
- "Define derivative"
- "Explain what a median is"
- "What does integration mean?"

═══════════════════════════════════════════════════════════
SCIENCES (BIOLOGY / CHEMISTRY / PHYSICS)
═══════════════════════════════════════════════════════════

✓ GOOD (Application/Analysis):
1. "A cell has 20% cytosine. What percentage is adenine?
   A. 20%  B. 30%  C. 40%  D. 60%"

2. "Balance this equation: __ H₂ + __ O₂ → __ H₂O
   A. 1, 1, 1  B. 2, 1, 2  C. 2, 2, 2  D. 1, 2, 1"

3. "An object has mass 10kg and acceleration 5m/s². Find force (F=ma).
   A. 2 N  B. 15 N  C. 50 N  D. 0.5 N"

4. "During photosynthesis, this molecule is produced:
   [Diagram showing 6CO₂ + 6H₂O → ? + 6O₂]
   A. C₆H₁₂O₆  B. CO₂  C. ATP  D. NADPH"

5. "A pedigree shows: [diagram]
   What is the inheritance pattern?
   A. Autosomal dominant  B. Autosomal recessive  C. X-linked  D. Mitochondrial"

6. "pH = 3. What is [H⁺] concentration?
   A. 10⁻³ M  B. 10³ M  C. 3 M  D. 0.3 M"

7. "Velocity-time graph: [shows linear increase]
   What does this indicate?
   A. Constant velocity  B. Constant acceleration  C. Decreasing speed  D. No motion"

8. "In this food web: [diagram]
   If rabbits are removed, what happens to grass?
   A. Increases  B. Decreases  C. Stays same  D. Cannot determine"

✗ BAD (Pure Memorization - DO NOT USE):
- "What is photosynthesis?"
- "Define pH"
- "Name the parts of a cell"
- "What is Newton's first law?"

═══════════════════════════════════════════════════════════
COMPUTER SCIENCE / PROGRAMMING
═══════════════════════════════════════════════════════════

✓ GOOD (Code Analysis/Trace):
1. "What does this print?
\`\`\`python
   x = 5
   print(x * 2)
\`\`\`
   A. 5  B. 10  C. 52  D. Error"

2. "After this code runs, what is y?
\`\`\`java
   int y = 0;
   for(int i=0; i<3; i++) {
       y += i;
   }
\`\`\`
   A. 0  B. 3  C. 6  D. 9"

3. "This function call returns:
\`\`\`javascript
   function add(a, b) { return a + b; }
   add(3, '5')
\`\`\`
   A. 8  B. '35'  C. 35  D. Error"

4. "Time complexity of binary search:
   A. O(1)  B. O(log n)  C. O(n)  D. O(n²)"

5. "What's wrong with this SQL?
\`\`\`sql
   SELECT * FROM users WHERE id = 5;
\`\`\`
   A. Missing semicolon  B. Wrong syntax  C. Nothing wrong  D. Should use JOIN"

6. "This recursive function's base case is:
\`\`\`python
   def factorial(n):
       if n == 0:
           return 1
       return n * factorial(n-1)
\`\`\`
   A. n == 0  B. n == 1  C. return 1  D. No base case"

7. "After this, what is arr[1]?
\`\`\`cpp
   int arr[] = {1, 2, 3};
   arr[1] = arr[0] + arr[2];
\`\`\`
   A. 1  B. 2  C. 3  D. 4"

✗ BAD (Definitions - DO NOT USE):
- "What is a variable?"
- "Define recursion"
- "Explain what a loop does"
- "What is object-oriented programming?"

═══════════════════════════════════════════════════════════
BUSINESS / ECONOMICS / FINANCE
═══════════════════════════════════════════════════════════

✓ GOOD (Calculation/Application):
1. "Demand: P = 100 - 2Q. If Q = 20, what is price?
   A. 40  B. 60  C. 80  D. 100"

2. "Revenue = $10,000, Costs = $7,000. What is profit margin?
   A. 30%  B. 43%  C. 70%  D. Cannot calculate"

3. "Investment: $1,000 at 5% annual interest for 2 years (simple). Total value?
   A. $1,050  B. $1,100  C. $1,102.50  D. $1,500"

4. "Company has current ratio = 0.8. This means:
   A. Liquid  B. Illiquid  C. Profitable  D. Bankrupt"

5. "Given this scenario: [mini case about pricing decision]
   Using cost-plus pricing with 20% markup on $50 cost, price should be:
   A. $55  B. $60  C. $70  D. $100"

6. "SWOT Analysis shows high competition. This is:
   A. Strength  B. Weakness  C. Opportunity  D. Threat"

7. "Break-even point: Fixed costs $1,000, Variable cost per unit $5, Price $10
   Units needed to break even:
   A. 100  B. 200  C. 500  D. 1,000"

✗ BAD (Pure Theory - DO NOT USE):
- "Define supply and demand"
- "What is SWOT analysis?"
- "Explain profit margin"
- "What are the 4 P's of marketing?"

═══════════════════════════════════════════════════════════
SOCIAL SCIENCES (PSYCHOLOGY / SOCIOLOGY / HISTORY)
═══════════════════════════════════════════════════════════

✓ GOOD (Analysis/Application):
1. "A study shows correlation = 0.9 between ice cream sales and drowning.
   This proves:
   A. Ice cream causes drowning  B. Strong positive correlation  C. Causation  D. Nothing"

2. "In Pavlov's experiment: Bell → Salivation. The bell is:
   A. Unconditioned stimulus  B. Conditioned stimulus  C. Unconditioned response  D. Neutral stimulus"

3. "Participant observation in a study creates this bias:
   A. Selection  B. Observer effect  C. Confirmation  D. Survivorship"

4. "Primary source for studying WWI:
   A. Modern textbook  B. Historian's analysis  C. Soldier's diary from 1917  D. Documentary film"

5. "Scenario: [description of behavior]
   Which psychological theory best explains this?
   A. Behaviorism  B. Cognitive  C. Psychoanalytic  D. Humanistic"

6. "Survey of 20 college students concludes 'all students love pizza.'
   This commits which error?
   A. Small sample  B. Biased sample  C. Both A and B  D. Neither"

✗ BAD (Memorization - DO NOT USE):
- "Who was Sigmund Freud?"
- "Define correlation"
- "What is participant observation?"
- "Name the types of biases"

════════════════════════════════════════════════════════════

────────────────────────────────
DIFFICULTY PROGRESSION RULES

Q1: EASY (70-80% success rate)
- Basic recall with application
- Single-step problem
- Commonly taught concept

Q2: MODERATE (50-60% success rate)  
- Requires understanding, not just recall
- Two-step problem or simple analysis
- May have one distractor that's tempting

Q3: MODERATE-CHALLENGING (40-50% success rate)
- Multi-step reasoning
- Requires connecting concepts
- Distractors test common misconceptions

Q4: CHALLENGING (25-35% success rate)
- Synthesis of multiple concepts
- Less obvious application
- Tests deeper understanding

Q5: HIGH CHALLENGE (10-20% success rate)
- Edge cases or precision required
- Uncommon scenario or advanced application
- Separates A students from B students
- Should NOT introduce new content, just test mastery depth

────────────────────────────
QUESTION TYPE REQUIREMENTS

Multiple Choice:
- EXACTLY 4 options (A, B, C, D)
- correct_answer = letter ONLY ("A", "B", "C", or "D")
- All distractors should be plausible

Short Answer:
- options = [] (empty array)
- correct_answer = model answer text
- Should have clear evaluation criteria

────────────────────────────
VALIDATION BEFORE OUTPUT

Before generating, verify:
□ Did I search for ${courseCode} at ${school}?
□ Do my questions match topics from research?
□ Does each question require PERFORMING the skill (see examples)?
□ Do questions progress from easy (Q1) to challenging (Q5)?
□ Are options exactly 4 for MCQ, empty for short answer?
□ Is correct_answer the letter only for MCQ, full text for SA?
□ Did I avoid definition/explanation questions?

────────────────────────────
EXPLANATION FORMATTING (CRITICAL)

The "explanation" field is for STUDENTS, not for showing your calculation process.

✓ GOOD Explanations (Clear & Concise):
"Using the kinematic equation d = ½at², we get d = ½(1.6)(5.0)² = 20 m. The other options result from common calculation errors."

✗ BAD Explanations (Shows Your Work - DO NOT DO THIS):
"Let me calculate... d = 0*5 + ½*4*25 = 50... wait that doesn't match, let me recalculate... if a=1.6 then..."

RULES:
- Maximum 2 sentences
- State the correct reasoning directly
- Briefly mention why wrong answers are tempting
- NO "let me calculate" or "wait" or "rechecking" language
- NO showing multiple attempts or corrections
- Write as if teaching a student, not thinking out loud


────────────────────────────
OUTPUT FORMAT

Return ONLY valid JSON (no markdown, no preamble):

{
  "questions": [
    {
      "question_type": "Multiple Choice",
      "question_text": "Question with context if needed",
      "options": ["A. First option", "B. Second option", "C. Third option", "D. Fourth option"],
      "difficulty_index": "Easy",
      "correct_answer": "A",
      "explanation": "Why A is correct. Why B, C, D are wrong.",
      "assessed_competencies": ["Specific competency 1", "Specific competency 2"],
      "targeted_misconception": "Specific common error this tests"
    }
  ]
}

────────────────────────────
Generate 5 authentic ${courseCode} diagnostic questions now.`;

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.5,
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