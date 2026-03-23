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

        // Check if user has an active subscription or is trialing
        const isPro = user.subscription_tier === 'pro' && 
            (user.subscription_status === 'active' || user.subscription_status === 'trialing');
        
        if (!isPro) {
            return Response.json({ 
                error: 'No active subscription found' 
            }, { status: 400 });
        }

        // Check if user is in trial period
        const isTrialing = user.subscription_status === 'trialing';

        // If user has a Stripe subscription, cancel it
        if (user.stripe_subscription_id) {
            try {
                if (isTrialing) {
                    // For trial users: IMMEDIATELY cancel the subscription (no grace period)
                    await stripe.subscriptions.cancel(user.stripe_subscription_id);
                    console.log('Trial subscription immediately cancelled');
                } else {
                    // For paid users: Cancel at period end (user keeps access until billing period ends)
                    await stripe.subscriptions.update(
                        user.stripe_subscription_id,
                        { cancel_at_period_end: true }
                    );
                    console.log('Paid subscription set to cancel at period end');
                }
            } catch (stripeErr) {
                console.error('Stripe cancel error:', stripeErr.message);
                // Continue anyway to update local state
            }
        }

        // Update user record based on trial vs paid status
        if (isTrialing) {
            // Trial user: Immediately revoke access
            await base44.asServiceRole.entities.User.update(user.id, {
                subscription_tier: 'free',
                subscription_status: 'cancelled',
                trial_end_date: null
            });

            return Response.json({ 
                success: true,
                message: 'Your free trial has been cancelled. You are now on the free plan.',
                immediate: true
            });
        } else {
            // Paid user: Keep access until end of billing period
            await base44.asServiceRole.entities.User.update(user.id, {
                subscription_status: 'cancelled'
            });

            return Response.json({ 
                success: true,
                message: 'Subscription cancelled. You have access until ' + 
                    (user.subscription_end_date ? new Date(user.subscription_end_date).toLocaleDateString() : 'the end of your billing period'),
                cancel_at: user.subscription_end_date
            });
        }

    } catch (error) {
        console.error('Cancel subscription error:', error);
        return Response.json({ 
            error: error.message || 'Failed to cancel subscription'
        }, { status: 500 });
    }
});