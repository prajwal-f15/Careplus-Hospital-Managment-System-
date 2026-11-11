/**
 * ==============================================================================
 * CAREPULSE - BOOKING -> PENDING -> DOCTOR CONFIRM -> NOTIFICATION -> SLIP + QR
 * End-to-End Integration & Inline Script Syntax Audit
 * ==============================================================================
 */

const fs = require('fs');
const path = require('path');

const url = 'https://vpimfibtizurhuhljcpb.supabase.co';
const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZwaW1maWJ0aXp1cmh1aGxqY3BiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg4NzExNzIsImV4cCI6MjEwNDQ0NzE3Mn0.tziYyO2_xJY3xoRfwVIn34jsGYnuAo6_YXdDPtOYKDU';

let total = 0;
let passed = 0;

function assert(name, cond, detail = '') {
  total++;
  if (cond) {
    passed++;
    console.log(`  ✔ PASS : ${name}`);
  } else {
    console.error(`  ✖ FAIL : ${name}${detail ? ' -> ' + detail : ''}`);
  }
}

function getHtmlFiles(dir) {
  let results = [];
  for (const item of fs.readdirSync(dir)) {
    const full = path.join(dir, item);
    if (fs.statSync(full).isDirectory()) {
      if (item !== '.git' && item !== 'node_modules') {
        results = results.concat(getHtmlFiles(full));
      }
    } else if (item.endsWith('.html')) {
      results.push(full);
    }
  }
  return results;
}

async function run() {
  console.log('\n======================================================================');
  console.log('PENDING -> DOCTOR CONFIRM -> NOTIFICATION -> SLIP & QR FLOW AUDIT');
  console.log('======================================================================\n');

  // 1. Check inline <script> syntax across all 36 HTML files
  const htmlFiles = getHtmlFiles('.');
  let inlineErrors = [];
  for (const file of htmlFiles) {
    const html = fs.readFileSync(file, 'utf8');
    const matches = [...html.matchAll(/<script(?:\s+[^>]*)?>([\s\S]*?)<\/script>/gi)];
    for (let i = 0; i < matches.length; i++) {
      const tag = matches[i][0];
      if (/src\s*=/i.test(tag.split('>')[0])) continue;
      const body = matches[i][1].trim();
      if (!body) continue;
      try {
        new Function(body);
      } catch (e) {
        inlineErrors.push(`${file} (script #${i + 1}): ${e.message}`);
      }
    }
  }
  assert(
    `All inline <script> blocks across ${htmlFiles.length} HTML files have valid syntax`,
    inlineErrors.length === 0,
    inlineErrors.join('; ')
  );

  // 2. Check external JS syntax
  const jsFiles = fs.readdirSync('js').filter(f => f.endsWith('.js'));
  let jsErrors = [];
  for (const f of jsFiles) {
    try {
      new Function(fs.readFileSync(path.join('js', f), 'utf8'));
    } catch (e) {
      jsErrors.push(`js/${f}: ${e.message}`);
    }
  }
  assert(`All ${jsFiles.length} js/*.js modules compile cleanly`, jsErrors.length === 0, jsErrors.join('; '));

  // 3. Verify Booking -> Pending -> Doctor Confirm -> Slip & QR Logic
  const supabaseJs = fs.readFileSync('js/supabase.js', 'utf8');
  const patientJs = fs.readFileSync('js/patient.js', 'utf8');
  const pdfJs = fs.readFileSync('js/pdf-receipt.js', 'utf8');
  const bookHtml = fs.readFileSync('patient/book-appointment.html', 'utf8');
  const detailsHtml = fs.readFileSync('patient/appointment-details.html', 'utf8');

  assert('bookAppointment defaults patient booking status to pending', supabaseJs.includes("status = 'pending'") && supabaseJs.includes('status: initialStatus'));
  assert('bookAppointment sends pending notification to patient & approval request to doctor', supabaseJs.includes('Pending Confirmation') && supabaseJs.includes('Pending Approval'));
  assert('updateAppointmentStatus unlocks confirmation notification + Slip & QR note', supabaseJs.includes('Appointment Confirmed! Slip & QR Ready'));
  assert('verifyAppointmentQR blocks pending appointments & checks verification hash', supabaseJs.includes("matched.status === 'pending'") && supabaseJs.includes('providedHash'));
  assert('pdf-receipt.js locks slip when pending/cancelled/rejected & auto-loads QRCode', pdfJs.includes('loadQRCodeLibraryIfNeeded') && pdfJs.includes("['pending', 'cancelled', 'rejected'].includes(appointment.status)"));
  assert('pdf-receipt.js embeds non-PII CAREPULSE:VERIFY QR payload onto A5 PDF', pdfJs.includes('CAREPULSE:VERIFY:') && pdfJs.includes('doc.addImage(qrDataUrl'));
  assert('patient/book-appointment.html loads qrcode.min.js & shows Pending Doctor Confirmation state', bookHtml.includes('qrcode.min.js') && bookHtml.includes('Pending Doctor Confirmation'));
  assert('patient.js gates Dashboard & List Slip/QR until Doctor confirms', patientJs.includes('Slip & QR Locked (Pending Approval)') && patientJs.includes('Slip & QR Pending Approval'));
  assert('patient/appointment-details.html gates QR box while pending & unlocks when confirmed', detailsHtml.includes('QR & Slip Pending Approval') && detailsHtml.includes('isConfirmedOrAfter && qrContainer'));

  // 4. Live Supabase REST Test: Pending Insert -> Doctor Confirm Patch -> Delete Cleanup
  const headers = {
    'apikey': anonKey,
    'Authorization': `Bearer ${anonKey}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
  };

  const testDate = '2028-05-15';
  const docId = 'd0c11111-1111-1111-1111-111111111111';
  const patientId = '11111111-1111-1111-1111-111111111111';
  const deptId = 'd1111111-1111-1111-1111-111111111111';

  await fetch(`${url}/rest/v1/appointments?doctor_id=eq.${docId}&appointment_date=eq.${testDate}`, {
    method: 'DELETE',
    headers
  });

  const testHash = 'CP-TESTQRHASH99';
  const createRes = await fetch(`${url}/rest/v1/appointments`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      appointment_number: 'APT-FLOW01',
      token_number: 'CARD-899',
      patient_id: patientId,
      doctor_id: docId,
      department_id: deptId,
      appointment_date: testDate,
      time_slot: '11:30:00',
      reason: 'Workflow verification test',
      status: 'pending',
      queue_status: 'waiting',
      is_called: false,
      verification_hash: testHash
    })
  });
  const createdArr = await createRes.json();
  const created = Array.isArray(createdArr) ? createdArr[0] : null;
  assert('Live Supabase accepts new patient booking with status=pending & verification_hash', createRes.ok && created?.status === 'pending' && created?.verification_hash === testHash, JSON.stringify(createdArr));

  if (created?.id) {
    const confirmRes = await fetch(`${url}/rest/v1/appointments?id=eq.${created.id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ status: 'confirmed' })
    });
    const confirmedArr = await confirmRes.json();
    const confirmed = Array.isArray(confirmedArr) ? confirmedArr[0] : null;
    assert('Live Supabase allows doctor transition pending -> confirmed', confirmRes.ok && confirmed?.status === 'confirmed', JSON.stringify(confirmedArr));

    await fetch(`${url}/rest/v1/appointments?id=eq.${created.id}`, {
      method: 'DELETE',
      headers
    });
  }

  console.log(`\nSUMMARY: TOTAL: ${total} | PASSED: ${passed} | FAILED: ${total - passed}\n`);
  if (passed !== total) process.exit(1);
}

run().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
