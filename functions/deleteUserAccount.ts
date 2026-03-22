import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const userEmail = user.email;

        // Use service role so we can reliably list and delete all user data
        const sr = base44.asServiceRole;

        // Helper to safely list entities (returns array even if API returns differently)
        const safeList = async (entity) => {
            try {
                const result = await sr.entities[entity].filter({ created_by: userEmail });
                if (Array.isArray(result)) return result;
                if (result?.data && Array.isArray(result.data)) return result.data;
                return [];
            } catch (e) {
                console.error(`Error listing ${entity}:`, e.message);
                return [];
            }
        };

        // Fetch all user entities in parallel
        const [lessons, exams, flashcards, studyPlans, annotations, notes, teachItCards, assignments, courses] = await Promise.all([
            safeList('Lesson'),
            safeList('Exam'),
            safeList('Flashcard'),
            safeList('StudyPlan'),
            safeList('Annotation'),
            safeList('LessonNote'),
            safeList('TeachItCard'),
            safeList('GradedAssignment'),
            safeList('Course'),
        ]);
        
        const [learningProfiles, curriculumMaps, pollyChatHistories] = await Promise.all([
            safeList('LearningProfile'),
            safeList('CurriculumMap'),
            safeList('PollyChatHistory'),
        ]);

        // Delete all records in parallel
        const deletePromises = [
            ...lessons.map(l => sr.entities.Lesson.delete(l.id)),
            ...exams.map(e => sr.entities.Exam.delete(e.id)),
            ...flashcards.map(f => sr.entities.Flashcard.delete(f.id)),
            ...studyPlans.map(sp => sr.entities.StudyPlan.delete(sp.id)),
            ...annotations.map(a => sr.entities.Annotation.delete(a.id)),
            ...notes.map(n => sr.entities.LessonNote.delete(n.id)),
            ...teachItCards.map(t => sr.entities.TeachItCard.delete(t.id)),
            ...assignments.map(a => sr.entities.GradedAssignment.delete(a.id)),
            ...courses.map(c => sr.entities.Course.delete(c.id)),
            ...learningProfiles.map(lp => sr.entities.LearningProfile.delete(lp.id)),
            ...curriculumMaps.map(cm => sr.entities.CurriculumMap.delete(cm.id)),
            ...pollyChatHistories.map(pc => sr.entities.PollyChatHistory.delete(pc.id)),
        ];
        
        await Promise.allSettled(deletePromises);
        
        // Reset ALL user data fields
        await sr.entities.User.update(user.id, { 
            onboarding_completed: false,
            display_name: null,
            school: null,
            grade: null,
            city: null,
            country: null,
            study_type: null,
            subscription_tier: 'free',
            subscription_status: null,
            subscription_plan_type: null,
            subscription_start_date: null,
            subscription_end_date: null,
            trial_end_date: null,
            stripe_customer_id: null,
            stripe_subscription_id: null,
            has_used_trial: false,
            promo_access_until: null,
            daily_xp: 0,
            total_xp: 0,
            current_streak: 0,
            longest_streak: 0,
            session_count: 0,
            level: 0,
            total_lessons_created: 0,
            total_tasks_used: 0,
            total_flashcard_sets: 0,
            total_teachit_sets: 0,
            total_practice_quizzes: 0,
            total_polly_messages: 0,
            daily_ai_messages_count: 0,
            daily_lessons_count: 0,
            daily_diagnostic_exams_count: 0,
            daily_reset_timestamp: null,
            notifications_enabled: true,
            last_active_date: null,
            learning_style_answers: null,
        });
        
        return Response.json({ success: true, deleted_counts: {
            lessons: lessons.length,
            exams: exams.length,
            flashcards: flashcards.length,
            studyPlans: studyPlans.length,
            annotations: annotations.length,
            notes: notes.length,
            teachItCards: teachItCards.length,
            assignments: assignments.length,
            courses: courses.length,
            learningProfiles: learningProfiles.length,
            curriculumMaps: curriculumMaps.length,
            pollyChatHistories: pollyChatHistories.length,
        }});
    } catch (error) {
        console.error('Delete account error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});