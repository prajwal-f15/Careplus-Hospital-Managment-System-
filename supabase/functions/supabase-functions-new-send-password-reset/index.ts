import { createClient } from 'npm:@supabase/supabase-js@2';

/**
 * ============================================================================
 * CarePulse Edge Function: supabase-functions-new-send-password-reset
 * Generates a single-use Supabase Auth recovery link via Admin API and
 * delivers it via Sendliberty (Gmail-based REST API: POST /api/send).
 * ============================================================================
 */

const SENDLIB_API_URL = Deno.env.get('SENDLIB_API_URL') || 'https://sendliberty.com/api/send';
const EMAIL_REGEX = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i;

// Sliding-window in-memory rate limits (per Edge isolate)
const IP_WINDOW_MS = 15 * 60 * 1000;
const MAX_REQUESTS_PER_IP = 8;
const EMAIL_WINDOW_MS = 15 * 60 * 1000;
const MAX_REQUESTS_PER_EMAIL = 3;
const EMAIL_COOLDOWN_MS = 60 * 1000;

const ipBuckets = new Map<string, number[]>();
const emailBuckets = new Map<string, number[]>();

function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;
  try {
    const parsed = new URL(origin);
    if (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') {
      return true;
    }
    const configuredSiteUrl = Deno.env.get('SITE_URL');
    if (configuredSiteUrl) {
      const siteOrigin = new URL(configuredSiteUrl).origin;
      if (parsed.origin === siteOrigin) return true;
    }
    const extraOrigins = (Deno.env.get('ALLOWED_RESET_ORIGINS') || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (extraOrigins.includes(parsed.origin)) return true;

    if (parsed.hostname.endsWith('.vercel.app') || parsed.hostname.endsWith('.netlify.app')) {
      return parsed.protocol === 'https:';
    }
  } catch {
    return false;
  }
  return false;
}

function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('origin');
  const allowOrigin = origin && isAllowedOrigin(origin) ? origin : '*';
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
}

function jsonResponse(
  body: Record<string, unknown>,
  status: number,
  corsHeaders: Record<string, string>,
  extraHeaders: Record<string, string> = {}
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
      ...extraHeaders,
    },
  });
}

function extractClientIp(req: Request): string {
  const cfIp = req.headers.get('cf-connecting-ip');
  if (cfIp) return cfIp.trim();
  const realIp = req.headers.get('x-real-ip');
  if (realIp) return realIp.trim();
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  return 'unknown';
}

function checkSlidingWindow(
  store: Map<string, number[]>,
  key: string,
  windowMs: number,
  maxHits: number,
  minCooldownMs = 0
): { allowed: boolean; retryAfterSec: number } {
  const now = Date.now();
  const recent = (store.get(key) || []).filter((ts) => now - ts < windowMs);

  if (minCooldownMs > 0 && recent.length > 0) {
    const sinceLast = now - recent[recent.length - 1];
    if (sinceLast < minCooldownMs) {
      store.set(key, recent);
      return {
        allowed: false,
        retryAfterSec: Math.ceil((minCooldownMs - sinceLast) / 1000),
      };
    }
  }

  if (recent.length >= maxHits) {
    const oldest = recent[0];
    store.set(key, recent);
    return {
      allowed: false,
      retryAfterSec: Math.max(1, Math.ceil((windowMs - (now - oldest)) / 1000)),
    };
  }

  recent.push(now);
  store.set(key, recent);
  return { allowed: true, retryAfterSec: 0 };
}

function resolveSafeRedirectUrl(requestedRedirect: unknown, reqOrigin: string | null): string {
  const fallbackBase =
    (reqOrigin && isAllowedOrigin(reqOrigin) ? reqOrigin : null) ||
    Deno.env.get('SITE_URL') ||
    'http://127.0.0.1:5500';
  const defaultRedirect = `${fallbackBase.replace(/\/$/, '')}/reset-password.html`;

  if (typeof requestedRedirect !== 'string' || !requestedRedirect.trim()) {
    return defaultRedirect;
  }

  try {
    const candidate = new URL(requestedRedirect.trim());
    if (!['http:', 'https:'].includes(candidate.protocol)) return defaultRedirect;
    if (!isAllowedOrigin(candidate.origin)) return defaultRedirect;
    if (!candidate.pathname.endsWith('/reset-password.html') && !candidate.pathname.endsWith('/reset-password')) {
      return defaultRedirect;
    }
    return `${candidate.origin}${candidate.pathname}`;
  } catch {
    return defaultRedirect;
  }
}

async function verifyCaptchaIfConfigured(token: unknown, clientIp: string): Promise<boolean> {
  const turnstileSecret = Deno.env.get('TURNSTILE_SECRET_KEY')?.trim();
  if (!turnstileSecret) return true;

  if (typeof token !== 'string' || !token.trim()) {
    return false;
  }

  try {
    const form = new URLSearchParams({
      secret: turnstileSecret,
      response: token.trim(),
      ...(clientIp !== 'unknown' ? { remoteip: clientIp } : {}),
    });

    const verifyRes = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
      signal: AbortSignal.timeout(5000),
    });

    if (!verifyRes.ok) return false;
    const outcome = await verifyRes.json();
    return Boolean(outcome?.success);
  } catch {
    return false;
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildRecoveryEmailHtml(actionLink: string): string {
  const safeUrl = escapeHtml(actionLink);
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Reset Your CarePulse Password</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#18181b;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f4f4f5;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;width:100%;background-color:#ffffff;border-radius:12px;border:1px solid #e4e4e7;overflow:hidden;">
          <tr>
            <td style="background-color:#0284c7;padding:22px 28px;text-align:left;">
              <div style="font-size:18px;font-weight:700;color:#ffffff;margin:0;">CarePulse Hospital</div>
              <div style="font-size:12px;color:#e0f2fe;margin-top:4px;">Account Security &amp; Password Recovery</div>
            </td>
          </tr>
          <tr>
            <td style="padding:28px;font-size:14px;line-height:1.6;color:#3f3f46;">
              <h1 style="margin:0 0 12px;font-size:20px;font-weight:700;color:#18181b;">Reset your password</h1>
              <p style="margin:0 0 18px;">
                We received a request to reset the password for your CarePulse Hospital account. Click the button below to choose a new password:
              </p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;">
                <tr>
                  <td align="center">
                    <a href="${safeUrl}" target="_blank" style="display:inline-block;background-color:#0284c7;color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;padding:13px 26px;border-radius:10px;">
                      Reset Password
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 10px;font-size:13px;color:#52525b;">
                This link is single-use and expires automatically for your security.
              </p>
              <p style="margin:0;font-size:13px;color:#71717a;">
                If you did not request a password reset, you can safely ignore this email — your password will remain unchanged.
              </p>
            </td>
          </tr>
          <tr>
            <td style="background-color:#fafafa;border-top:1px solid #e4e4e7;padding:16px 28px;text-align:center;">
              <p style="margin:0;font-size:11px;color:#71717a;">
                CarePulse Central Hospital &bull; Automated security email
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function isUserNotFoundError(err: { status?: number; code?: string; message?: string } | null): boolean {
  if (!err) return false;
  if (err.code === 'user_not_found') return true;
  if (err.status === 404) return true;
  return /user\s*(?:not|cannot be)\s*found/i.test(err.message || '');
}

const NEUTRAL_SUCCESS_MESSAGE =
  'If an account matches that email address, a password reset link has been sent.';

Deno.serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed.' }, 405, corsHeaders);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON request body.' }, 400, corsHeaders);
  }

  // Silently swallow obvious honeypot bot submissions
  if (typeof body.website === 'string' && body.website.trim().length > 0) {
    return jsonResponse({ success: true, message: NEUTRAL_SUCCESS_MESSAGE }, 200, corsHeaders);
  }

  const rawEmail = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  if (!rawEmail || rawEmail.length > 254 || !EMAIL_REGEX.test(rawEmail)) {
    return jsonResponse({ error: 'Please enter a valid email address.' }, 400, corsHeaders);
  }

  const clientIp = extractClientIp(req);

  // Server-side CAPTCHA check when TURNSTILE_SECRET_KEY is configured in Edge Function Secrets
  const captchaOk = await verifyCaptchaIfConfigured(body.captchaToken, clientIp);
  if (!captchaOk) {
    return jsonResponse(
      { error: 'Security verification failed. Please complete the CAPTCHA and try again.' },
      400,
      corsHeaders
    );
  }

  // Rate-limit by IP and by target email
  const ipLimit = checkSlidingWindow(ipBuckets, clientIp, IP_WINDOW_MS, MAX_REQUESTS_PER_IP);
  if (!ipLimit.allowed) {
    return jsonResponse(
      { error: `Too many requests from this network. Please retry in ${ipLimit.retryAfterSec}s.` },
      429,
      corsHeaders,
      { 'Retry-After': String(ipLimit.retryAfterSec) }
    );
  }

  const emailLimit = checkSlidingWindow(
    emailBuckets,
    rawEmail,
    EMAIL_WINDOW_MS,
    MAX_REQUESTS_PER_EMAIL,
    EMAIL_COOLDOWN_MS
  );
  if (!emailLimit.allowed) {
    return jsonResponse(
      { error: `Please wait ${emailLimit.retryAfterSec}s before requesting another reset email.` },
      429,
      corsHeaders,
      { 'Retry-After': String(emailLimit.retryAfterSec) }
    );
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const sendlibApiKey = Deno.env.get('SENDLIB_API_KEY')?.trim();
  const sendlibFromEmail = Deno.env.get('SENDLIB_FROM_EMAIL')?.trim();

  if (!supabaseUrl || !serviceRoleKey || !sendlibApiKey) {
    console.error('Missing required Edge Function environment secrets for password reset.');
    return jsonResponse(
      { error: 'Password recovery service is not configured yet. Please contact support.' },
      500,
      corsHeaders
    );
  }

  const safeRedirectTo = resolveSafeRedirectUrl(body.redirectTo, req.headers.get('origin'));

  try {
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'recovery',
      email: rawEmail,
      options: {
        redirectTo: safeRedirectTo,
      },
    });

    if (linkError) {
      if (isUserNotFoundError(linkError)) {
        // Prevent account enumeration: return neutral 200 without sending email
        return jsonResponse({ success: true, message: NEUTRAL_SUCCESS_MESSAGE }, 200, corsHeaders);
      }

      console.error('Supabase generateLink failure:', {
        status: linkError.status,
        code: linkError.code,
        message: linkError.message,
      });
      return jsonResponse(
        { error: 'Unable to generate password recovery link. Please try again shortly.' },
        502,
        corsHeaders
      );
    }

    const actionLink = linkData?.properties?.action_link;
    if (!actionLink) {
      console.error('Supabase generateLink returned empty action_link.');
      return jsonResponse(
        { error: 'Unable to generate password recovery link. Please try again shortly.' },
        502,
        corsHeaders
      );
    }

    const sendlibPayload: Record<string, unknown> = {
      to: rawEmail,
      subject: 'Reset your CarePulse password',
      html: buildRecoveryEmailHtml(actionLink),
      text: 'We received a request to reset your CarePulse Hospital password. Please view this email in HTML mode and click the Reset Password button. If you did not request this, ignore this email.',
    };

    if (sendlibFromEmail) {
      sendlibPayload.from = sendlibFromEmail;
    }

    const emailRes = await fetch(SENDLIB_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${sendlibApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(sendlibPayload),
      signal: AbortSignal.timeout(10000),
    });

    if (!emailRes.ok) {
      let errStatusText = '';
      try {
        const errJson = await emailRes.json();
        errStatusText = String(errJson?.error || errJson?.message || '');
      } catch {
        errStatusText = emailRes.statusText;
      }
      console.error('Sendliberty delivery failure:', {
        status: emailRes.status,
        detail: errStatusText.slice(0, 120),
      });
      return jsonResponse(
        { error: 'Failed to deliver password reset email. Please try again shortly.' },
        502,
        corsHeaders
      );
    }

    return jsonResponse({ success: true, message: NEUTRAL_SUCCESS_MESSAGE }, 200, corsHeaders);
  } catch (err) {
    console.error('Password reset Edge Function unexpected error:', {
      message: err instanceof Error ? err.message : 'Unknown error',
    });
    return jsonResponse(
      { error: 'An unexpected error occurred while processing password recovery.' },
      500,
      corsHeaders
    );
  }
});

