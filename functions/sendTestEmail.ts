import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        // Verify admin access
        const user = await base44.auth.me();
        if (!user || user.email !== 'kartikeya2159@gmail.com') {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { recipient, subject, body } = await req.json();

        if (!recipient || !subject || !body) {
            return Response.json({ error: 'Recipient, subject, and body are required' }, { status: 400 });
        }

        const resendApiKey = Deno.env.get("RESEND_API_KEY");
        if (!resendApiKey) {
            return Response.json({ error: 'Resend API key not configured' }, { status: 500 });
        }

        // Get the target user to personalize the email
        const targetUsers = await base44.asServiceRole.entities.User.filter({ email: recipient });
        
        if (targetUsers.length === 0) {
            return Response.json({ error: 'User not found' }, { status: 404 });
        }

        const targetUser = targetUsers[0];
        
        // Helper function to get comprehensive user data for email personalization
        async function getUserEmailData(targetUser) {
            const data = {
                name: targetUser.full_name || 'there',
                email: targetUser.email,
                school: 'your school',
                grade: 'your grade',
                level: targetUser.level || 1,
                total_points: targetUser.total_points || 0,
                current_streak: targetUser.current_streak || 0,
                questions_completed: targetUser.questions_completed || 0,
                
                // First lesson data
                first_lesson_name: 'N/A',
                first_lesson_date: 'N/A',
                first_predicted_grade: 'N/A',
                first_predicted_percentage: 'N/A',
                first_weak_area_count: 0,
                first_task_count: 0,
                first_time_spent_minutes: 0,
                
                // Current/latest lesson data
                latest_lesson_name: 'N/A',
                latest_predicted_grade: 'N/A',
                latest_predicted_percentage: 'N/A',
                
                // Overall stats
                total_lessons: 0,
                total_exams_completed: 0,
                total_time_spent_minutes: 0,
                
                // Grade progression
                grade_improvement: 'N/A',
                all_predicted_grades: 'N/A'
            };

            // Get learning profile
            if (targetUser.learning_profile_id) {
                const profiles = await base44.asServiceRole.entities.LearningProfile.filter({
                    id: targetUser.learning_profile_id
                });
                if (profiles.length > 0) {
                    data.school = profiles[0].school || 'your school';
                    data.grade = profiles[0].grade || 'your grade';
                }
            }

            // Get all lessons for this user
            const allLessons = await base44.asServiceRole.entities.Lesson.list();
            const userLessons = allLessons.filter(l => l.created_by === targetUser.email);
            
            if (userLessons.length === 0) {
                return data;
            }

            // Sort lessons by creation date
            userLessons.sort((a, b) => new Date(a.created_date) - new Date(b.created_date));
            
            data.total_lessons = userLessons.length;
            const firstLesson = userLessons[0];
            const latestLesson = userLessons[userLessons.length - 1];

            // Calculate total time spent across all lessons
            let totalSeconds = 0;
            for (const lesson of userLessons) {
                totalSeconds += lesson.total_study_time_seconds || 0;
            }
            data.total_time_spent_minutes = Math.round(totalSeconds / 60);

            // Process FIRST lesson
            if (firstLesson) {
                data.first_lesson_name = firstLesson.course_name || 'N/A';
                data.first_lesson_date = new Date(firstLesson.created_date).toLocaleDateString();
                data.first_time_spent_minutes = Math.round((firstLesson.total_study_time_seconds || 0) / 60);

                // Get all exams for first lesson
                const allExams = await base44.asServiceRole.entities.Exam.list();
                const firstLessonExams = allExams.filter(e => e.lesson_id === firstLesson.id);
                
                if (firstLessonExams.length > 0) {
                    firstLessonExams.sort((a, b) => new Date(a.created_date) - new Date(b.created_date));
                    const firstExam = firstLessonExams[0];
                    
                    data.first_predicted_grade = firstExam.predicted_grade || 'N/A';
                    data.first_predicted_percentage = firstExam.total_score ? Math.round(firstExam.total_score) : 'N/A';
                }

                // Get first study plan
                const allStudyPlans = await base44.asServiceRole.entities.StudyPlan.list();
                const firstLessonPlans = allStudyPlans.filter(p => p.lesson_id === firstLesson.id);
                
                if (firstLessonPlans.length > 0) {
                    firstLessonPlans.sort((a, b) => new Date(a.created_date) - new Date(b.created_date));
                    const firstPlan = firstLessonPlans[0];
                    
                    data.first_weak_area_count = firstPlan.weak_competencies?.length || 0;
                    data.first_task_count = firstPlan.tasks?.length || 0;
                }
            }

            // Process LATEST lesson (if different from first)
            if (latestLesson && latestLesson.id !== firstLesson.id) {
                data.latest_lesson_name = latestLesson.course_name || 'N/A';

                const allExams = await base44.asServiceRole.entities.Exam.list();
                const latestLessonExams = allExams.filter(e => e.lesson_id === latestLesson.id);
                
                if (latestLessonExams.length > 0) {
                    latestLessonExams.sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
                    const latestExam = latestLessonExams[0];
                    
                    data.latest_predicted_grade = latestExam.predicted_grade || 'N/A';
                    data.latest_predicted_percentage = latestExam.total_score ? Math.round(latestExam.total_score) : 'N/A';
                }
            } else {
                // Latest is same as first
                data.latest_lesson_name = data.first_lesson_name;
                data.latest_predicted_grade = data.first_predicted_grade;
                data.latest_predicted_percentage = data.first_predicted_percentage;
            }

            // Calculate grade improvement
            if (data.first_predicted_percentage !== 'N/A' && data.latest_predicted_percentage !== 'N/A') {
                const improvement = data.latest_predicted_percentage - data.first_predicted_percentage;
                if (improvement > 0) {
                    data.grade_improvement = `+${improvement}%`;
                } else if (improvement < 0) {
                    data.grade_improvement = `${improvement}%`;
                } else {
                    data.grade_improvement = 'No change';
                }
            }

            // Get all exam grades for progression tracking
            const allExams = await base44.asServiceRole.entities.Exam.list();
            const userExams = allExams.filter(e => {
                const lessonIds = userLessons.map(l => l.id);
                return lessonIds.includes(e.lesson_id) && e.completed;
            });
            
            data.total_exams_completed = userExams.length;

            if (userExams.length > 0) {
                userExams.sort((a, b) => new Date(a.created_date) - new Date(b.created_date));
                const grades = userExams
                    .filter(e => e.predicted_grade)
                    .map(e => e.predicted_grade);
                data.all_predicted_grades = grades.join(' → ') || 'N/A';
            }

            return data;
        }
        
        const userData = await getUserEmailData(targetUser);

        // Replace all dynamic fields
        let personalizedBody = body
            .replace(/\{\{name\}\}/g, userData.name)
            .replace(/\{\{email\}\}/g, userData.email)
            .replace(/\{\{school\}\}/g, userData.school)
            .replace(/\{\{grade\}\}/g, userData.grade)
            .replace(/\{\{level\}\}/g, userData.level)
            .replace(/\{\{total_points\}\}/g, userData.total_points)
            .replace(/\{\{current_streak\}\}/g, userData.current_streak)
            .replace(/\{\{questions_completed\}\}/g, userData.questions_completed)
            .replace(/\{\{first_lesson_name\}\}/g, userData.first_lesson_name)
            .replace(/\{\{first_lesson_date\}\}/g, userData.first_lesson_date)
            .replace(/\{\{first_predicted_grade\}\}/g, userData.first_predicted_grade)
            .replace(/\{\{first_predicted_percentage\}\}/g, userData.first_predicted_percentage)
            .replace(/\{\{first_weak_area_count\}\}/g, userData.first_weak_area_count)
            .replace(/\{\{first_task_count\}\}/g, userData.first_task_count)
            .replace(/\{\{first_time_spent_minutes\}\}/g, userData.first_time_spent_minutes)
            .replace(/\{\{latest_lesson_name\}\}/g, userData.latest_lesson_name)
            .replace(/\{\{latest_predicted_grade\}\}/g, userData.latest_predicted_grade)
            .replace(/\{\{latest_predicted_percentage\}\}/g, userData.latest_predicted_percentage)
            .replace(/\{\{total_lessons\}\}/g, userData.total_lessons)
            .replace(/\{\{total_exams_completed\}\}/g, userData.total_exams_completed)
            .replace(/\{\{total_time_spent_minutes\}\}/g, userData.total_time_spent_minutes)
            .replace(/\{\{grade_improvement\}\}/g, userData.grade_improvement)
            .replace(/\{\{all_predicted_grades\}\}/g, userData.all_predicted_grades);

        // Send via Resend API
        const resendResponse = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${resendApiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                from: 'StudyApp.AI <updates@updates.studyappai.com>',
                reply_to: 'info@studyappai.com',
                to: recipient,
                subject: subject,
                html: `<style>
                    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 15px; line-height: 1.6; color: #000; }
                    p { margin: 0 0 15px 0; }
                    h1 { font-size: 2em; font-weight: normal; margin: 0.67em 0; }
                    h2 { font-size: 1.5em; font-weight: normal; margin: 0.75em 0; }
                    h3 { font-size: 1.17em; font-weight: normal; margin: 0.83em 0; }
                    h4, h5, h6 { font-weight: normal; margin: 1em 0; }
                    .ql-size-small { font-size: 0.75em; }
                    .ql-size-large { font-size: 1.5em; }
                    .ql-size-huge { font-size: 2.5em; }
                </style>${personalizedBody}`
            })
        });

        if (!resendResponse.ok) {
            const errorText = await resendResponse.text();
            throw new Error(`Resend API error: ${errorText}`);
        }

        return Response.json({ 
            success: true,
            message: `Test email sent to ${recipient}`
        });
    } catch (error) {
        console.error('Test email error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});