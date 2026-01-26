import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import Stripe from 'npm:stripe@14.14.0';

const stripe = new Stripe(Deno.env.get("STRIPE_API_KEY"));

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Get user's Stripe subscription ID
        if (!user.stripe_subscription_id) {
            return Response.json({ 
                error: 'No active subscription found' 
            }, { status: 400 });
        }

        // Cancel at period end (user keeps access until billing period ends)
        const subscription = await stripe.subscriptions.update(
            user.stripe_subscription_id,
            { cancel_at_period_end: true }
        );

        // Update user record
        await base44.asServiceRole.entities.User.update(user.id, {
            subscription_status: 'cancelled'
        });

        return Response.json({ 
            success: true,
            message: 'Subscription will be cancelled at the end of the billing period',
            cancel_at: subscription.cancel_at
        });

    } catch (error) {
        console.error('Cancel subscription error:', error);
        return Response.json({ 
            error: error.message || 'Failed to cancel subscription'
        }, { status: 500 });
    }
});