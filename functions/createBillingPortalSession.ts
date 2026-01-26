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

        if (!user.stripe_customer_id) {
            return Response.json({ 
                error: 'No billing account found' 
            }, { status: 400 });
        }

        // Create billing portal session
        const session = await stripe.billingPortal.sessions.create({
            customer: user.stripe_customer_id,
            return_url: `${req.headers.get('origin') || 'https://study-app.ai'}/ManageSubscription`
        });

        return Response.json({ url: session.url });

    } catch (error) {
        console.error('Billing portal error:', error);
        return Response.json({ 
            error: error.message || 'Failed to create billing portal session'
        }, { status: 500 });
    }
});