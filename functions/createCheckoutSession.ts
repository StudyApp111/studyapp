import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import Stripe from 'npm:stripe@14.21.0';

const stripe = new Stripe(Deno.env.get("STRIPE_API_KEY"));

// Price IDs - Create these in Stripe Dashboard:
// 1. Create a Product called "Locked In Pro"
// 2. Add two prices: $6.99/month (monthly) and $59.88/year ($4.99/mo billed yearly)
// 3. Replace these IDs with your actual Stripe price IDs
// Price IDs are read inside the handler to ensure fresh env values

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

    // Get price IDs fresh from environment
    const STRIPE_PRICE_MONTHLY = Deno.env.get("STRIPE_PRICE_MONTHLY");
    const STRIPE_PRICE_YEARLY = Deno.env.get("STRIPE_PRICE_YEARLY");
    
    console.log("=== Stripe Checkout Debug ===");
    console.log("Plan type requested:", plan_type);
    console.log("STRIPE_PRICE_MONTHLY env:", STRIPE_PRICE_MONTHLY || "NOT SET");
    console.log("STRIPE_PRICE_YEARLY env:", STRIPE_PRICE_YEARLY || "NOT SET");
    
    const PRICE_IDS = {
      monthly: STRIPE_PRICE_MONTHLY,
      yearly: STRIPE_PRICE_YEARLY
    };

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

    // Validate price ID exists
    const priceId = PRICE_IDS[plan_type];
    if (!priceId) {
      console.error(`Price ID not set for ${plan_type}. STRIPE_PRICE_${plan_type.toUpperCase()} env var is missing or empty.`);
      return Response.json({ 
        error: `Price not configured for ${plan_type} plan. Please contact support.`,
        debug: `Missing STRIPE_PRICE_${plan_type.toUpperCase()} environment variable`
      }, { status: 400 });
    }

    // Validate price ID format
    if (!priceId.startsWith('price_')) {
      console.error(`Invalid price ID format for ${plan_type}:`, priceId, "- must start with 'price_'");
      return Response.json({ 
        error: `Invalid price configuration for ${plan_type} plan.`,
        debug: `Price ID should start with 'price_', got: ${priceId.substring(0, 20)}...`
      }, { status: 400 });
    }

    console.log(`Creating checkout for ${plan_type} with price ID: ${priceId}`);

    // Yearly is a one-time payment, monthly is subscription
    const isOneTime = plan_type === 'yearly';
    
    const sessionConfig = {
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: isOneTime ? 'payment' : 'subscription',
      success_url: success_url || `${req.headers.get('origin')}/PricingPlans?success=true`,
      cancel_url: cancel_url || `${req.headers.get('origin')}/PricingPlans?canceled=true`,
      metadata: {
        user_email: user.email,
        user_id: user.id,
        plan_type: plan_type
      },
      allow_promotion_codes: true,
    };
    
    // Only add subscription_data for subscription mode
    if (!isOneTime) {
      sessionConfig.subscription_data = {
        metadata: {
          user_email: user.email,
          user_id: user.id,
          plan_type: plan_type
        }
      };
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create(sessionConfig);

    return Response.json({ 
      checkout_url: session.url,
      session_id: session.id 
    });

  } catch (error) {
    console.error('Checkout session error:', error);
    console.error('Error details:', JSON.stringify({
      message: error.message,
      type: error.type,
      code: error.code,
      param: error.param
    }));
    return Response.json({ 
      error: error.message,
      details: error.type || error.code || 'Unknown error'
    }, { status: 500 });
  }
});