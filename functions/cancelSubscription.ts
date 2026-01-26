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

        // Check if user has an active subscription
        const isPro = user.subscription_tier === 'pro' && user.subscription_status === 'active';
        if (!isPro) {
            return Response.json({ 
                error: 'No active subscription found' 
            }, { status: 400 });
        }

        // Handle yearly (one-time payment) vs monthly (recurring subscription)
        const isYearlyOneTime = user.subscription_plan_type === 'yearly' && !user.stripe_subscription_id;
        
        if (isYearlyOneTime) {
            // For yearly one-time payment, we can't cancel via Stripe API
            // Just mark as cancelled - they keep access until subscription_end_date
            await base44.asServiceRole.entities.User.update(user.id, {
                subscription_status: 'cancelled'
            });

            return Response.json({ 
                success: true,
                message: 'Your yearly subscription will not renew. You have access until ' + 
                    (user.subscription_end_date ? new Date(user.subscription_end_date).toLocaleDateString() : 'the end of your subscription period'),
                cancel_at: user.subscription_end_date
            });
        }

        // For monthly recurring subscriptions, cancel via Stripe
        if (!user.stripe_subscription_id) {
            // No Stripe subscription but has pro - treat as manual/promo subscription
            await base44.asServiceRole.entities.User.update(user.id, {
                subscription_status: 'cancelled'
            });

            return Response.json({ 
                success: true,
                message: 'Subscription cancelled. You have access until ' + 
                    (user.subscription_end_date ? new Date(user.subscription_end_date).toLocaleDateString() : 'the end of your subscription period'),
                cancel_at: user.subscription_end_date
            });
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