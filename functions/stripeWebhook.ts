import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import Stripe from 'npm:stripe@14.21.0';

const stripe = new Stripe(Deno.env.get("STRIPE_API_KEY"));

// PostHog server-side event helper
async function capturePostHogEvent(distinctId, event, properties = {}) {
  const apiKey = Deno.env.get("POSTHOG_API_KEY");
  const host = Deno.env.get("POSTHOG_HOST") || "https://us.i.posthog.com";
  if (!apiKey) return;
  try {
    await fetch(`${host}/capture/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
        event,
        properties: { ...properties, distinct_id: distinctId, $lib: "server" },
        timestamp: new Date().toISOString(),
      }),
    });
    console.log(`PostHog event sent: ${event} for ${distinctId}`);
  } catch (err) {
    console.warn("PostHog capture error (non-blocking):", err.message);
  }
}

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

    // Handle checkout.session.completed (subscription with potential trial)
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const userEmail = session.customer_email || session.metadata?.user_email;
      const planType = session.metadata?.plan_type || 'monthly';

      if (!userEmail) {
        console.error('No user email found in session');
        return Response.json({ error: 'No user email' }, { status: 400 });
      }

      console.log(`Processing subscription for: ${userEmail}, plan: ${planType}`);

      // Find user by email and update subscription
      const users = await base44.asServiceRole.entities.User.filter({ email: userEmail });

      if (users.length > 0) {
        const user = users[0];
        const now = new Date();

        // Get subscription details to check for trial
        let subscriptionStatus = 'active';
        let trialEndDate = null;
        let subscriptionEndDate = new Date();
        subscriptionEndDate.setMonth(subscriptionEndDate.getMonth() + 1);

        if (session.subscription) {
          try {
            const subscription = await stripe.subscriptions.retrieve(session.subscription);
            subscriptionStatus = subscription.status; // 'trialing' or 'active'

            if (subscription.trial_end) {
              trialEndDate = new Date(subscription.trial_end * 1000).toISOString();
            }

            if (subscription.current_period_end) {
              subscriptionEndDate = new Date(subscription.current_period_end * 1000);
            }

            console.log(`Subscription status: ${subscriptionStatus}, trial_end: ${trialEndDate}`);
          } catch (subError) {
            console.error('Error fetching subscription:', subError);
          }
        }

        await base44.asServiceRole.entities.User.update(user.id, {
          subscription_tier: 'pro',
          subscription_status: subscriptionStatus,
          subscription_plan_type: planType,
          subscription_start_date: now.toISOString(),
          subscription_end_date: subscriptionEndDate.toISOString(),
          trial_end_date: trialEndDate,
          stripe_customer_id: session.customer,
          stripe_subscription_id: session.subscription,
          has_used_trial: true // Mark that user has used their trial
        });

        console.log(`User ${userEmail} upgraded to pro (${planType})`);

        // PostHog: trial_started or subscription_started
        const phEvent = subscriptionStatus === 'trialing' ? 'trial_started' : 'subscription_started';
        await capturePostHogEvent(userEmail, phEvent, {
          plan_type: planType,
          subscription_status: subscriptionStatus,
          trial_end_date: trialEndDate,
          source: 'stripe_webhook',
        });

        // Trigger trial_started email via Resend (fire-and-forget)
        if (subscriptionStatus === 'trialing') {
          base44.asServiceRole.functions.invoke('sendResendEmail', {
            trigger_type: 'trial_started',
            user_email: userEmail,
            context: { 
              reference_id: `trial_started_${user.id}`,
              plan_type: planType,
              trial_end_date: trialEndDate
            }
          }).catch(err => console.warn('Trial started email error:', err.message));
        }
        
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
            
            // Hash user ID for external_id
            const userIdHash = await crypto.subtle.digest(
              "SHA-256",
              new TextEncoder().encode(user.id)
            );
            const hashedUserId = Array.from(new Uint8Array(userIdHash))
              .map(b => b.toString(16).padStart(2, '0'))
              .join('');
            
            // TikTok Events API v1.3 format
            const eventData = {
              event: "Subscribe",
              event_id: `subscribe_${user.id}_${Date.now()}`,
              event_time: Math.floor(Date.now() / 1000),
              user: {
                email: hashedEmail,
                external_id: hashedUserId
              },
              page: {
                url: "https://app.studyappai.com/pricingplans"
              },
              properties: {
                contents: [{
                  content_id: `pro_${planType}`,
                  content_name: `Pro Subscription (${planType})`
                }],
                content_type: "product",
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

    // Handle subscription updates (trial ending, status changes)
    if (event.type === 'customer.subscription.updated') {
      const subscription = event.data.object;

      const users = await base44.asServiceRole.entities.User.filter({ 
        stripe_subscription_id: subscription.id 
      });

      if (users.length > 0) {
        const user = users[0];

        // Update status based on subscription state
        if (subscription.status === 'active') {
          // Check if subscription is set to cancel at period end
          if (subscription.cancel_at_period_end) {
            // User cancelled but still has access until period end — keep 'cancelled' status
            const updates = {
              subscription_status: 'cancelled',
              subscription_tier: 'pro'
            };
            if (subscription.current_period_end) {
              updates.subscription_end_date = new Date(subscription.current_period_end * 1000).toISOString();
            }
            await base44.asServiceRole.entities.User.update(user.id, updates);
            console.log(`User ${user.email} cancel_at_period_end=true, keeping cancelled status, end: ${updates.subscription_end_date}`);
          } else {
            // Trial ended, now active paying customer OR user resubscribed after cancellation
            const previousStatus = user.subscription_status || user.data?.subscription_status;
            const updates = {
              subscription_status: 'active',
              subscription_tier: 'pro',
              trial_end_date: null
            };
            
            // Update subscription end date
            if (subscription.current_period_end) {
              updates.subscription_end_date = new Date(subscription.current_period_end * 1000).toISOString();
            }
            
            await base44.asServiceRole.entities.User.update(user.id, updates);
            console.log(`User ${user.email} status: active, end: ${updates.subscription_end_date}`);

            // PostHog: trial_converted_to_paid (trialing → active)
            if (previousStatus === 'trialing') {
              const planType = user.subscription_plan_type || user.data?.subscription_plan_type || 'monthly';
              await capturePostHogEvent(user.email, 'trial_converted_to_paid', {
                plan_type: planType,
                source: 'stripe_webhook',
              });
            }
          }
        } else if (subscription.status === 'canceled' || subscription.status === 'unpaid') {
          // Only downgrade to free if current_period_end has passed
          const periodEnd = subscription.current_period_end ? new Date(subscription.current_period_end * 1000) : new Date();
          const now = new Date();
          
          if (periodEnd <= now) {
            // Grace period over - downgrade to free
            await base44.asServiceRole.entities.User.update(user.id, {
              subscription_tier: 'free',
              subscription_status: 'canceled',
              trial_end_date: null
            });
            console.log(`User ${user.email} subscription ended - downgraded to free`);
          } else {
            // Still in grace period - keep pro tier but mark as cancelled
            await base44.asServiceRole.entities.User.update(user.id, {
              subscription_status: 'cancelled',
              subscription_end_date: periodEnd.toISOString()
            });
            console.log(`User ${user.email} cancelled - grace period until ${periodEnd.toISOString()}`);
          }
        } else if (subscription.status === 'trialing') {
          // Still in trial
          const trialEnd = subscription.trial_end 
            ? new Date(subscription.trial_end * 1000).toISOString() 
            : null;
          await base44.asServiceRole.entities.User.update(user.id, {
            subscription_status: 'trialing',
            trial_end_date: trialEnd
          });
        }
      }
    }

    // Handle subscription deleted (final removal after grace period)
    if (event.type === 'customer.subscription.deleted') {
      const subscription = event.data.object;

      const users = await base44.asServiceRole.entities.User.filter({ 
        stripe_subscription_id: subscription.id 
      });

      if (users.length > 0) {
        const deletedUser = users[0];
        const previousStatus = deletedUser.subscription_status || deletedUser.data?.subscription_status;
        
        await base44.asServiceRole.entities.User.update(deletedUser.id, {
          subscription_tier: 'free',
          subscription_status: 'canceled',
          trial_end_date: null,
          subscription_end_date: null
        });
        console.log(`User ${deletedUser.email} subscription fully deleted - downgraded to free`);

        // PostHog: distinguish trial_expired vs subscription_cancelled
        const phEvent = previousStatus === 'trialing' ? 'trial_expired' : 'subscription_cancelled';
        await capturePostHogEvent(deletedUser.email, phEvent, {
          previous_status: previousStatus,
          plan_type: deletedUser.subscription_plan_type || deletedUser.data?.subscription_plan_type || 'unknown',
          source: 'stripe_webhook',
        });
      }
    }

    return Response.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});