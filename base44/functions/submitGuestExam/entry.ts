import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Submits a diagnostic exam for a guest user (unauthenticated)
// Uses service role to bypass RLS since guests can't update entities directly
Deno.serve(async (req) => {
    console.log('=== submitGuestExam Start ===');
    
    try {
        const base44 = createClientFromRequest(req);
        
        const { 
            exam_id, 
            lesson_id,
            questions_with_grading,
            question_feedback,
            time_taken_seconds,
            question_time_laps
        } = await req.json();
        
        if (!exam_id || !lesson_id) {
            return Response.json({ error: 'exam_id and lesson_id are required' }, { status: 400 });
        }
        
        if (!questions_with_grading || !Array.isArray(questions_with_grading)) {
            return Response.json({ error: 'questions_with_grading array is required' }, { status: 400 });
        }
        
        // Use service role for all entity operations
        const entities = base44.asServiceRole.entities;
        
        // Verify the exam exists
        const exams = await entities.Exam.filter({ id: exam_id });
        const exam = exams[0];
        
        if (!exam) {
            return Response.json({ error: 'Exam not found' }, { status: 404 });
        }
        
        // Save the completed exam
        await entities.Exam.update(exam_id, {
            questions: questions_with_grading,
            feedback: question_feedback,
            time_taken_seconds: time_taken_seconds || 0,
            question_time_laps: question_time_laps || [],
            status: "completed",
            completed: true
        });
        
        console.log('✅ Guest exam saved, now getting AI feedback...');
        
        // Get lesson for AI feedback
        const lessons = await entities.Lesson.filter({ id: lesson_id });
        const lesson = lessons[0];
        
        // Prepare exam performance data for feedbackGrade
        const examPerformanceData = questions_with_grading.map(q => ({
            question_number: q.question_number,
            question_type: q.question_type,
            difficulty_index: q.difficulty_index,
            question_text: q.question_text,
            options: q.options || [],
            student_answer: q.user_answer || "No answer provided",
            correct_answer: q.correct_answer,
            explanation: q.explanation,
            assessed_competencies: q.assessed_competencies,
            targeted_misconception: q.targeted_misconception,
            is_correct: q.is_correct,
            ai_grading: q.ai_score_out_of_10 !== undefined ? {
                score_out_of_10: q.ai_score_out_of_10,
                verdict: q.ai_verdict,
                rationale: q.ai_rationale_short,
                keypoints_hit: q.ai_keypoints_hit,
                keypoints_missed: q.ai_keypoints_missed
            } : null
        }));
        
        // Call feedbackGrade to get AI predictions
        let aiGrade = null;
        let aiScore = null;
        let aiConfidence = null;
        let feedbackMasteryGap = null;
        let feedbackData = null;
        
        try {
            const feedbackResp = await base44.asServiceRole.functions.invoke('feedbackGrade', {
                exam_id: exam_id,
                lesson_id: lesson_id,
                exam_performance_data: examPerformanceData,
                curriculum_map: lesson?.curriculum_map,
                student_grade: "N/A",
                course_name: lesson?.course_name,
                exam_number: exam.exam_number
            });
            
            feedbackData = feedbackResp?.data;
            
            if (feedbackData?.predicted_exam_score_percentage) {
                aiScore = parseInt(feedbackData.predicted_exam_score_percentage);
                if (!isNaN(aiScore) && aiScore > 0) {
                    aiGrade = "F";
                    if (aiScore >= 90) aiGrade = "A+";
                    else if (aiScore >= 85) aiGrade = "A";
                    else if (aiScore >= 80) aiGrade = "A-";
                    else if (aiScore >= 77) aiGrade = "B+";
                    else if (aiScore >= 73) aiGrade = "B";
                    else if (aiScore >= 70) aiGrade = "B-";
                    else if (aiScore >= 67) aiGrade = "C+";
                    else if (aiScore >= 63) aiGrade = "C";
                    else if (aiScore >= 60) aiGrade = "C-";
                    else if (aiScore >= 50) aiGrade = "D";
                    
                    aiConfidence = feedbackData.prediction_confidence_percentage || 45;
                    feedbackMasteryGap = feedbackData.mastery_gap || null;
                    
                    console.log(`📊 AI Feedback: Score=${aiScore}%, Grade=${aiGrade}, Confidence=${aiConfidence}`);
                    
                    // Update exam with AI feedback
                    await entities.Exam.update(exam_id, {
                        total_score: aiScore,
                        predicted_grade: aiGrade,
                        prediction_confidence: aiConfidence,
                        confidence_level: feedbackData.confidence_level || 'Low',
                        mastery_gap: feedbackMasteryGap,
                        ai_feedback: feedbackData
                    });
                }
            }
        } catch (feedbackErr) {
            console.warn("AI feedback error (non-blocking):", feedbackErr.message);
        }
        
        // Generate study plan (fire and forget for guests)
        try {
            base44.asServiceRole.functions.invoke('generateStudyPlan', {
                exam_id: exam_id,
                lesson_id: lesson_id
            }).catch(err => console.warn('Study plan generation error:', err.message));
        } catch (e) {
            console.warn('Study plan invoke error:', e.message);
        }
        
        console.log('✅ Guest exam submission complete');
        
        return Response.json({ 
            success: true,
            predicted_grade: aiGrade,
            total_score: aiScore,
            prediction_confidence: aiConfidence,
            mastery_gap: feedbackMasteryGap,
            ai_feedback: feedbackData
        });
        
    } catch (error) {
        console.error('❌ Error submitting guest exam:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});