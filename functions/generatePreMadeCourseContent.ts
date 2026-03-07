import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        if (user?.role !== 'admin') {
            return Response.json({ error: 'Unauthorized' }, { status: 403 });
        }

        const { pre_made_course_id } = await req.json();
        const entities = base44.asServiceRole.entities;
        
        const courses = await entities.PreMadeCourse.filter({ id: pre_made_course_id });
        const course = courses[0];
        if (!course) return Response.json({ error: 'Course not found' }, { status: 404 });

        const apiKey = Deno.env.get('GEMINIAPIKEY');
        if (!apiKey) return Response.json({ error: 'GEMINIAPIKEY missing' }, { status: 500 });

        const content = course.extracted_content || course.description || course.course_name;
        const truncatedContent = content.substring(0, 8000);

        const aiPrompt = `[Context]
You are an expert assessment designer. Generate a 5-question exam-authentic DIAGNOSTIC worksheet for ${course.course_name}.

Content Summary:
${truncatedContent}

Internal Rules:
• Difficulty Progression: Q1–2: Moderate, Q3–4: Challenging, Q5: High Challenge
• Multiple Choice → EXACTLY 4 options (A–D)
• True/False → options = ["True","False"]
• Fill in the Blank → ONE blank ____ , options = []
• Short Answer → options = []
• For MCQ: correct_answer = letter only (A, B, C, or D)
• For True/False: correct_answer = "True" or "False"

Generate EXACTLY 5 questions. Return ONE valid JSON object.`;

        const payload = {
            contents: [{ parts: [{ text: aiPrompt }] }],
            generationConfig: {
                temperature: 0.4,
                responseMimeType: "application/json",
                responseSchema: {
                    type: "object",
                    properties: {
                        exam_questions: {
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    question_number: { type: "integer" },
                                    question_type: { type: "string", enum: ["Multiple Choice", "True/False", "Fill in the Blank", "Short Answer"] },
                                    difficulty_index: { type: "string", enum: ["Moderate", "Challenging", "High Challenge"] },
                                    question_text: { type: "string" },
                                    options: { type: "array", items: { type: "string" } },
                                    correct_answer: { type: "string" },
                                    explanation: { type: "string" },
                                    assessed_competencies: { type: "array", items: { type: "string" } },
                                    targeted_misconception: { type: "string" }
                                },
                                required: ["question_number", "question_type", "difficulty_index", "question_text", "options", "correct_answer", "explanation", "assessed_competencies", "targeted_misconception"]
                            }
                        }
                    },
                    required: ["exam_questions"]
                }
            }
        };

        const resp = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`,
            { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }
        );

        if (!resp.ok) throw new Error(`Gemini error: ${resp.status}`);
        const data = await resp.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        const examData = JSON.parse(text);
        const questions = (examData.exam_questions || []).map(q => ({ ...q, user_answer: '' }));

        await entities.PreMadeCourse.update(course.id, {
            diagnostic_questions: questions,
            compressed_content: truncatedContent
        });

        return Response.json({ success: true });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});