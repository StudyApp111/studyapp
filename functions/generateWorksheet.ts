import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    console.log('=== generateWorksheet Function Start ===');
    
    try {
        const base44 = createClientFromRequest(req);
        console.log('✅ Base44 client created');
        
        const user = await base44.auth.me();
        console.log('✅ User authenticated:', user?.email);

        if (!user) {
            console.error('❌ Authentication failed - no user');
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { examNumber, lessonData, learningProfile, contentDescription, curriculumMap, response_json_schema } = await req.json();
        console.log('✅ Request body parsed');
        console.log('📝 Exam number:', examNumber);
        console.log('📝 Content length:', contentDescription?.length);
        console.log('📋 Schema provided:', !!response_json_schema);

        if (!lessonData || !contentDescription) {
            console.error('❌ Missing required data');
            return Response.json({ error: 'Lesson data and content are required' }, { status: 400 });
        }

        const apiKey = Deno.env.get("API_KEY");
        if (!apiKey) {
            console.error('❌ CRITICAL: API_KEY not found in environment');
            return Response.json({ error: 'Service configuration error' }, { status: 500 });
        }
        console.log('✅ API key found');

        // Build the exam generation prompt
        const prompt = examNumber === 1 
        ? `Context
You are an expert assessment designer. Generate a 10-question predictive worksheet for ${lessonData.course_name} that both reflects authentic exam standards and establishes an accurate learning baseline.

This worksheet must stand alone.
Do NOT rely on prior diagnostics.
Ground content in the student's materials and light web search when needed.

────────────────────────────────

[Input Context]

Student Grade Level: ${learningProfile.grade || "N/A"}
Course / Unit Name: ${lessonData.course_name}
School: ${learningProfile.school || "N/A"}

Lesson Content (notes, uploaded material, or student description):
${contentDescription}

Internal Reasoning (Do NOT Output)

1. Scope Lock
- If lesson content specifies a concrete topic or skill (e.g., "factoring", "photosynthesis", "Du Bois double-consciousness"):
  → ALL questions MUST stay strictly within that topic.
- Do NOT add prerequisites, review topics, or adjacent units unless required to execute the task.
- Only broaden scope if the user explicitly requests review or exam prep.

2. Topic Validation (Light Search)
- Use search ONLY to confirm terminology, typical exam phrasing, or standard question styles for this course.
- Do NOT introduce new topics beyond the locked scope.

3. Difficulty Progression
- Q1–3: Moderate Exam-Level
- Q4–7: Challenging Exam-Level
- Q8–10: Challenging → High Challenge (depth, edge cases, reasoning—not new topics)

4. Coverage Design
- 6–7 questions: core skill / primary topic
- 2–3 questions: applications, traps, or conceptual stress tests
- 1–2 twin items: same concept, different reasoning demand

5. Exam Authenticity
- Match tone, rigor, and structure typical of ${learningProfile.school || "the school"} assessments.

────────────────────────────────

QUESTION-TYPE ENFORCEMENT (EXECUTE FIRST)

For EACH question:

1. Choose question_type from:
   - Multiple Choice
   - True/False
   - Fill in the Blank
   - Short Answer
   - Structured Response

2. Apply strict formatting rules:

Multiple Choice:
- EXACTLY four options labeled A, B, C, D.
- MCQ cue phrases allowed.

True/False:
- options = ["True", "False"]
- Single declarative statement only.

Fill in the Blank:
- options = []
- EXACTLY one blank written as ____.
- Blank must be a key term, value, or short phrase.

Short Answer / Structured Response:
- options = []
- Direct prompt requesting a value, explanation, justification, or worked solution.

MCQ cue phrases are FORBIDDEN in non-MCQ questions:
"Which of the following", "Select", "Identify the correct", "Choose", "is/are true about"

If a forbidden cue appears, IMMEDIATELY convert the question to Multiple Choice and regenerate.

This layer overrides all other instructions.

────────────────────────────────

Worksheet Generation (Output Only)

Generate EXACTLY 10 questions.

Each question MUST include:
- question_type
- question_text
- options (or [] where required)
- difficulty_index:
  • Moderate Exam-Level
  • Challenging Exam-Level
  • High Challenge Exam-Level

Each question MUST:
- Test a distinct reasoning demand (no duplicates)
- Use exam-authentic wording
- Stay strictly within the locked topic scope

Subject guidance:
- Mathematics / Sciences: multi-step reasoning, application, interpretation, unit checks
- Humanities / Social Sciences: argument alignment, evidence interpretation, conceptual precision
- Computer Science / Engineering: tracing, correctness, edge cases, applied logic
- Business / Economics: method selection, case reasoning, quantitative interpretation

────────────────────────────────

[Answer Key Requirements]

For EACH question include:
- correct_answer
- explanation (2–3 sentences; instructional and corrective)
- assessed_competencies
- targeted_misconception (or null if none)

Explanations should teach the *reason* behind the answer and how to avoid common mistakes.

────────────────────────────────

Output Format:
Provide your response as a single, valid JSON object with the structure specified.`
        
  /// Subsequent Worksheet Prompt      
        : `Context
You are an expert assessment designer generating the next 10-question adaptive worksheet for ${lessonData.course_name}.
This worksheet should build on prior guidance and focus on the most important skills for this student right now.

────────────────────────────────

Input Context

Student Grade Level: ${learningProfile.grade || "N/A"}
Course / Unit Name: ${lessonData.course_name}

Lesson Content (notes, uploaded material, or student description):
${contentDescription}

Suggested Focus Areas (from prior session):
${JSON.stringify(suggestedFutureSessions || [], null, 2)}

────────────────────────────────

Internal Design Rules (Do NOT Output)

1. Scope Control
- If lesson content specifies a narrow topic or skill, generate ALL questions from that topic only.
- Do NOT introduce adjacent or prerequisite topics unless strictly required.
- Only broaden scope if the user explicitly requests review or exam prep.

2. Question Allocation
- 6–7 questions on the primary focus areas.
- 2–3 questions on application, edge cases, or exam-style traps.
- 1–2 “twin” questions testing the same concept with different reasoning demands.

3. Difficulty Progression
- Start with Moderate Exam-Level.
- Progress to Challenging, then High Challenge by reasoning depth (not topic expansion).

────────────────────────────────

QUESTION-TYPE ENFORCEMENT (MUST EXECUTE FIRST)

For EACH question:

Choose question_type from:
- Multiple Choice
- True/False
- Fill in the Blank
- Short Answer
- Structured Response

Apply strict rules:

Multiple Choice:
- EXACTLY four options labeled A, B, C, D.
- MCQ cue phrases ARE allowed.

True/False:
- options MUST be ["True", "False"] only.
- Stem must be a single declarative statement.

Fill in the Blank:
- options MUST be [].
- Include exactly ONE blank written as ____.

Short Answer / Structured Response:
- options MUST be [].
- Stem must directly request a value, explanation, or worked solution.

MCQ cue phrases are FORBIDDEN in non-MCQ questions:
Which of the following, Select, Choose, Identify the correct, is/are true about

If an MCQ cue appears in a non-MCQ question,
you MUST convert it to Multiple Choice and regenerate.

This rule overrides all other instructions.

────────────────────────────────

Worksheet Generation (Output Only)

Generate EXACTLY 10 questions.

Each question MUST include:
- question_number
- question_type
- question_text (plain text)
- options (A–D for MCQ, otherwise [])
- difficulty_index:
  - Moderate Exam-Level
  - Challenging Exam-Level
  - High Challenge Exam-Level

Subject Guidance:
- Math / Science: multi-step reasoning, application, interpretation, unit checks
- Humanities / Social Sciences: argument alignment, evidence use, conceptual precision
- CS / Engineering: tracing, correctness, edge cases, applied logic
- Business / Economics: method selection, case reasoning, quantitative interpretation

Each question must test a distinct concept or reasoning demand.

────────────────────────────────

Answer Key (Output Only)

For EACH question include:
- correct_answer
- explanation (2–3 sentences; instructional and corrective)
- assessed_competencies (short inferred labels)
- targeted_misconception (or null)

Explanations should teach why the answer is correct and how to avoid common mistakes.

────────────────────────────────

Output Format
Return a single valid JSON object matching the expected schema.
`;

        console.log('📝 Generated prompt length:', prompt.length);

        const requestBody = {
            contents: [{
                parts: [{
                    text: prompt
                }]
            }],
            generationConfig: {
                temperature: 0.2,
                topP: 0.95,
                maxOutputTokens: 65536
            },
            safetySettings: [
                { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_LOW_AND_ABOVE" },
                { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_LOW_AND_ABOVE" },
                { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_LOW_AND_ABOVE" },
                { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_LOW_AND_ABOVE" }
            ]
        };

        if (response_json_schema) {
            requestBody.generationConfig.responseMimeType = "application/json";
            requestBody.generationConfig.responseSchema = response_json_schema;
        }

        console.log('⏳ Calling Gemini API for worksheet generation...');
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody)
            }
        );

        console.log('📥 Gemini API response status:', response.status);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ Gemini API error:', response.status, errorText);
            return Response.json({ 
                error: 'Failed to generate content' 
            }, { status: 500 });
        }

        const data = await response.json();
        console.log('✅ Gemini API response received');
        
        // Check for truncation
        const finishReason = data.candidates?.[0]?.finishReason;
        console.log('📋 Finish reason:', finishReason);
        
        if (finishReason === 'MAX_TOKENS') {
            console.error('❌ Output truncated due to MAX_TOKENS limit');
            return Response.json({ 
                error: 'Response was truncated - output exceeded token limit. Please try again.' 
            }, { status: 500 });
        }
        
        const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text;
        
        if (!generatedText) {
            console.error('❌ No content generated');
            return Response.json({ 
                error: 'No content generated' 
            }, { status: 500 });
        }
        
        console.log('✅ Generated text extracted, length:', generatedText.length);

        if (response_json_schema) {
            try {
                let cleanedText = generatedText.trim();
                if (cleanedText.startsWith('```json')) {
                    cleanedText = cleanedText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
                } else if (cleanedText.startsWith('```')) {
                    cleanedText = cleanedText.replace(/^```\s*/, '').replace(/\s*```$/, '');
                }
                
                const parsedResponse = JSON.parse(cleanedText);
                console.log('✅ JSON parsed successfully');
                console.log('📊 Worksheet questions:', parsedResponse.worksheet_questions?.length || 0);
                
                if (parsedResponse.worksheet_questions) {
                    parsedResponse.worksheet_questions = parsedResponse.worksheet_questions.map(q => {
                        const isMultipleChoice = q.question_type?.toLowerCase().includes('multiple choice') || 
                                               q.question_type?.toLowerCase().includes('mcq');
                        
                        if (isMultipleChoice) {
                            if (!q.options || q.options.length < 2) {
                                q.question_type = "Short Answer";
                                q.options = null;
                            } else if (q.options.length < 4) {
                                while (q.options.length < 4) {
                                    q.options.push(`Option ${String.fromCharCode(65 + q.options.length)}`);
                                }
                            }
                        }
                        return q;
                    });
                }
                
                return Response.json(parsedResponse);
            } catch (parseError) {
                try {
                    let fixedText = generatedText
                        .replace(/\\n/g, ' ')
                        .replace(/\n/g, ' ')
                        .replace(/\r/g, ' ')
                        .replace(/\t/g, ' ')
                        .trim();
                    
                    if (fixedText.startsWith('```')) {
                        fixedText = fixedText.replace(/^```json?\s*/, '').replace(/\s*```$/, '');
                    }
                    
                    const retryParsed = JSON.parse(fixedText);
                    
                    if (retryParsed.worksheet_questions) {
                        retryParsed.worksheet_questions = retryParsed.worksheet_questions.map(q => {
                            const isMultipleChoice = q.question_type?.toLowerCase().includes('multiple choice') || 
                                                   q.question_type?.toLowerCase().includes('mcq');
                            
                            if (isMultipleChoice && (!q.options || q.options.length < 2)) {
                                q.question_type = "Short Answer";
                                q.options = null;
                            }
                            return q;
                        });
                    }
                    
                    return Response.json(retryParsed);
                } catch (retryError) {
                    console.error('❌ Retry parse also failed:', retryError.message);
                    console.error('❌ Raw text snippet:', generatedText.substring(0, 500));
                    
                    // Try to extract partial valid JSON for worksheet_questions
                    try {
                        const questionsMatch = generatedText.match(/"worksheet_questions"\s*:\s*\[[\s\S]*?\}\s*\]/);
                        if (questionsMatch) {
                            const partialJson = `{${questionsMatch[0]}}`;
                            const partialParsed = JSON.parse(partialJson);
                            console.log('✅ Recovered partial JSON with', partialParsed.worksheet_questions?.length, 'questions');
                            return Response.json(partialParsed);
                        }
                    } catch (partialError) {
                        console.error('❌ Partial recovery also failed');
                    }
                    
                    return Response.json({ 
                        error: 'Failed to process response - output may have been truncated' 
                    }, { status: 500 });
                }
            }
        }

        console.log('=== generateWorksheet Function Complete ===');
        return Response.json({ text: generatedText });

    } catch (error) {
        console.error('❌ CRITICAL ERROR in generateWorksheet:', error);
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
        return Response.json({ 
            error: 'Internal server error' 
        }, { status: 500 });
    }
});