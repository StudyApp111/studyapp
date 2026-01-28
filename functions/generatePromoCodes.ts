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
function generateCode(length = 10) {
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

    const { count = 5, duration_days = 30, notes_prefix = '30-day free access' } = await req.json();

    const generatedCodes = [];

    for (let i = 0; i < count; i++) {
      const plainCode = generateCode(10);
      const codeHash = await hashCode(plainCode);

      // Check if code already exists
      const existing = await base44.asServiceRole.entities.PromoCode.filter({
        code_hash: codeHash
      });

      if (existing.length > 0) {
        // Regenerate if collision (unlikely)
        i--;
        continue;
      }

      // Create the promo code
      const promoCode = await base44.asServiceRole.entities.PromoCode.create({
        code: '***HIDDEN***',
        code_hash: codeHash,
        type: 'free_access',
        discount_value: null,
        duration_days: duration_days,
        max_uses: 1,
        current_uses: 0,
        is_active: true,
        expires_at: null,
        created_by_admin: user.email,
        notes: `${notes_prefix} - code ${i + 1}`
      });

      generatedCodes.push({
        code: plainCode,
        id: promoCode.id,
        duration_days: duration_days
      });
    }

    console.log(`[PromoCode] Admin ${user.email} generated ${count} promo codes`);

    return Response.json({
      success: true,
      codes: generatedCodes,
      message: `Generated ${count} promo codes. Save these codes now - they cannot be retrieved later!`
    });

  } catch (error) {
    console.error('[PromoCode] Bulk generation error:', error);
    return Response.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
});