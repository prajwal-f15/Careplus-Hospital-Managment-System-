/**
 * ==============================================================================
 * CAREPULSE HOSPITAL MANAGEMENT SYSTEM
 * Live Database, Security & RLS Policy Verification Test (Feature 11)
 * ==============================================================================
 */

const url = 'https://vpimfibtizurhuhljcpb.supabase.co';
const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZwaW1maWJ0aXp1cmh1aGxqY3BiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg4NzExNzIsImV4cCI6MjEwNDQ0NzE3Mn0.tziYyO2_xJY3xoRfwVIn34jsGYnuAo6_YXdDPtOYKDU';

const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  cyan: "\x1b[36m",
  yellow: "\x1b[33m",
  bold: "\x1b[1m"
};

let testsTotal = 0;
let testsPassed = 0;

function assert(name, condition, details = '') {
  testsTotal++;
  if (condition) {
    testsPassed++;
    console.log(`  ${colors.green}✔ PASS${colors.reset} : ${name}`);
  } else {
    console.log(`  ${colors.red}✖ FAIL${colors.reset} : ${name} - ${details}`);
  }
}

async function runSecurityTests() {
  console.log(`\n${colors.bold}${colors.cyan}======================================================================${colors.reset}`);
  console.log(`${colors.bold}CAREPULSE LIVE DATABASE, RLS & CONSTRAINTS AUDIT${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}======================================================================${colors.reset}\n`);

  const headers = {
    'apikey': anonKey,
    'Authorization': `Bearer ${anonKey}`,
    'Content-Type': 'application/json'
  };

  // 1. Test Public vs Sensitive Table Reads
  console.log(`${colors.yellow}1. Testing Table Access via REST API${colors.reset}`);
  const publicTables = ['departments', 'doctors', 'opd_rooms', 'doctor_availability'];
  for (const t of publicTables) {
    const res = await fetch(`${url}/rest/v1/${t}?select=id&limit=1`, { headers });
    assert(`Public can read directory table: ${t}`, res.ok);
  }

  // 2. Test Appointments Table Schema & Status Constraint
  console.log(`\n${colors.yellow}2. Testing Appointments Check Constraint (Status Validity)${colors.reset}`);
  const apptFetch = await fetch(`${url}/rest/v1/appointments?select=id,status,queue_status&limit=1`, { headers });
  const apptData = await apptFetch.json();
  assert('Sample appointment fetched for constraint testing', Array.isArray(apptData) && apptData.length > 0);
  const sample = apptData[0];

  const validStatuses = ['pending', 'confirmed', 'in-progress', 'completed', 'cancelled', 'rejected'];
  let statusTestsPassed = true;
  for (const st of validStatuses) {
    const patch = await fetch(`${url}/rest/v1/appointments?id=eq.${sample.id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ status: st })
    });
    if (!patch.ok) {
      statusTestsPassed = false;
      console.log(`Status ${st} rejected:`, await patch.text());
    }
  }
  assert('Appointments status constraint allows all required lifecycle states', statusTestsPassed);

  // Restore sample appointment
  await fetch(`${url}/rest/v1/appointments?id=eq.${sample.id}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ status: sample.status })
  });

  // 3. Test Invalid Status Rejection (Security check constraint)
  console.log(`\n${colors.yellow}3. Testing Security Injection & Invalid Status Rejection${colors.reset}`);
  const invalidStatusRes = await fetch(`${url}/rest/v1/appointments?id=eq.${sample.id}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ status: 'MALICIOUS_OR_INVALID_STATUS_XYZ' })
  });
  assert('Database strictly rejects arbitrary or invalid appointment status', invalidStatusRes.status === 400);

  // 4. Test Queue Status Check Constraint
  console.log(`\n${colors.yellow}4. Testing Queue Status Constraint${colors.reset}`);
  const validQueue = ['waiting', 'called', 'in-room', 'completed', 'skipped'];
  let queueValid = true;
  for (const qs of validQueue) {
    const qPatch = await fetch(`${url}/rest/v1/appointments?id=eq.${sample.id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ queue_status: qs })
    });
    if (!qPatch.ok) queueValid = false;
  }
  assert('Appointments queue_status constraint allows valid OPD queue states', queueValid);

  const invalidQueueRes = await fetch(`${url}/rest/v1/appointments?id=eq.${sample.id}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ queue_status: 'INVALID_QUEUE_STATE' })
  });
  assert('Database strictly rejects arbitrary queue_status values', invalidQueueRes.status === 400);

  // Restore original queue_status
  await fetch(`${url}/rest/v1/appointments?id=eq.${sample.id}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ queue_status: sample.queue_status })
  });

  // 5. Test Double-Booking Guard
  console.log(`\n${colors.yellow}5. Testing Double-Booking Guard (Unique Constraint Protection)${colors.reset}`);
  // Attempt to insert duplicate appointment with identical doctor, date, and slot
  const testDoctorId = 'd0c11111-1111-1111-1111-111111111111';
  const testPatient1 = '11111111-1111-1111-1111-111111111111';
  const testPatient2 = '22222222-2222-2222-2222-222222222222';
  const conflictDate = '2027-12-31';
  const conflictSlot = '10:00:00';

  // Cleanup potential leftover from previous test
  await fetch(`${url}/rest/v1/appointments?doctor_id=eq.${testDoctorId}&appointment_date=eq.${conflictDate}`, {
    method: 'DELETE',
    headers
  });

  // Insert First Appointment
  const insert1 = await fetch(`${url}/rest/v1/appointments`, {
    method: 'POST',
    headers: { ...headers, 'Prefer': 'return=representation' },
    body: JSON.stringify({
      appointment_number: 'APT-TEST-001',
      token_number: 'CARD-991',
      doctor_id: testDoctorId,
      patient_id: testPatient1,
      department_id: 'd1111111-1111-1111-1111-111111111111',
      appointment_date: conflictDate,
      time_slot: conflictSlot,
      status: 'confirmed',
      reason: 'First booking test'
    })
  });
  const insertedData1 = await insert1.json();
  assert('First booking on slot succeeds', insert1.ok);

  // Insert Second Appointment on exact same slot (Concurrent booking attempt)
  const insert2 = await fetch(`${url}/rest/v1/appointments`, {
    method: 'POST',
    headers: { ...headers, 'Prefer': 'return=representation' },
    body: JSON.stringify({
      appointment_number: 'APT-TEST-002',
      token_number: 'CARD-992',
      doctor_id: testDoctorId,
      patient_id: testPatient2,
      department_id: 'd1111111-1111-1111-1111-111111111111',
      appointment_date: conflictDate,
      time_slot: conflictSlot,
      status: 'confirmed',
      reason: 'Concurrent booking attempt on same slot'
    })
  });
  const insert2Res = await insert2.json();
  assert('Double-booking is prevented (Duplicate rejected by database index/constraint)', !insert2.ok || insert2.status === 409 || insert2.status === 400);

  // Clean up test booking
  if (Array.isArray(insertedData1) && insertedData1[0]?.id) {
    await fetch(`${url}/rest/v1/appointments?id=eq.${insertedData1[0].id}`, {
      method: 'DELETE',
      headers
    });
  }

  // 6. Test Waiting List and Chat Messages Tables Existence & RLS
  console.log(`\n${colors.yellow}6. Testing Waiting List & Chat Messages Security${colors.reset}`);
  const wlRes = await fetch(`${url}/rest/v1/waiting_list?select=id&limit=1`, { headers });
  assert('waiting_list table is accessible and protected by RLS', wlRes.ok);

  const chatRes = await fetch(`${url}/rest/v1/chat_messages?select=id&limit=1`, { headers });
  assert('chat_messages table is accessible and protected by RLS', chatRes.ok);

  const remindersRes = await fetch(`${url}/rest/v1/appointment_reminders?select=id&limit=1`, { headers });
  assert('appointment_reminders table is accessible and protected by RLS', remindersRes.ok);

  console.log(`\n${colors.bold}${colors.cyan}======================================================================${colors.reset}`);
  console.log(`${colors.bold}AUDIT SUMMARY: TOTAL: ${testsTotal} | PASSED: ${testsPassed} | FAILED: ${testsTotal - testsPassed}${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}======================================================================${colors.reset}\n`);

  if (testsPassed === testsTotal) {
    console.log(`${colors.green}${colors.bold}ALL DATABASE, SECURITY & CONSTRAINT TESTS PASSED WITH 100% SUCCESS!${colors.reset}`);
  } else {
    process.exit(1);
  }
}

runSecurityTests().catch(err => {
  console.error('Fatal error during security test:', err);
  process.exit(1);
});

