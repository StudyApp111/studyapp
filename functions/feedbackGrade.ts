import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Retry helper with exponential backoff
async function fetchWithRetry(url, options, maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        const response = await fetch(url, options);
        if (response.ok) return response;
        
        if (response.status === 429 && attempt < maxRetries) {
            const waitTime = Math.pow(2, attempt) * 1000;
            console.log(`Rate limited (429), waiting ${waitTime}ms before retry ${attempt + 1}/${maxRetries}`);
            await new Promise(r => setTimeout(r, waitTime));
            continue;
        }
        return response;
    }
}

Deno.serve(async (req) => {
    console.log('=== feedbackGrade Function Start ===');
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { prompt, response_json_schema, exam_id, lesson_id, exam_performance_data, curriculum_map, student_grade, course_name, exam_number } = await req.json();
        console.log('Exam ID:', exam_id, 'Lesson ID:', lesson_id, 'Prompt provided:', !!prompt);

        // Build prompt internally if exam data provided directly
        let finalPrompt = prompt;
        
        if (!prompt && exam_performance_data && curriculum_map) {
            // Use provided data directly (more efficient - no extra DB calls)
            const curriculumJson = JSON.stringify(curriculum_map, null, 2);
            const performanceJson = JSON.stringify(exam_performance_data, null, 2);

            // Count data points for confidence calculation
            const totalQuestions = exam_performance_data.length;
            const answeredQuestions = exam_performance_data.filter(q => q.student_answer && q.student_answer !== "No answer provided").length;
            const competenciesCovered = new Set(exam_performance_data.flatMap(q => q.assessed_competencies || [])).size;
            const totalCompetencies = (curriculum_map?.core_competencies || []).length || 1;
            
            finalPrompt = `Expert educator for ${course_name} (grade ${student_grade}). Analyze exam performance using curriculum map to predict grade as if you were a teacher at this school teaching this course.

Input: Grade ${student_grade}, ${course_name}, Exam ${exam_number}/6
Curriculum: ${curriculumJson}
Performance: ${performanceJson}

Data Points Available:
- Questions answered: ${answeredQuestions}/${totalQuestions}
- Competencies assessed: ${competenciesCovered}/${totalCompetencies}

Fields: question_number, question_type, difficulty_index, question_text, options, student_answer, correct_answer, explanation, assessed_competencies[], targeted_misconception, is_correct, ai_grading{score_out_of_10, verdict, rationale, keypoints_hit[], keypoints_missed[]}.

Prediction Algorithm:
1) Per-item: base=0.90(correct) or 0.20. Blend w/ai_grading partial=(score/10). Apply difficulty multipliers: Correct→High×1.05(cap 0.98), Challenging×1.02(cap 0.96), Moderate×1.01(cap 0.92); Incorrect→High×0.90(floor 0.10), Challenging×0.80(floor 0.08), Moderate×0.70(floor 0.05). Misconception penalty -0.05/-0.07/-0.09. Clamp [0.05,0.98].
2) Competency mastery: mean scores per competency from curriculum_map.core_competencies; if none→0.50.
3) Weighted aggregate: parse competency_weightings ("30%"→0.30), normalize, Σ(mastery×weight)×100.
4) Question-type adjust: AvgTypeScore vs curriculum_map.question_formats frequency. If <0.40 & ≥30%→-3 to -6; if ≥0.80 & ≥30%→+0 text -slate-500'}`}>Complete tasks to increase to 95%+ for more accurate predictions</span>

Confidence Calculation (MAX 65% for diagnostic):
- Base confidence = (questions_answered/total_questions * 40) + (competencies_covered/total_competencies * 40) + 20
- CRITICAL: For exam_number=1 (diagnostic), cap confidence at 65%. More data from study tasks needed for higher confidence.
- confidence_level: "Low" (<40%), "Medium" (40-65%)

Mastery Gap Analysis:
- Identify the SINGLE weakest competency based on question performance
- This is the "mastery_gap" - the biggest barrier to grade improvement

JSON Output (exact schema):
- feedback_session_title: "Exam ${exam_number} Performance & Grade Prediction"
- predicted_exam_score_percentage: string with "%" (e.g., "78%") or "Not Calculable"
- prediction_confidence_percentage: number (0-65 for diagnostic)
- confidence_level: "Low"|"Medium"
- mastery_gap: string (the single weakest competency name)
- mastery_gap_description: string (why this is the biggest weakness)
- overall_performance_summary_text: string (1-2 sentences)
- identified_strengths_list: array of strings
- key_areas_for_improvement_list: array of strings`;
        }

        if (!finalPrompt) {
            return Response.json({ error: 'Prompt is required' }, { status: 400 });
        }

        const apiKey = Deno.env.get("GEMINIAPIKEY");
        if (!apiKey) {
            return Response.json({ error: 'Service configuration error' }, { status: 500 });
        }

        const requestBody = {
            contents: [{ parts: [{ text: finalPrompt }] }],
            generationConfig: {
                temperature: 0.2,
                maxOutputTokens: 16384
            }
        };

        if (response_json_schema) {
            requestBody.generationConfig.responseMimeType = "application/json";
            requestBody.generationConfig.responseSchema = response_json_schema;
        }

        console.log('Calling Gemini API with retry logic...');
        const response = await fetchWithRetry(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody)
            },
            3
        );

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Gemini API error:', response.status, errorText);
            return Response.json({ error: 'API error', details: errorText.substring(0, 200) }, { status: 502 });
        }

        const data = await response.json();
        const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text;
        
        if (!generatedText) {
            return Response.json({ error: 'No content generated' }, { status: 500 });
        }

        let parsedResponse;
        if (response_json_schema || !prompt) {
            try {
                parsedResponse = JSON.parse(generatedText);
            } catch (e) {
                console.error('JSON parse error:', e.message);
                return Response.json({ error: 'Failed to parse response' }, { status: 500 });
            }
        } else {
            parsedResponse = { text: generatedText };
        }

        // If exam_id provided, update the exam with the AI feedback
        if (exam_id && parsedResponse.predicted_exam_score_percentage) {
            try {
                const scoreStr = parsedResponse.predicted_exam_score_percentage;
                const scoreNum = parseInt(scoreStr.replace('%', ''));
                
                if (!isNaN(scoreNum) && scoreNum > 0) {
                    // Convert score to letter grade
                    let letterGrade = "F";
                    if (scoreNum >= 90) letterGrade = "A+";
                    else if (scoreNum >= 85) letterGrade = "A";
                    else if (scoreNum >= 80) letterGrade = "A-";
                    else if (scoreNum >= 77) letterGrade = "B+";
                    else if (scoreNum >= 73) letterGrade = "B";
                    else if (scoreNum >= 70) letterGrade = "B-";
                    else if (scoreNum >= 67) letterGrade = "C+";
                    else if (scoreNum >= 63) letterGrade = "C";
                    else if (scoreNum >= 60) letterGrade = "C-";
                    else if (scoreNum >= 50) letterGrade = "D";
                    
                    console.log(`📊 Updating exam ${exam_id} with AI feedback: ${letterGrade} (${scoreNum}%), confidence=${parsedResponse.prediction_confidence_percentage}%`);
                    
                    await base44.entities.Exam.update(exam_id, {
                        total_score: scoreNum,
                        predicted_grade: letterGrade,
                        prediction_confidence: parsedResponse.prediction_confidence_percentage || 45,
                        confidence_level: parsedResponse.confidence_level || 'Low',
                        mastery_gap: parsedResponse.mastery_gap || null,
                        ai_feedback: parsedResponse
                    });
                    
                    // Also update study plan if it exists
                    if (lesson_id) {
                        const plans = await base44.entities.StudyPlan.filter({ lesson_id, status: 'active' });
                        if (plans.length > 0) {
                            const plan = plans[0];
                            await base44.entities.StudyPlan.update(plan.id, {
                                initial_predicted_grade: letterGrade,
                                initial_score: scoreNum,
                                initial_confidence: parsedResponse.prediction_confidence_percentage || 45,
                                current_predicted_grade: letterGrade,
                                current_score: scoreNum,
                                current_confidence: parsedResponse.prediction_confidence_percentage || 45,
                                mastery_gap: parsedResponse.mastery_gap || plan.mastery_gap
                            });
                            console.log(`📊 Study plan updated with AI grade: ${letterGrade}`);
                        }
                    }
                }
            } catch (updateError) {
                console.error('Error updating exam with AI feedback:', updateError);
                // Don't fail the response - just log the error
            }
        }

        console.log('=== feedbackGrade Complete ===');
        return Response.json(parsedResponse);

    } catch (error) {
        console.error('Error:', error.message);
        return Response.json({ error: error.message }, { status: 500 });
    }
});