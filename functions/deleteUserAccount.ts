import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Delete all user entities
        const [lessons, exams, flashcards, studyPlans, annotations, notes, teachItCards, assignments, courses] = await Promise.all([
            base44.entities.Lesson.list(),
            base44.entities.Exam.list(),
            base44.entities.Flashcard.list(),
            base44.entities.StudyPlan.list(),
            base44.entities.Annotation.list(),
            base44.entities.LessonNote.list(),
            base44.entities.TeachItCard.list(),
            base44.entities.GradedAssignment.list(),
            base44.entities.Course.list()
        ]);
        
        const [learningProfiles, curriculumMaps, pollyChatHistories] = await Promise.all([
            base44.entities.LearningProfile.list(),
            base44.entities.CurriculumMap.list(),
            base44.entities.PollyChatHistory.list()
        ]);

        const deletePromises = [
            ...lessons.map(l => base44.entities.Lesson.delete(l.id)),
            ...exams.map(e => base44.entities.Exam.delete(e.id)),
            ...flashcards.map(f => base44.entities.Flashcard.delete(f.id)),
            ...studyPlans.map(sp => base44.entities.StudyPlan.delete(sp.id)),
            ...annotations.map(a => base44.entities.Annotation.delete(a.id)),
            ...notes.map(n => base44.entities.LessonNote.delete(n.id)),
            ...teachItCards.map(t => base44.entities.TeachItCard.delete(t.id)),
            ...assignments.map(a => base44.entities.GradedAssignment.delete(a.id)),
            ...courses.map(c => base44.entities.Course.delete(c.id)),
            ...learningProfiles.map(lp => base44.entities.LearningProfile.delete(lp.id)),
            ...curriculumMaps.map(cm => base44.entities.CurriculumMap.delete(cm.id)),
            ...pollyChatHistories.map(pc => base44.entities.PollyChatHistory.delete(pc.id))
        ];
        
        await Promise.all(deletePromises);
        
        // Reset ALL user data
        await base44.auth.updateMe({ 
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
            learning_style_answers: null
        });
        
        return Response.json({ success: true });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});