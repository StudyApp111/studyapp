import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { email } = await req.json();

    // Test 1: asServiceRole list (no filter)
    const allProfiles = await base44.asServiceRole.entities.LearningProfile.list('created_date', 5);
    
    // Test 2: asServiceRole filter by created_by
    const filteredProfiles = await base44.asServiceRole.entities.LearningProfile.filter({ created_by: email });

    // Test 3: asServiceRole list lessons
    const allLessons = await base44.asServiceRole.entities.Lesson.list('-created_date', 3);

    // Test 4: filter lessons
    const filteredLessons = await base44.asServiceRole.entities.Lesson.filter({ created_by: email }, '-created_date', 3);

    return Response.json({
      allProfiles_count: allProfiles.length,
      allProfiles_sample: allProfiles.map(p => ({ id: p.id, created_by: p.created_by, school: p.school, data_school: p.data?.school })),
      filteredProfiles_count: filteredProfiles.length,
      filteredProfiles_sample: filteredProfiles.map(p => ({ id: p.id, created_by: p.created_by, school: p.school, data_school: p.data?.school })),
      allLessons_count: allLessons.length,
      allLessons_sample: allLessons.map(l => ({ id: l.id, created_by: l.created_by, name: l.course_name, data_name: l.data?.course_name })),
      filteredLessons_count: filteredLessons.length,
    });
  } catch (error) {
    return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
});