import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

const emailTemplates = [
  {
    name: "Welcome Email",
    trigger_type: "onboarding_completed",
    subject: "Welcome to StudyApp",
    body: `<p>Hi {{name}},</p>

<p>Thanks for signing up for StudyApp. We're glad you're here.</p>

<p>StudyApp exists because most students work hard but study without clarity. They don't know what matters, what to fix, or whether they're actually improving.</p>

<p>This system is built to change that.</p>

<p>There's nothing you need to prove right now. All we ask is that you use the platform honestly. Answer questions the way you truly think. That's how the intelligence adapts to you.</p>

<p>If anything feels unclear, reply to this email. It goes straight to our team.</p>

<p>When you're ready, start your first lesson. Everything builds from there.</p>

<p>The StudyApp Team</p>

<p><a href="https://app.studyapp.ai">→ Start your first lesson</a></p>`,
    enabled: false
  },
  {
    name: "Grade Ready",
    trigger_type: "worksheet_completed",
    subject: "Your grade is taking shape",
    body: `<p>Hi {{name}},</p>

<p>Your latest worksheet has been analyzed.</p>

<p>If the exam were today, your predicted score would be:<br/>
<strong>{{predicted_grade}}</strong></p>

<p>This is not a final result. It's a direction.</p>

<p>Some students stop here and hope things improve on their own. Others look at what's holding the number back and fix it deliberately.</p>

<p>That choice matters.</p>

<p><a href="https://app.studyapp.ai">→ See what's affecting your grade</a></p>

<p>The StudyApp Team</p>`,
    enabled: false
  },
  {
    name: "Assignment Graded",
    trigger_type: "assignment_graded",
    subject: "Your assignment has been graded",
    body: `<p>Hi {{name}},</p>

<p>Your assignment has been reviewed.</p>

<p>Beyond the score, the system identified the exact reasoning errors costing you marks. These are the same mistakes exams repeatedly punish when they go unnoticed.</p>

<p>You don't have to repeat them.</p>

<p><a href="https://app.studyapp.ai">→ Review your feedback</a></p>

<p>The StudyApp Team</p>`,
    enabled: false
  },
  {
    name: "Weekly Progress Report",
    trigger_type: "weekly_report",
    subject: "Your weekly progress",
    body: `<p>Hi {{name}},</p>

<p>Here's what changed this week:</p>

<ul>
<li>Worksheets completed: <strong>{{worksheet_count}}</strong></li>
<li>Average score: <strong>{{average_score}}%</strong></li>
<li>Predicted grade change: <strong>{{grade_delta}}</strong></li>
</ul>

<p>This is what progress actually looks like. Not hours studied. Not intentions. Measurable movement.</p>

<p>Next week compounds this one.</p>

<p><a href="https://app.studyapp.ai">→ View full report</a></p>

<p>The StudyApp Team</p>`,
    enabled: false
  },
  {
    name: "Lesson Reminder",
    trigger_type: "incomplete_lesson",
    subject: "You left something unfinished",
    body: `<p>Hi {{name}},</p>

<p>You started a lesson but didn't finish it.</p>

<p>The unfinished section targets a weakness that shows up often in grading. Skipping it has an outsized cost. Finishing it has outsized impact.</p>

<p>This is leverage, not busywork.</p>

<p><a href="https://app.studyapp.ai">→ Finish the lesson</a></p>

<p>The StudyApp Team</p>`,
    enabled: false
  },
  {
    name: "Personalized Tips",
    trigger_type: "pattern_detected",
    subject: "One pattern is costing you marks",
    body: `<p>Hi {{name}},</p>

<p>The system noticed a pattern.</p>

<p>When questions involve <strong>{{weak_concept}}</strong>, your accuracy drops. Not due to lack of knowledge, but due to how you approach them.</p>

<p>Most students never see this. You can fix it now.</p>

<p>Next time, do this instead:<br/>
<em>{{actionable_tip}}</em></p>

<p><a href="https://app.studyapp.ai">→ Apply this insight</a></p>

<p>The StudyApp Team</p>`,
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