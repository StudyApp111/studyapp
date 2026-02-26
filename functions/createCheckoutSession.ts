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
    console.log("=== Checkout Session Start ===");
    
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      console.error("Auth failed - no user");
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    console.log("User authenticated:", user.email);

    const body = await req.json();
    console.log("Request body:", JSON.stringify(body));
    
    const { plan_type, trial, success_url, cancel_url } = body;
    
    // Default to yearly, trial must be explicitly set to true
    const planType = plan_type || 'yearly';
    const includeTrial = trial === true;
    
    console.log("Resolved plan_type:", planType, "from request plan_type:", plan_type);
    
    // Get price IDs
    const STRIPE_PRICE_MONTHLY = Deno.env.get("STRIPE_PRICE_MONTHLY");
    const STRIPE_PRICE_YEARLY = Deno.env.get("STRIPE_PRICE_YEARLY");
    
    console.log("=== Stripe Config ===");
    console.log("Plan type:", planType);
    console.log("Include trial:", includeTrial);
    console.log("STRIPE_PRICE_MONTHLY:", STRIPE_PRICE_MONTHLY || "NOT SET");
    console.log("STRIPE_PRICE_YEARLY:", STRIPE_PRICE_YEARLY || "NOT SET");
    console.log("STRIPE_API_KEY exists:", !!Deno.env.get("STRIPE_API_KEY"));
    
    // Select price based on plan type
    const priceId = planType === 'yearly' ? STRIPE_PRICE_YEARLY : STRIPE_PRICE_MONTHLY;
    
    console.log("Selected priceId:", priceId);
    
    if (!priceId) {
      console.error("Price ID is null/undefined for plan:", planType);
      return Response.json({ 
        error: 'Price not configured',
        details: `Missing price for ${planType} plan`
      }, { status: 400 });
    }
    
    if (!priceId.startsWith('price_')) {
      console.error("Invalid price ID format:", priceId);
      return Response.json({ 
        error: 'Invalid price configuration',
        details: `Price ID should start with 'price_' but got: ${priceId}`
      }, { status: 400 });
    }
    
    console.log("Price validation passed");

    // TRIAL ABUSE PREVENTION: Check if user has ever had a trial before
    const hasHadTrial = user.has_used_trial === true || 
                        user.trial_end_date || 
                        user.stripe_subscription_id;
    
    // Only allow trial for users who have never had one
    const canHaveTrial = includeTrial && !hasHadTrial;
    
    console.log("=== Trial Check ===");
    console.log("Has had trial before:", hasHadTrial);
    console.log("Can have trial:", canHaveTrial);

    // Check if user already has a Stripe customer ID
    let customerId = user.stripe_customer_id;
    
    console.log("=== Customer Setup ===");
    console.log("Existing customer ID:", customerId || "none");
    
    if (!customerId) {
      console.log("Creating new Stripe customer...");
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.full_name,
        metadata: {
          user_id: user.id
        }
      });
      customerId = customer.id;
      console.log("Created customer:", customerId);
      
      await base44.auth.updateMe({
        stripe_customer_id: customerId
      });
      console.log("Updated user with customer ID");
    } else if (canHaveTrial) {
      // Double-check with Stripe if customer has had any subscriptions before
      try {
        console.log("Checking for existing subscriptions...");
        const existingSubscriptions = await stripe.subscriptions.list({
          customer: customerId,
          limit: 1
        });
        console.log("Existing subscriptions found:", existingSubscriptions.data.length);
        if (existingSubscriptions.data.length > 0) {
          console.log("Customer has existing Stripe subscriptions, no trial");
          // Mark user as having used trial to prevent future abuse
          await base44.auth.updateMe({ has_used_trial: true });
        }
      } catch (e) {
        console.error("Error checking existing subscriptions:", e.message);
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
      console.log("Trial added: 7 days");
    } else {
      console.log("No trial (user not eligible or not requested)");
    }

    console.log("=== Building Checkout Session ===");
    
    const origin = req.headers.get('origin') || 'https://app.studyappai.com';
    const finalSuccessUrl = success_url || `${origin}/PricingPlans?success=true&plan=${planType}`;
    const finalCancelUrl = cancel_url || `${origin}/PricingPlans?canceled=true`;
    
    console.log("Success URL:", finalSuccessUrl);
    console.log("Cancel URL:", finalCancelUrl);

    const sessionConfig = {
      customer: customerId,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: finalSuccessUrl,
      cancel_url: finalCancelUrl,
      metadata: {
        user_email: user.email,
        user_id: user.id,
        plan_type: planType
      },
      subscription_data: subscriptionData,
      allow_promotion_codes: true,
    };

    // For trials: no credit card required, cancel if no payment method at end
    if (canHaveTrial) {
      sessionConfig.payment_method_collection = 'if_required';
      subscriptionData.trial_settings = {
        end_behavior: {
          missing_payment_method: 'cancel'
        }
      };
      console.log("No-credit-card trial mode enabled");
      console.log("payment_method_collection:", sessionConfig.payment_method_collection);
      console.log("trial_settings:", JSON.stringify(subscriptionData.trial_settings));
    } else {
      sessionConfig.payment_method_collection = 'always';
      console.log("Standard checkout (no trial) - payment always required");
    }

    console.log("Session config prepared:", JSON.stringify({
      customer: customerId,
      priceId: priceId,
      mode: 'subscription',
      hasTrial: !!subscriptionData.trial_period_days,
      planType: planType,
      payment_method_collection: sessionConfig.payment_method_collection,
      trial_settings: subscriptionData.trial_settings,
      trial_period_days: subscriptionData.trial_period_days
    }));

    console.log("Calling Stripe API...");
    const session = await stripe.checkout.sessions.create(sessionConfig);
    console.log("Stripe session created successfully:", session.id);

    return Response.json({ 
      url: session.url,
      checkout_url: session.url,
      session_id: session.id 
    });

  } catch (error) {
    console.error('=== CHECKOUT ERROR ===');
    console.error('Error message:', error.message);
    console.error('Error type:', error.type);
    console.error('Error code:', error.code);
    console.error('Full error:', error);
    console.error('Error stack:', error.stack);
    
    return Response.json({ 
      error: error.message,
      details: error.type || error.code || 'Unknown error',
      raw_error: error.toString()
    }, { status: 500 });
  }
});