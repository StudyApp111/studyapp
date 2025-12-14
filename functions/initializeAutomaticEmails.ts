import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

const emailTemplates = [
  {
    name: "Welcome Email",
    trigger_type: "onboarding_completed",
    subject: "Welcome to StudyApp",
    body: `Hi {{name}},

Thanks for signing up for StudyApp. We're glad you're here.

StudyApp exists because most students work hard but study without clarity. They don't know what matters, what to fix, or whether they're actually improving.

This system is built to change that.

There's nothing you need to prove right now. All we ask is that you use the platform honestly. Answer questions the way you truly think. That's how the intelligence adapts to you.

If anything feels unclear, reply to this email. It goes straight to our team.

When you're ready, start your first lesson. Everything builds from there.

The StudyApp Team

→ Start your first lesson at https://app.studyapp.ai`,
    enabled: false
  },
  {
    name: "Grade Ready",
    trigger_type: "worksheet_completed",
    subject: "Your grade is taking shape",
    body: `Hi {{name}},

Your latest worksheet has been analyzed.

If the exam were today, your predicted score would be:
{{predicted_grade}}

This is not a final result. It's a direction.

Some students stop here and hope things improve on their own. Others look at what's holding the number back and fix it deliberately.

That choice matters.

→ See what's affecting your grade at https://app.studyapp.ai

The StudyApp Team`,
    enabled: false
  },
  {
    name: "Assignment Graded",
    trigger_type: "assignment_graded",
    subject: "Your assignment has been graded",
    body: `Hi {{name}},

Your assignment has been reviewed.

Beyond the score, the system identified the exact reasoning errors costing you marks. These are the same mistakes exams repeatedly punish when they go unnoticed.

You don't have to repeat them.

→ Review your feedback at https://app.studyapp.ai

The StudyApp Team`,
    enabled: false
  },
  {
    name: "Weekly Progress Report",
    trigger_type: "weekly_report",
    subject: "Your weekly progress",
    body: `Hi {{name}},

Here's what changed this week:

Worksheets completed: {{worksheet_count}}
Average score: {{average_score}}%
Predicted grade change: {{grade_delta}}

This is what progress actually looks like. Not hours studied. Not intentions. Measurable movement.

Next week compounds this one.

→ View full report at https://app.studyapp.ai

The StudyApp Team`,
    enabled: false
  },
  {
    name: "Lesson Reminder",
    trigger_type: "incomplete_lesson",
    subject: "You left something unfinished",
    body: `Hi {{name}},

You started a lesson but didn't finish it.

The unfinished section targets a weakness that shows up often in grading. Skipping it has an outsized cost. Finishing it has outsized impact.

This is leverage, not busywork.

→ Finish the lesson at https://app.studyapp.ai

The StudyApp Team`,
    enabled: false
  },
  {
    name: "Personalized Tips",
    trigger_type: "pattern_detected",
    subject: "One pattern is costing you marks",
    body: `Hi {{name}},

The system noticed a pattern.

When questions involve {{weak_concept}}, your accuracy drops. Not due to lack of knowledge, but due to how you approach them.

Most students never see this. You can fix it now.

Next time, do this instead:
{{actionable_tip}}

→ Apply this insight at https://app.studyapp.ai

The StudyApp Team`,
    enabled: false
  }
];

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        // Verify admin access
        const user = await base44.auth.me();
        if (!user || user.email !== 'kartikeya2159@gmail.com') {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Check if templates already exist
        const existing = await base44.asServiceRole.entities.AutomaticEmail.list();
        
        if (existing.length > 0) {
            return Response.json({ 
                success: true, 
                message: 'Templates already initialized',
                count: existing.length 
            });
        }

        // Create all templates
        const created = [];
        for (const template of emailTemplates) {
            const result = await base44.asServiceRole.entities.AutomaticEmail.create(template);
            created.push(result);
        }

        return Response.json({ 
            success: true, 
            message: 'Email templates initialized',
            count: created.length 
        });
    } catch (error) {
        console.error('Initialize emails error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});