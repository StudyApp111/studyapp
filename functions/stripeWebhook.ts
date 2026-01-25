import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import Stripe from 'npm:stripe@14.21.0';

const stripe = new Stripe(Deno.env.get("STRIPE_API_KEY"));

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, stripe-signature',
      },
    });
  }

  try {
    const base44 = createClientFromRequest(req);
    const signature = req.headers.get('stripe-signature');
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    
    if (!signature || !webhookSecret) {
      console.error('Missing signature or webhook secret');
      return Response.json({ error: 'Missing signature or webhook secret' }, { status: 400 });
    }

    const body = await req.text();
    
    // Use async version for Deno's SubtleCrypto
    let event;
    try {
      event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
    } catch (err) {
      console.error('Webhook signature verification failed:', err.message);
      return Response.json({ error: `Webhook Error: ${err.message}` }, { status: 400 });
    }

    console.log(`Received Stripe event: ${event.type}`);

    // Handle checkout.session.completed (both payment and subscription)
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const userEmail = session.customer_email || session.metadata?.user_email;
      const planType = session.metadata?.plan_type || 'monthly'; // monthly or yearly
      const isOneTimePayment = session.mode === 'payment'; // yearly is one-time payment
      
      if (!userEmail) {
        console.error('No user email found in session');
        return Response.json({ error: 'No user email' }, { status: 400 });
      }

      console.log(`Processing ${isOneTimePayment ? 'one-time payment' : 'subscription'} for: ${userEmail}, plan: ${planType}`);

      // Find user by email and update subscription
      const users = await base44.asServiceRole.entities.User.filter({ email: userEmail });
      
      if (users.length > 0) {
        const user = users[0];
        const now = new Date().toISOString();
        
        // Calculate subscription end date
        const endDate = new Date();
        if (planType === 'yearly') {
          endDate.setFullYear(endDate.getFullYear() + 1);
        } else {
          endDate.setMonth(endDate.getMonth() + 1);
        }

        await base44.asServiceRole.entities.User.update(user.id, {
          subscription_tier: 'pro',
          subscription_status: 'active',
          subscription_plan_type: planType,
          subscription_start_date: now,
          subscription_end_date: endDate.toISOString(),
          stripe_customer_id: session.customer,
          // Only set subscription_id for actual subscriptions, not one-time payments
          stripe_subscription_id: isOneTimePayment ? null : session.subscription,
          // For one-time yearly, store the payment intent ID for reference
          stripe_payment_intent_id: isOneTimePayment ? session.payment_intent : null
        });

        console.log(`User ${userEmail} upgraded to pro (${planType}, ${isOneTimePayment ? 'one-time' : 'recurring'})`);
      } else {
        console.error(`User not found: ${userEmail}`);
      }
    }

    // Handle subscription canceled/deleted
    if (event.type === 'customer.subscription.deleted' || event.type === 'customer.subscription.updated') {
      const subscription = event.data.object;
      
      if (subscription.status === 'canceled' || subscription.status === 'unpaid') {
        const users = await base44.asServiceRole.entities.User.filter({ 
          stripe_subscription_id: subscription.id 
        });
        
        if (users.length > 0) {
          await base44.asServiceRole.entities.User.update(users[0].id, {
            subscription_tier: 'free',
            subscription_status: 'canceled'
          });
          console.log(`User ${users[0].email} downgraded to free`);
        }
      }
    }

    return Response.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});