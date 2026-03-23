import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Secure hash function using Web Crypto API
async function hashCode(code) {
  const encoder = new TextEncoder();
  const data = encoder.encode(code.toUpperCase().trim());
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Generate a random promo code
function generateCode(length = 8) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed confusing chars like 0,O,1,I
  let code = '';
  const randomValues = new Uint8Array(length);
  crypto.getRandomValues(randomValues);
  for (let i = 0; i < length; i++) {
    code += chars[randomValues[i] % chars.length];
  }
  return code;
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
    
    // ADMIN ONLY
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { 
      custom_code, // Optional: admin can specify a code
      type, // 'free_access', 'discount_percent', 'discount_fixed'
      discount_value, // For discount types
      duration_days, // For free_access type
      max_uses, // How many times can be used (default 1)
      expires_at, // When the code itself expires
      notes // Internal notes
    } = await req.json();

    // Validation
    if (!type || !['free_access', 'discount_percent', 'discount_fixed'].includes(type)) {
      return Response.json({ 
        success: false, 
        error: 'Invalid type. Must be: free_access, discount_percent, or discount_fixed' 
      }, { status: 400 });
    }

    if (type === 'free_access' && (!duration_days || duration_days < 1 || duration_days > 365)) {
      return Response.json({ 
        success: false, 
        error: 'duration_days must be between 1 and 365 for free_access type' 
      }, { status: 400 });
    }

    if ((type === 'discount_percent' || type === 'discount_fixed') && !discount_value) {
      return Response.json({ 
        success: false, 
        error: 'discount_value required for discount types' 
      }, { status: 400 });
    }

    if (type === 'discount_percent' && (discount_value < 1 || discount_value > 100)) {
      return Response.json({ 
        success: false, 
        error: 'discount_percent must be between 1 and 100' 
      }, { status: 400 });
    }

    // Generate or use custom code
    const plainCode = custom_code?.toUpperCase().trim() || generateCode(10);
    const codeHash = await hashCode(plainCode);

    // Check if code already exists
    const existing = await base44.asServiceRole.entities.PromoCode.filter({
      code_hash: codeHash
    });

    if (existing.length > 0) {
      return Response.json({ 
        success: false, 
        error: 'This code already exists' 
      }, { status: 400 });
    }

    // Create the promo code
    const promoCode = await base44.asServiceRole.entities.PromoCode.create({
      code: '***HIDDEN***', // Never store plain text
      code_hash: codeHash,
      type,
      discount_value: discount_value || null,
      duration_days: duration_days || null,
      max_uses: max_uses || 1,
      current_uses: 0,
      is_active: true,
      expires_at: expires_at || null,
      created_by_admin: user.email,
      notes: notes || null
    });

    console.log(`[PromoCode] Admin ${user.email} created code: type=${type}, max_uses=${max_uses || 1}`);

    return Response.json({
      success: true,
      promo_code: plainCode, // Only returned once at creation!
      promo_code_id: promoCode.id,
      type,
      duration_days,
      discount_value,
      max_uses: max_uses || 1,
      expires_at,
      message: 'Promo code created. Save the code now - it cannot be retrieved later!'
    });

  } catch (error) {
    console.error('[PromoCode] Create error:', error);
    return Response.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
});