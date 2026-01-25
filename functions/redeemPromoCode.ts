import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Secure hash function using Web Crypto API
async function hashCode(code) {
  const encoder = new TextEncoder();
  const data = encoder.encode(code.toUpperCase().trim());
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

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

    const { code } = await req.json();
    
    if (!code || typeof code !== 'string' || code.length < 3 || code.length > 50) {
      return Response.json({ 
        success: false, 
        error: 'Invalid promo code format' 
      }, { status: 400 });
    }

    // Hash the input code for secure lookup
    const codeHash = await hashCode(code);
    
    // Get client info for fraud tracking
    const ipAddress = req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip') || 'unknown';
    const userAgent = req.headers.get('user-agent') || 'unknown';

    // Check if user already has active pro subscription
    if (user.subscription_tier === 'pro' && user.subscription_status === 'active') {
      // Check if current subscription is from promo
      if (user.promo_access_until) {
        const promoExpiry = new Date(user.promo_access_until);
        if (promoExpiry > new Date()) {
          return Response.json({
            success: false,
            error: 'You already have an active promo subscription'
          });
        }
      } else {
        return Response.json({
          success: false,
          error: 'You already have an active paid subscription'
        });
      }
    }

    // Look up promo code by hash (using service role for security)
    const promoCodes = await base44.asServiceRole.entities.PromoCode.filter({
      code_hash: codeHash
    });

    if (promoCodes.length === 0) {
      // Log failed attempt for security monitoring
      console.log(`[PromoCode] Invalid code attempt by ${user.email} from ${ipAddress}`);
      return Response.json({
        success: false,
        error: 'Invalid promo code'
      });
    }

    const promoCode = promoCodes[0];

    // Validate promo code
    if (!promoCode.is_active) {
      return Response.json({
        success: false,
        error: 'This promo code is no longer active'
      });
    }

    if (promoCode.expires_at && new Date(promoCode.expires_at) < new Date()) {
      return Response.json({
        success: false,
        error: 'This promo code has expired'
      });
    }

    if (promoCode.current_uses >= promoCode.max_uses) {
      // Deactivate the code
      await base44.asServiceRole.entities.PromoCode.update(promoCode.id, {
        is_active: false
      });
      return Response.json({
        success: false,
        error: 'This promo code has already been used'
      });
    }

    // Check if this user already redeemed this specific code
    const existingRedemptions = await base44.asServiceRole.entities.PromoCodeRedemption.filter({
      user_email: user.email,
      code_hash: codeHash
    });

    if (existingRedemptions.length > 0) {
      return Response.json({
        success: false,
        error: 'You have already used this promo code'
      });
    }

    // Check if user has redeemed ANY promo code recently (anti-abuse)
    const recentRedemptions = await base44.asServiceRole.entities.PromoCodeRedemption.filter({
      user_email: user.email
    });
    
    if (recentRedemptions.length >= 3) {
      return Response.json({
        success: false,
        error: 'Maximum promo code limit reached for this account'
      });
    }

    const now = new Date();
    let updateData = {};
    let accessGrantedUntil = null;

    // Apply promo based on type
    if (promoCode.type === 'free_access') {
      const durationDays = promoCode.duration_days || 30;
      accessGrantedUntil = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);
      
      updateData = {
        subscription_tier: 'pro',
        subscription_status: 'active',
        subscription_plan_type: 'promo',
        promo_code_used: promoCode.id,
        promo_access_until: accessGrantedUntil.toISOString(),
        subscription_start_date: now.toISOString(),
        subscription_end_date: accessGrantedUntil.toISOString()
      };
    } else if (promoCode.type === 'discount_percent' || promoCode.type === 'discount_fixed') {
      // For discount codes, we store them for use at checkout
      updateData = {
        pending_promo_code_id: promoCode.id,
        pending_promo_discount_type: promoCode.type,
        pending_promo_discount_value: promoCode.discount_value
      };
    }

    // Update user with promo benefits
    await base44.auth.updateMe(updateData);

    // Record the redemption
    await base44.asServiceRole.entities.PromoCodeRedemption.create({
      promo_code_id: promoCode.id,
      user_email: user.email,
      user_id: user.id,
      code_hash: codeHash,
      type: promoCode.type,
      discount_value: promoCode.discount_value,
      access_granted_until: accessGrantedUntil?.toISOString(),
      ip_address: ipAddress,
      user_agent: userAgent.substring(0, 500),
      redeemed_at: now.toISOString()
    });

    // Increment usage count and potentially deactivate
    const newUseCount = (promoCode.current_uses || 0) + 1;
    await base44.asServiceRole.entities.PromoCode.update(promoCode.id, {
      current_uses: newUseCount,
      is_active: newUseCount < promoCode.max_uses
    });

    console.log(`[PromoCode] Successfully redeemed by ${user.email}: type=${promoCode.type}, code_id=${promoCode.id}`);

    // Return success with details
    if (promoCode.type === 'free_access') {
      return Response.json({
        success: true,
        type: 'free_access',
        message: `Pro access activated for ${promoCode.duration_days || 30} days!`,
        expires_at: accessGrantedUntil?.toISOString()
      });
    } else {
      return Response.json({
        success: true,
        type: promoCode.type,
        discount_value: promoCode.discount_value,
        message: promoCode.type === 'discount_percent' 
          ? `${promoCode.discount_value}% discount applied!`
          : `$${promoCode.discount_value} discount applied!`
      });
    }

  } catch (error) {
    console.error('[PromoCode] Error:', error);
    return Response.json({ 
      success: false, 
      error: 'Something went wrong. Please try again.' 
    }, { status: 500 });
  }
});