import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import Stripe from 'npm:stripe@14.21.0';

const stripe = new Stripe(Deno.env.get("STRIPE_API_KEY"));

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

    const { plan_type, trial, success_url, cancel_url } = await req.json();
    
    // Default to monthly with trial for the new flow
    const planType = plan_type || 'monthly';
    const includeTrial = trial !== false; // Default to true for 7-day trial
    
    // Get price IDs
    const STRIPE_PRICE_MONTHLY = Deno.env.get("STRIPE_PRICE_MONTHLY");
    
    console.log("=== Stripe Checkout Debug ===");
    console.log("Plan type:", planType);
    console.log("Include trial:", includeTrial);
    console.log("STRIPE_PRICE_MONTHLY:", STRIPE_PRICE_MONTHLY || "NOT SET");
    
    // Use monthly price for trial flow
    const priceId = STRIPE_PRICE_MONTHLY;
    
    if (!priceId || !priceId.startsWith('price_')) {
      return Response.json({ 
        error: 'Price not configured. Please contact support.',
      }, { status: 400 });
    }

    // Check if user already has a Stripe customer ID
    let customerId = user.stripe_customer_id;
    
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.full_name,
        metadata: {
          user_id: user.id
        }
      });
      customerId = customer.id;
      
      await base44.auth.updateMe({
        stripe_customer_id: customerId
      });
    }

    // Create checkout session with 7-day trial
    const sessionConfig = {
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: success_url || `${req.headers.get('origin')}/Home?subscription=success`,
      cancel_url: cancel_url || `${req.headers.get('origin')}/Home?subscription=canceled`,
      metadata: {
        user_email: user.email,
        user_id: user.id,
        plan_type: planType
      },
      subscription_data: {
        trial_period_days: includeTrial ? 7 : undefined,
        metadata: {
          user_email: user.email,
          user_id: user.id,
          plan_type: planType
        }
      },
      // Collect payment method upfront for trial
      payment_method_collection: 'always',
      allow_promotion_codes: true,
    };

    console.log("Creating checkout session with config:", JSON.stringify(sessionConfig, null, 2));

    const session = await stripe.checkout.sessions.create(sessionConfig);

    return Response.json({ 
      url: session.url,
      checkout_url: session.url,
      session_id: session.id 
    });

  } catch (error) {
    console.error('Checkout session error:', error);
    return Response.json({ 
      error: error.message,
      details: error.type || error.code || 'Unknown error'
    }, { status: 500 });
  }
});