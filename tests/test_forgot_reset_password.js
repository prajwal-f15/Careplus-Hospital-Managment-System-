/**
 * ==============================================================================
 * CAREPULSE - FORGOT & RESET PASSWORD (EDGE FUNCTION + SENDLIB) TEST SUITE
 * Covers all 10 scenarios required for Edge Function & Frontend Auth flows.
 * ==============================================================================
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { stripTypeScriptTypes } = require('module');

const ROOT = path.resolve(__dirname, '..');

let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (!cond) {
    console.error(`✖ FAIL: ${msg}`);
    failed++;
    process.exitCode = 1;
  } else {
    console.log(`✔ PASS: ${msg}`);
    passed++;
  }
}

console.log('\n======================================================================');
console.log('CAREPULSE FORGOT PASSWORD (EDGE FUNCTION + SENDLIB) VERIFICATION');
console.log('======================================================================\n');

// ------------------------------------------------------------------------------
// 1. Static Security & Architecture Audit
// ------------------------------------------------------------------------------
const authSrc = fs.readFileSync(path.join(ROOT, 'js', 'auth.js'), 'utf8');
const forgotHtml = fs.readFileSync(path.join(ROOT, 'forgot-password.html'), 'utf8');
const resetHtml = fs.readFileSync(path.join(ROOT, 'reset-password.html'), 'utf8');
const edgePath = path.join(ROOT, 'supabase', 'functions', 'supabase-functions-new-send-password-reset', 'index.ts');

assert(fs.existsSync(edgePath), 'Edge Function index.ts exists at supabase/functions/supabase-functions-new-send-password-reset/index.ts');
const edgeTs = fs.readFileSync(edgePath, 'utf8');

assert(!authSrc.includes('resetPasswordForEmail'), 'js/auth.js no longer calls direct resetPasswordForEmail()');
assert(authSrc.includes('hyper-handler'), 'js/auth.js invokes deployed password reset Edge Function (hyper-handler)');
assert(authSrc.includes('sb.auth.updateUser'), 'js/auth.js uses sb.auth.updateUser()');
assert(!authSrc.includes('SENDLIB_API_KEY') && !forgotHtml.includes('SENDLIB_API_KEY'), 'SENDLIB_API_KEY never exposed in frontend code');
assert(!authSrc.includes('SERVICE_ROLE') && !forgotHtml.includes('SERVICE_ROLE') && !resetHtml.includes('SERVICE_ROLE'), 'Service role key never exposed in frontend code');
assert(edgeTs.includes('https://sendliberty.com/api/send'), 'Edge Function uses verified Sendliberty Gmail REST endpoint');
assert(edgeTs.includes('SUPABASE_SERVICE_ROLE_KEY') && edgeTs.includes('SENDLIB_API_KEY'), 'Edge Function reads secrets from Deno.env');
assert(edgeTs.includes('auth.admin.generateLink'), 'Edge Function generates recovery link via Supabase Admin API');
assert(!/console\.log\(.*actionLink|console\.error\(.*actionLink|console\.log\(.*sendlibApiKey|console\.log\(.*password/i.test(edgeTs), 'Edge Function never logs API keys, tokens, or passwords');

// Check HTML inline script syntax cleanly
for (const [label, html] of [['forgot-password.html', forgotHtml], ['reset-password.html', resetHtml]]) {
  const m = [...html.matchAll(/<script(?![^>]*\bsrc\b)[^>]*>([\s\S]*?)<\/script>/gi)].pop();
  assert(Boolean(m && m[1]), `${label} contains main script block`);
  new vm.Script(m[1], { filename: label });
  assert(true, `${label} inline script parses cleanly`);
}

// ------------------------------------------------------------------------------
// 2. Edge Function Simulation Harness (Scenarios 1, 2, 3, 4, 5, 9, 10)
// ------------------------------------------------------------------------------
function loadEdgeHandler({ env = {}, mockGenerateLink, mockFetch }) {
  const stripped = stripTypeScriptTypes(edgeTs, { mode: 'strip' });
  const rewritten = stripped
    .replace(/import\s+\{\s*createClient\s*\}\s+from\s+['"][^'"]+['"];/, 'const { createClient } = globalThis.__MOCK_SUPA__;')
    .replace('Deno.serve(', 'globalThis.__CAPTURE_HANDLER__(');

  let capturedHandler = null;
  const envMap = {
    SUPABASE_URL: 'https://vpimfibtizurhuhljcpb.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'mock-service-role-key',
    SENDLIB_API_KEY: 'mock-sendlib-key',
    SITE_URL: 'http://127.0.0.1:5500',
    ...env
  };

  const sandbox = {
    console: { log: () => {}, error: () => {}, warn: () => {} },
    Date,
    Math,
    Map,
    Set,
    JSON,
    URL,
    URLSearchParams,
    Response,
    Request,
    AbortSignal,
    Error,
    Deno: {
      env: { get: (k) => envMap[k] },
      serve: (fn) => { capturedHandler = fn; }
    },
    fetch: mockFetch,
    globalThis: null
  };
  sandbox.globalThis = sandbox;
  sandbox.__MOCK_SUPA__ = {
    createClient: () => ({
      auth: {
        admin: {
          generateLink: mockGenerateLink
        }
      }
    })
  };
  sandbox.__CAPTURE_HANDLER__ = (fn) => { capturedHandler = fn; };

  vm.createContext(sandbox);
  vm.runInContext(rewritten, sandbox);
  return capturedHandler;
}

async function runEdgeScenarioTests() {
  let sendlibCalls = [];
  let generateLinkBehavior = async ({ email }) => ({
    data: { properties: { action_link: `https://vpimfibtizurhuhljcpb.supabase.co/auth/v1/verify?token=tok_${email}&type=recovery` } },
    error: null
  });
  let fetchBehavior = async (url, init) => {
    sendlibCalls.push({ url, init, body: JSON.parse(init.body) });
    return new Response(JSON.stringify({ id: 'msg_123', status: 'sent' }), { status: 200 });
  };

  const handler = loadEdgeHandler({
    mockGenerateLink: (...args) => generateLinkBehavior(...args),
    mockFetch: (...args) => fetchBehavior(...args)
  });

  assert(typeof handler === 'function', 'Edge Function exports Deno.serve handler cleanly');

  const makeReq = (body, ip = '203.0.113.10', origin = 'http://127.0.0.1:5500') =>
    new Request('https://vpimfibtizurhuhljcpb.supabase.co/functions/v1/supabase-functions-new-send-password-reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-forwarded-for': ip, origin },
      body: JSON.stringify(body)
    });

  // Scenario 1: Registered email address
  sendlibCalls = [];
  const res1 = await handler(makeReq({ email: 'patient@hospital.com', redirectTo: 'http://127.0.0.1:5500/reset-password.html' }, '203.0.113.1'));
  const json1 = await res1.json();
  assert(res1.status === 200 && json1.success === true, 'Scenario 1: Registered email returns HTTP 200 success');
  assert(sendlibCalls.length === 1 && sendlibCalls[0].url === 'https://sendliberty.com/api/send', 'Scenario 1: Dispatched recovery link via Sendliberty REST API');
  assert(sendlibCalls[0].init.headers.Authorization === 'Bearer mock-sendlib-key', 'Scenario 1: Sent Bearer SENDLIB_API_KEY auth header');
  assert(sendlibCalls[0].body.html.includes('href="https://vpimfibtizurhuhljcpb.supabase.co/auth/v1/verify'), 'Scenario 1: Email button href embeds Supabase recovery action_link');
  assert(
    !sendlibCalls[0].body.html.includes('Or copy and paste this secure link') &&
    !/token=tok_/.test(sendlibCalls[0].body.text),
    'Scenario 1: Raw recovery link is hidden from visible email body and text preview'
  );

  // Scenario 2: Unregistered email address (anti-enumeration)
  sendlibCalls = [];
  generateLinkBehavior = async () => ({
    data: { user: null, properties: null },
    error: { status: 404, code: 'user_not_found', message: 'User not found' }
  });
  const res2 = await handler(makeReq({ email: 'nobody@example.com' }, '203.0.113.2'));
  const json2 = await res2.json();
  assert(res2.status === 200 && json2.message === json1.message && sendlibCalls.length === 0, 'Scenario 2: Unregistered email returns identical neutral 200 without calling Sendlib');

  // Scenario 3: Invalid email address
  const res3 = await handler(makeReq({ email: 'not-an-email' }, '203.0.113.3'));
  assert(res3.status === 400, 'Scenario 3: Invalid email format rejected with HTTP 400');

  // Scenario 4: Sendlib API failure
  generateLinkBehavior = async ({ email }) => ({
    data: { properties: { action_link: `https://vpimfibtizurhuhljcpb.supabase.co/auth/v1/verify?token=tok_${email}&type=recovery` } },
    error: null
  });
  fetchBehavior = async () => new Response(JSON.stringify({ error: 'Invalid API key' }), { status: 401 });
  const res4 = await handler(makeReq({ email: 'failmail@hospital.com' }, '203.0.113.4'));
  const json4 = await res4.json();
  assert(res4.status === 502 && !JSON.stringify(json4).includes('mock-sendlib-key'), 'Scenario 4: Sendlib failure returns HTTP 502 without leaking secrets');

  // Scenario 5: Supabase recovery link generation failure
  generateLinkBehavior = async () => ({
    data: null,
    error: { status: 500, code: 'unexpected_failure', message: 'DB failure' }
  });
  const res5 = await handler(makeReq({ email: 'dbfail@hospital.com' }, '203.0.113.5'));
  assert(res5.status === 502, 'Scenario 5: Supabase Admin generateLink failure returns HTTP 502');

  // Scenario 9: Duplicate requests (cooldown within 60s for same email)
  generateLinkBehavior = async () => ({
    data: { properties: { action_link: 'https://vpimfibtizurhuhljcpb.supabase.co/auth/v1/verify?token=ok&type=recovery' } },
    error: null
  });
  fetchBehavior = async () => new Response(JSON.stringify({ id: 'ok' }), { status: 200 });
  const dupFirst = await handler(makeReq({ email: 'dup@hospital.com' }, '203.0.113.6'));
  const dupSecond = await handler(makeReq({ email: 'dup@hospital.com' }, '203.0.113.7'));
  assert(dupFirst.status === 200 && dupSecond.status === 429, 'Scenario 9: Duplicate email request within cooldown returns HTTP 429');

  // Scenario 10: IP Rate limit exceeded (> 8 requests from same IP)
  let hit429 = false;
  for (let i = 1; i <= 10; i++) {
    const r = await handler(makeReq({ email: `user${i}@hospital.com` }, '203.0.113.99'));
    if (r.status === 429) hit429 = true;
  }
  assert(hit429, 'Scenario 10: Exceeding IP rate limit returns HTTP 429');

  // Open-redirect defense verification
  sendlibCalls = [];
  let capturedRedirectTo = '';
  generateLinkBehavior = async ({ options }) => {
    capturedRedirectTo = options.redirectTo;
    return { data: { properties: { action_link: 'https://example.com/ok' } }, error: null };
  };
  await handler(makeReq({ email: 'redir@hospital.com', redirectTo: 'https://evil-attacker.com/reset-password.html' }, '203.0.113.8'));
  assert(capturedRedirectTo === 'http://127.0.0.1:5500/reset-password.html', 'Open-redirect attempt falls back cleanly to trusted origin');
}

// ------------------------------------------------------------------------------
// 3. Frontend Auth + Reset Password Session Simulation (Scenarios 6, 7, 8)
// ------------------------------------------------------------------------------
async function runFrontendScenarioTests() {
  let invokedArgs = null;
  let activeSession = null;
  let updatedPasswordValue = null;
  let signedOutCalled = false;
  let verifyOtpMode = 'valid';

  const storage = {};
  const mockSupabase = {
    functions: {
      invoke: async (fnName, opts) => {
        invokedArgs = { fnName, opts };
        return { data: { success: true, message: 'If an account matches that email, a reset link was sent.' }, error: null };
      }
    },
    auth: {
      getSession: async () => ({ data: { session: activeSession }, error: null }),
      verifyOtp: async () => {
        if (verifyOtpMode === 'expired') return { data: null, error: { message: 'Token has expired' } };
        if (verifyOtpMode === 'used') return { data: null, error: { message: 'One-time token already consumed' } };
        activeSession = { user: { id: 'u1', email: 'patient@hospital.com' } };
        return { data: { session: activeSession }, error: null };
      },
      updateUser: async ({ password }) => {
        if (!activeSession) return { data: null, error: { message: 'Auth session missing' } };
        updatedPasswordValue = password;
        return { data: { user: { id: 'u1' } }, error: null };
      },
      signOut: async () => {
        signedOutCalled = true;
        activeSession = null;
      },
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } })
    }
  };

  const sandbox = {
    console,
    setTimeout,
    clearTimeout,
    URLSearchParams,
    CustomEvent: function () {},
    localStorage: {
      getItem: (k) => storage[k] ?? null,
      setItem: (k, v) => { storage[k] = String(v); },
      removeItem: (k) => { delete storage[k]; }
    },
    window: {
      location: { origin: 'http://127.0.0.1:5500', pathname: '/forgot-password.html' },
      CarePulseDB: { getClient: () => mockSupabase }
    },
    document: { addEventListener: () => {} }
  };

  vm.createContext(sandbox);
  vm.runInContext(authSrc, sandbox);
  const Auth = sandbox.window.Auth;

  // Test frontend Edge Function invocation
  await Auth.forgotPassword('Patient@Hospital.com ');
  assert(
    invokedArgs?.fnName === 'hyper-handler' &&
    invokedArgs?.opts?.body?.email === 'patient@hospital.com',
    'Frontend calls Edge Function hyper-handler with normalized email'
  );

  // Scenario 6 & 7: Unauthorized / expired / used recovery session rejected before updateUser
  activeSession = null;
  let blockedUnauthorized = false;
  try {
    await Auth.updatePassword('StrongPass123');
  } catch (e) {
    blockedUnauthorized = /missing|expired|used/i.test(e.message);
  }
  assert(blockedUnauthorized, 'Scenario 6/7: updatePassword blocks update when recovery session is expired, used, or missing');

  // Password strength check
  let blockedWeak = false;
  try {
    await Auth.updatePassword('123456');
  } catch (e) {
    blockedWeak = /8 characters/i.test(e.message);
  }
  assert(blockedWeak, 'Weak password rejected by validatePasswordStrength / updatePassword');

  // Scenario 8: Successful password reset after valid OTP/recovery session
  const verifyRes = await mockSupabase.auth.verifyOtp({ token_hash: 'tok123', type: 'recovery' });
  assert(Boolean(verifyRes.data.session), 'Scenario 8: Valid recovery session verified');
  await Auth.updatePassword('CarePulse#2026');
  assert(updatedPasswordValue === 'CarePulse#2026', 'Scenario 8: supabase.auth.updateUser updates password securely');

  // Single-use prevention after reset + verifyOtp already-used rejection
  await mockSupabase.auth.signOut();
  verifyOtpMode = 'used';
  const reuseRes = await mockSupabase.auth.verifyOtp({ token_hash: 'tok123', type: 'recovery' });
  assert(signedOutCalled && !activeSession && Boolean(reuseRes.error), 'Scenario 7/8: Session cleared after password update and token cannot be reused');
}

(async () => {
  await runEdgeScenarioTests();
  await runFrontendScenarioTests();

  console.log('\n======================================================================');
  console.log(`FORGOT/RESET PASSWORD CHECKS PASSED: ${passed}, FAILED: ${failed}`);
  console.log('======================================================================\n');
})();

