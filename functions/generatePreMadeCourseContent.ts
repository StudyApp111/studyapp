import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { GoogleGenerativeAI } from 'npm:@google/generative-ai';

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
        const genAI = new GoogleGenerativeAI(apiKey);

        const content = course.extracted_content || course.description || course.course_name;
        console.log(`Starting generation for course ${course.course_name}, content length: ${content.length}`);

        // 1. Compress Document and Extract Topics
        let compressedContent = content.substring(0, 8000);
        let topics = [];
        
        if (content.length > 2000) {
            try {
                console.log("Compressing document inline...");
                const MAX_TOTAL_INPUT = 200000;
                let workingContent = content;
                if (content.length > MAX_TOTAL_INPUT) {
                    const third = Math.floor(MAX_TOTAL_INPUT / 3);
                    const midStart = Math.floor(content.length / 2) - Math.floor(third / 2);
                    workingContent = content.substring(0, third) + 
                        "\n\n...[beginning section ends, middle section begins]...\n\n" + 
                        content.substring(midStart, midStart + third) + 
                        "\n\n...[middle section ends, final section begins]...\n\n" + 
                        content.substring(content.length - third);
                }

                const MAX_TOPIC_INPUT = 25000;
                let topicInputContent = workingContent;
                if (workingContent.length > MAX_TOPIC_INPUT) {
                    const halfMax = Math.floor(MAX_TOPIC_INPUT / 2);
                    topicInputContent = workingContent.substring(0, halfMax) + "\n\n...[middle content omitted]...\n\n" + workingContent.substring(workingContent.length - halfMax);
                }

                const topicPrompt = `You are a document structure analyzer. Your task is to extract the HIERARCHICAL structure from this educational document.

CRITICAL: OUTPUT MUST BE A 2-LEVEL HIERARCHY
LEVEL 1 = SECTIONS (the document's major organizational divisions)
LEVEL 2 = TOPICS (the specific concepts discussed WITHIN each section)

DOCUMENT CONTENT:
${topicInputContent}`;

                const topicPromise = fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent?key=' + apiKey, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: topicPrompt }] }],
                        generationConfig: { 
                            temperature: 0.1, 
                            maxOutputTokens: 4000,
                            responseMimeType: "application/json",
                            responseSchema: {
                                type: "object",
                                properties: {
                                    topics: {
                                        type: "array",
                                        items: {
                                            type: "object",
                                            properties: {
                                                title: { type: "string" },
                                                description: { type: "string" },
                                                key_content: { type: "string" },
                                                subtopics: {
                                                    type: "array",
                                                    items: {
                                                        type: "object",
                                                        properties: {
                                                            title: { type: "string" },
                                                            description: { type: "string" },
                                                            key_content: { type: "string" }
                                                        },
                                                        required: ["title", "description"]
                                                    }
                                                }
                                            },
                                            required: ["title", "description"]
                                        }
                                    }
                                },
                                required: ["topics"]
                            }
                        }
                    })
                }).then(async (res) => {
                    if (res.ok) {
                        const data = await res.json();
                        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
                        if (text) return JSON.parse(text).topics || [];
                    }
                    return [];
                }).catch(() => []);

                const compressionPrompt = `You are a document compression engine. Extract and compress the key educational content from this document into a structured summary.

OUTPUT (simple text only, EXACT headings):
KEY TERMS / DEFINITIONS
- Format: Term: definition
THEOREMS / FORMULAS / METHODS
- Format: Name: statement/steps
READING THEMES / ARGUMENTS
- Format: • label — 1 sentence
EXAMPLES TO REUSE IN QUESTIONS
- Format: Example: brief description
EMPHASIZED VS OPTIONAL
Emphasized: items marked important
Optional: items marked optional

RULES:
- Total output MUST be ≤ 2000 characters.
- No extra commentary.

DOCUMENT TO COMPRESS:
${workingContent}`;

                const compressionPromise = fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent?key=' + apiKey, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: compressionPrompt }] }],
                        generationConfig: { temperature: 0.1, maxOutputTokens: 2500 }
                    })
                }).then(async (res) => {
                    if (res.ok) {
                        const data = await res.json();
                        return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
                    }
                    return '';
                }).catch(() => '');

                const [extractedTopics, compContent] = await Promise.all([topicPromise, compressionPromise]);
                if (compContent) compressedContent = compContent;
                if (extractedTopics.length > 0) topics = extractedTopics;
                
            } catch (e) {
                console.error("compressDocument inline failed:", e);
            }
        }

        // Save compressed content first
        await entities.PreMadeCourse.update(course.id, {
            compressed_content: compressedContent,
            topics: topics
        });

        // 2. Generate Curriculum Map Inline
        let curriculumMap = {};
        try {
            console.log("Generating curriculum map inline...");
            const researchModel = genAI.getGenerativeModel({ 
                model: 'gemini-flash-latest', 
                tools: [{ googleSearch: {} }]
            });
            
            const researchPrompt = `Role: Curriculum Analyst
Task: Research and compile a comprehensive curriculum profile for the course defined below. The max length for the curriculum is 2000 characters. 
Input Context:
- Course: ${course.course_name}
- School: ${course.institution || "Not specified"}
- User Notes: ${compressedContent || "None provided"}

Directives:
1. Search Execution: Perform a targeted Google Search for the official course syllabus, outline, or calendar description for [${course.course_name}] at [${course.institution || "a typical university"}]. Look for:
   - Official Learning Outcomes / Core Competencies
   - Assessment methods (weighting, formats)
   - Required texts/readings (specifically authors and titles)

2. Data Synthesis: Compile your findings into a detailed report.

Output a curriculum (max 2000 characters) that includes:
- Core Competencies (what students learn)
- Assessment Structure (how they are graded)
- Key Topics/Focal Points
- Common Misconceptions`;

            const researchResult = await researchModel.generateContent({
                contents: [{ role: 'user', parts: [{ text: researchPrompt }] }],
                generationConfig: { temperature: 0.5 }
            });
            
            const researchText = researchResult.response.text();

            const formattingModel = genAI.getGenerativeModel({ 
                model: 'gemini-flash-lite-latest'
            });

            const response_json_schema = {
                type: "object",
                properties: {
                    core_competencies: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                competency: { type: "string" },
                                description: { type: "string" }
                            },
                            required: ["competency", "description"]
                        }
                    },
                    competency_weightings: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                topic: { type: "string" },
                                weight_percentage: { type: "string" }
                            },
                            required: ["topic", "weight_percentage"]
                        }
                    },
                    assessment_formats: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                type: { type: "string" },
                                frequency: { type: "string" },
                                example_question: { type: "string" },
                                related_resource: { type: "string" }
                            },
                            required: ["type", "frequency", "example_question", "related_resource"]
                        }
                    },
                    high_yield_focal_points: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                concept: { type: "string" },
                                description: { type: "string" },
                                key_figures_or_works: { type: "string" }
                            },
                            required: ["concept", "description", "key_figures_or_works"]
                        }
                    },
                    common_misconceptions: {
                        type: "array",
                        items: { type: "string" }
                    }
                },
                required: ["core_competencies", "competency_weightings", "assessment_formats", "high_yield_focal_points", "common_misconceptions"]
            };

            const formatPrompt = `Role: Data Formatter
Task: Convert the provided Curriculum Research data into a specific JSON format.
Input Data:
${researchText}

Output: JSON ONLY.`;

            const formatResult = await formattingModel.generateContent({
                contents: [{ role: 'user', parts: [{ text: formatPrompt }] }],
                generationConfig: {
                    temperature: 0.2,
                    responseMimeType: "application/json",
                    responseSchema: response_json_schema
                }
            });

            curriculumMap = JSON.parse(formatResult.response.text());
        } catch (e) {
            console.error("curriculumMapping inline failed:", e);
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