import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import Stripe from 'npm:stripe@14.21.0';

const stripe = new Stripe(Deno.env.get("STRIPE_API_KEY"));

// Price IDs - you'll need to create these in Stripe Dashboard
const PRICE_IDS = {
  monthly: 'price_monthly_699', // Replace with actual Stripe price ID
  yearly: 'price_yearly_4999'   // Replace with actual Stripe price ID
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }

  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { plan_type, success_url, cancel_url } = await req.json();
    
    if (!plan_type || !['monthly', 'yearly'].includes(plan_type)) {
      return Response.json({ error: 'Invalid plan type' }, { status: 400 });
    }

    // Check if user already has a Stripe customer ID
    let customerId = user.stripe_customer_id;
    
    if (!customerId) {
      // Create a new customer
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.full_name,
        metadata: {
          user_id: user.id
        }
      });
      customerId = customer.id;
      
      // Save customer ID to user
      await base44.auth.updateMe({
        stripe_customer_id: customerId
      });
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      payment_method_types: ['card'],
      line_items: [
        {
          price: PRICE_IDS[plan_type],
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: success_url || `${req.headers.get('origin')}/PricingPlans?success=true`,
      cancel_url: cancel_url || `${req.headers.get('origin')}/PricingPlans?canceled=true`,
      metadata: {
        user_email: user.email,
        user_id: user.id,
        plan_type: plan_type
      },
      subscription_data: {
        metadata: {
          user_email: user.email,
          user_id: user.id,
          plan_type: plan_type
        }
      },
      allow_promotion_codes: true,
    });

    return Response.json({ 
      checkout_url: session.url,
      session_id: session.id 
    });

  } catch (error) {
    console.error('Checkout session error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});