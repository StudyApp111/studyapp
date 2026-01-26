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
        
        // Send TikTok Subscribe event via server-side API
        try {
          const tiktokAccessToken = Deno.env.get("TIKTOK_ACCESS_TOKEN");
          const tiktokPixelId = Deno.env.get("TIKTOK_PIXEL_ID");
          
          console.log("TikTok config check - Pixel ID exists:", !!tiktokPixelId, "Access Token exists:", !!tiktokAccessToken);
          
          if (tiktokAccessToken && tiktokPixelId) {
            const amount = planType === 'yearly' ? 59.88 : 6.99;
            
            // Hash email for TikTok (SHA256)
            const emailHash = await crypto.subtle.digest(
              "SHA-256",
              new TextEncoder().encode(userEmail.toLowerCase().trim())
            );
            const hashedEmail = Array.from(new Uint8Array(emailHash))
              .map(b => b.toString(16).padStart(2, '0'))
              .join('');
            
            // TikTok Events API v1.3 - pixel_code at root, data contains events
            const eventData = {
              event: "Subscribe",
              event_id: `subscribe_${user.id}_${Date.now()}`,
              event_time: Math.floor(Date.now() / 1000),
              user: {
                email: hashedEmail
              },
              page: {
                url: "https://app.studyappai.com/pricingplans"
              },
              properties: {
                contents: [{
                  content_id: `pro_${planType}`,
                  content_type: "product",
                  content_name: `Pro Subscription (${planType})`
                }],
                currency: "USD",
                value: amount
              }
            };

            const requestBody = {
              event_source: "web",
              event_source_id: tiktokPixelId,
              data: [eventData]
            };
            
            console.log("Sending TikTok event:", JSON.stringify(requestBody));

            const tiktokResponse = await fetch(
              "https://business-api.tiktok.com/open_api/v1.3/event/track/",
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "Access-Token": tiktokAccessToken
                },
                body: JSON.stringify(requestBody)
              }
            );
            
            const tiktokResult = await tiktokResponse.json();
            console.log("TikTok Subscribe event response:", JSON.stringify(tiktokResult));
          } else {
            console.log("TikTok tracking skipped - missing credentials");
          }
        } catch (tiktokErr) {
          console.error("TikTok event error (non-blocking):", tiktokErr.message, tiktokErr.stack);
        }
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