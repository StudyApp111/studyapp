import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const results = {};

    // Test each entity separately to find which one errors
    try {
      const profiles = await base44.asServiceRole.entities.LearningProfile.list('created_date', 2);
      results.LearningProfile = { count: profiles.length, ok: true };
    } catch (e) {
      results.LearningProfile = { error: e.message, ok: false };
    }

    try {
      const lessons = await base44.asServiceRole.entities.Lesson.list('-created_date', 2);
      results.Lesson = { count: lessons.length, ok: true };
    } catch (e) {
      results.Lesson = { error: e.message, ok: false };
    }

    try {
      const exams = await base44.asServiceRole.entities.Exam.list('-created_date', 2);
      results.Exam = { count: exams.length, ok: true };
    } catch (e) {
      results.Exam = { error: e.message, ok: false };
    }

    try {
      const plans = await base44.asServiceRole.entities.StudyPlan.list('-created_date', 2);
      results.StudyPlan = { count: plans.length, ok: true };
    } catch (e) {
      results.StudyPlan = { error: e.message, ok: false };
    }

    try {
      const assignments = await base44.asServiceRole.entities.GradedAssignment.list('-created_date', 2);
      results.GradedAssignment = { count: assignments.length, ok: true };
    } catch (e) {
      results.GradedAssignment = { error: e.message, ok: false };
    }

    return Response.json(results);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});