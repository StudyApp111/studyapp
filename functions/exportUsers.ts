import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        // Admin check - only kartikeya2159@gmail.com can export
        if (user.email !== 'kartikeya2159@gmail.com') {
            return Response.json({ error: 'Unauthorized' }, { status: 403 });
        }

        // Fetch all users with service role
        const users = await base44.asServiceRole.entities.User.list();

        // CSV headers
        const headers = [
            'Name',
            'Role',
            'Email',
            'Onboarding Completed',
            'Learning Profile ID',
            'Questions Completed',
            'Time Spent (seconds)',
            'Average Score',
            'Level',
            'Total Points',
            'Current Streak',
            'Longest Streak',
            'Last Study Date',
            'Badges',
            'Device Type',
            'Operating System',
            'Browser',
            'Browser Version',
            'Screen Width',
            'Screen Height',
            'Timezone',
            'User Agent',
            'First Visit Date',
            'Last Active Date',
            'Session Count',
            'Referrer',
            'Language',
            'Is PWA Installed',
            'Average Session Duration',
            'Total Logins',
            'Created Date'
        ];

        // Escape CSV field
        const escapeCSV = (field) => {
            const str = String(field || '');
            if (str.includes(',') || str.includes('"') || str.includes('\n')) {
                return `"${str.replace(/"/g, '""')}"`;
            }
            return str;
        };

        // Create CSV rows
        const rows = users.map(u => [
            u.full_name,
            u.role,
            u.email,
            u.onboarding_completed,
            u.learning_profile_id,
            u.questions_completed || 0,
            u.time_spent_seconds || 0,
            u.average_score || 0,
            u.level || 1,
            u.total_points || 0,
            u.current_streak || 0,
            u.longest_streak || 0,
            u.last_study_date,
            u.badges ? JSON.stringify(u.badges) : '[]',
            u.device_type,
            u.operating_system,
            u.browser,
            u.browser_version,
            u.screen_width,
            u.screen_height,
            u.timezone,
            u.user_agent,
            u.first_visit_date,
            u.last_active_date,
            u.session_count || 0,
            u.referrer,
            u.language,
            u.is_pwa_installed,
            u.average_session_duration || 0,
            u.total_logins || 0,
            u.created_date
        ].map(escapeCSV));

        // Build CSV
        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.join(','))
        ].join('\n');

        // Return CSV file
        return new Response(csvContent, {
            status: 200,
            headers: {
                'Content-Type': 'text/csv',
                'Content-Disposition': `attachment; filename="users_export_${new Date().toISOString().split('T')[0]}.csv"`
            }
        });

    } catch (error) {
        console.error('Error exporting users:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});