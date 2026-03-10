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
        
        console.log(`Starting generation for course ${course.course_name}, content length: ${content.length}`);

        // 1. Compress Document and Extract Topics
        let compressedContent = content.substring(0, 8000);
        let topics = [];
        
        if (content.length > 2000) {
            try {
                console.log("Calling compressDocument...");
                const compRes = await base44.asServiceRole.functions.invoke('compressDocument', { pre_made_course_id: course.id });
                if (compRes.data?.compressed_content) {
                    compressedContent = compRes.data.compressed_content;
                }
                if (compRes.data?.topics) {
                    topics = compRes.data.topics;
                }
            } catch (e) {
                console.error("compressDocument failed:", e);
            }
        }

        // Save compressed content first so curriculumMapping can fetch it without WAF issues
        await entities.PreMadeCourse.update(course.id, {
            compressed_content: compressedContent,
            topics: topics
        });

        // 2. Generate Curriculum Map
        let curriculumMap = {};
        try {
            console.log("Calling curriculumMapping...");
            const cmRes = await base44.asServiceRole.functions.invoke('curriculumMapping', {
                courseName: course.course_name,
                learningProfile: { school: course.institution || "N/A", grade: course.education_level || "N/A" },
                pre_made_course_id: course.id
            });
            if (cmRes.data) {
                curriculumMap = cmRes.data;
            }
        } catch (e) {
            console.error("curriculumMapping failed:", e);
        }

        // 3. Generate Diagnostic Questions
        console.log("Generating diagnostic questions...");
        const aiPrompt = `[Context]
You are an expert assessment designer. Generate a 5-question exam-authentic DIAGNOSTIC worksheet for ${course.course_name}.

Content Summary:
${compressedContent}

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

        // Update PreMadeCourse with all generated data
        await entities.PreMadeCourse.update(course.id, {
            diagnostic_questions_list: questions,
            compressed_content: compressedContent,
            topics: topics,
            curriculum_map: curriculumMap
        });

        console.log("Successfully generated pre-made course content.");
        return Response.json({ success: true });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});