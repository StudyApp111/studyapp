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
    
    // Default to yearly, trial must be explicitly set to true
    const planType = plan_type || 'yearly';
    const includeTrial = trial === true; // Only include trial if explicitly requested
    
    // Get price IDs
    const STRIPE_PRICE_MONTHLY = Deno.env.get("STRIPE_PRICE_MONTHLY");
    const STRIPE_PRICE_YEARLY = Deno.env.get("STRIPE_PRICE_YEARLY");
    
    console.log("=== Stripe Checkout Debug ===");
    console.log("Plan type:", planType);
    console.log("Include trial:", includeTrial);
    console.log("STRIPE_PRICE_MONTHLY:", STRIPE_PRICE_MONTHLY || "NOT SET");
    console.log("STRIPE_PRICE_YEARLY:", STRIPE_PRICE_YEARLY || "NOT SET");
    
    // Select price based on plan type
    const priceId = planType === 'yearly' ? STRIPE_PRICE_YEARLY : STRIPE_PRICE_MONTHLY;
    
    if (!priceId || !priceId.startsWith('price_')) {
      return Response.json({ 
        error: 'Price not configured. Please contact support.',
      }, { status: 400 });
    }

    // TRIAL ABUSE PREVENTION: Check if user has ever had a trial before
    const hasHadTrial = user.has_used_trial === true || 
                        user.trial_end_date || 
                        user.stripe_subscription_id;
    
    // Only allow trial for users who have never had one
    const canHaveTrial = includeTrial && !hasHadTrial;
    
    console.log("Has had trial before:", hasHadTrial);
    console.log("Can have trial:", canHaveTrial);

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
    } else if (canHaveTrial) {
      // Double-check with Stripe if customer has had any subscriptions before
      try {
        const existingSubscriptions = await stripe.subscriptions.list({
          customer: customerId,
          limit: 1
        });
        if (existingSubscriptions.data.length > 0) {
          console.log("Customer has existing Stripe subscriptions, no trial");
          // Mark user as having used trial to prevent future abuse
          await base44.auth.updateMe({ has_used_trial: true });
        }
      } catch (e) {
        console.log("Error checking existing subscriptions:", e.message);
      }
    }

    // Create checkout session with trial only if eligible
    const subscriptionData = {
      metadata: {
        user_email: user.email,
        user_id: user.id,
        plan_type: planType
      }
    };
    
    // Only add trial_period_days if canHaveTrial is true
    if (canHaveTrial) {
      subscriptionData.trial_period_days = 7;
    }

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
      success_url: success_url || `${req.headers.get('origin')}/PricingPlans?success=true&plan=${planType}`,
      cancel_url: cancel_url || `${req.headers.get('origin')}/PricingPlans?canceled=true`,
      metadata: {
        user_email: user.email,
        user_id: user.id,
        plan_type: planType
      },
      subscription_data: subscriptionData,
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