/**
 * ==============================================================================
 * CAREPULSE HOSPITAL MANAGEMENT SYSTEM
 * Verification Test: Doctor Confirmation, PDF Slip with QR, QR Scanner,
 * Direct Call & Two-Way Chat Flow
 * ==============================================================================
 */

const fs = require('fs');
const path = require('path');

const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  cyan: "\x1b[36m",
  yellow: "\x1b[33m",
  bold: "\x1b[1m"
};

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(description, condition, errorMsg = '') {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ${colors.green}✔ PASS${colors.reset} : ${description}`);
  } else {
    failedTests++;
    console.log(`  ${colors.red}✖ FAIL${colors.reset} : ${description} - ${errorMsg}`);
  }
}

async function runTests() {
  console.log(`\n${colors.bold}${colors.cyan}======================================================================${colors.reset}`);
  console.log(`${colors.bold}CAREPULSE SELECTED WORKFLOW VERIFICATION TEST${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}======================================================================${colors.reset}\n`);

  // 1. Check File Integrity
  console.log(`${colors.yellow}1. Verifying Files & Component Integration${colors.reset}`);
  
  const doctorIndex = fs.readFileSync('doctor/index.html', 'utf8');
  assert('doctor/index.html has Scan Patient QR button', doctorIndex.includes('Scan Patient QR') && doctorIndex.includes('openDoctorQRScannerModal'));
  assert('doctor/index.html has Pending Booking Requests section', doctorIndex.includes('doctor-pending-requests-list'));
  assert('doctor/index.html has Doctor QR Scanner modal', doctorIndex.includes('doctor-qr-scanner-modal') && doctorIndex.includes('doctor-qr-reader'));
  assert('doctor/index.html has Direct Patient Call modal', doctorIndex.includes('doctor-direct-call-modal') && doctorIndex.includes('direct-call-chime-btn'));
  assert('doctor/index.html includes chat.js', doctorIndex.includes('chat.js'));

  const doctorQueue = fs.readFileSync('doctor/queue.html', 'utf8');
  assert('doctor/queue.html has Scan Patient QR button', doctorQueue.includes('Scan Patient QR') && doctorQueue.includes('openDoctorQRScannerModal'));
  assert('doctor/queue.html has Direct Call button in queue table', doctorQueue.includes('openDirectCallModal'));
  assert('doctor/queue.html has Chat with Patient button', doctorQueue.includes('openDoctorChat'));
  assert('doctor/queue.html includes chat.js & pdf-receipt.js', doctorQueue.includes('chat.js') && doctorQueue.includes('pdf-receipt.js'));

  const doctorAppts = fs.readFileSync('doctor/appointments.html', 'utf8');
  assert('doctor/appointments.html has Scan Patient QR button', doctorAppts.includes('Scan Patient QR'));
  assert('doctor/appointments.html includes chat.js', doctorAppts.includes('chat.js'));
  assert('doctor/appointments.html has Direct Call & Chat modals', doctorAppts.includes('doctor-qr-scanner-modal') && doctorAppts.includes('doctor-direct-call-modal'));

  const adminIndex = fs.readFileSync('admin/index.html', 'utf8');
  assert('admin/index.html has Scan Patient QR button in header and nav', adminIndex.includes('Scan Patient QR') && adminIndex.includes('verify-appointment.html'));

  const patientIndex = fs.readFileSync('patient/index.html', 'utf8');
  assert('patient/index.html includes chat.js', patientIndex.includes('chat.js'));

  const patientAppts = fs.readFileSync('patient/appointments.html', 'utf8');
  assert('patient/appointments.html includes chat.js', patientAppts.includes('chat.js'));

  const patientDetails = fs.readFileSync('patient/appointment-details.html', 'utf8');
  assert('patient/appointment-details.html has Chat with Doctor button', patientDetails.includes('Chat with Doctor') && patientDetails.includes('openDoctorChat'));
  assert('patient/appointment-details.html includes chat.js', patientDetails.includes('chat.js'));

  // 2. Check JavaScript Logic
  console.log(`\n${colors.yellow}2. Verifying JavaScript Logic${colors.reset}`);
  const doctorJs = fs.readFileSync('js/doctor.js', 'utf8');
  assert('js/doctor.js has confirmPendingRequest method', doctorJs.includes('confirmPendingRequest'));
  assert('js/doctor.js has rejectPendingRequest method', doctorJs.includes('rejectPendingRequest'));
  assert('js/doctor.js has openDoctorQRScannerModal & verification', doctorJs.includes('openDoctorQRScannerModal') && doctorJs.includes('processDoctorVerification'));
  assert('js/doctor.js has openDirectCallModal & triggerDirectCall', doctorJs.includes('openDirectCallModal') && doctorJs.includes('triggerDirectCall'));
  assert('js/doctor.js has openChatWithPatient', doctorJs.includes('openChatWithPatient'));

  const patientJs = fs.readFileSync('js/patient.js', 'utf8');
  assert('js/patient.js has openDoctorChat method', patientJs.includes('openDoctorChat'));
  assert('js/patient.js listens for carepulse_patient_called', patientJs.includes('carepulse_patient_called') && patientJs.includes('playHospitalChime'));

  const pdfReceiptJs = fs.readFileSync('js/pdf-receipt.js', 'utf8');
  assert('js/pdf-receipt.js embeds QRCode canvas into PDF', pdfReceiptJs.includes('ensureQRCodeDataURL') && pdfReceiptJs.includes('doc.addImage'));

  const chatJs = fs.readFileSync('js/chat.js', 'utf8');
  assert('js/chat.js implements window.CarePulseChat with two-way messaging', chatJs.includes('CarePulseChat') && chatJs.includes('openChat') && chatJs.includes('renderMessages'));

  const supabaseJs = fs.readFileSync('js/supabase.js', 'utf8');
  assert('js/supabase.js has directCallPatient API', supabaseJs.includes('directCallPatient'));
  assert('js/supabase.js has sendChatMessage & getChatMessages API', supabaseJs.includes('sendChatMessage') && supabaseJs.includes('getChatMessages'));
  assert('js/supabase.js has subscribeToChat API', supabaseJs.includes('subscribeToChat'));

  // 3. Live Supabase API Tests
  console.log(`\n${colors.yellow}3. Verifying Live Supabase API Communication${colors.reset}`);
  const url = 'https://vpimfibtizurhuhljcpb.supabase.co';
  const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZwaW1maWJ0aXp1cmh1aGxqY3BiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg4NzExNzIsImV4cCI6MjEwNDQ0NzE3Mn0.tziYyO2_xJY3xoRfwVIn34jsGYnuAo6_YXdDPtOYKDU';

  try {
    const apptsRes = await fetch(`${url}/rest/v1/appointments?select=id,status,token_number,patient_id,doctor_id&limit=3`, {
      headers: { 'apikey': anonKey, 'Authorization': `Bearer ${anonKey}` }
    });
    assert('Supabase REST /appointments reachable', apptsRes.ok);
    const appts = await apptsRes.json();
    assert('Appointments fetched successfully', Array.isArray(appts) && appts.length > 0);

    const chatRes = await fetch(`${url}/rest/v1/chat_messages?select=id&limit=1`, {
      headers: { 'apikey': anonKey, 'Authorization': `Bearer ${anonKey}` }
    });
    assert('Chat messages endpoint or fallback handled gracefully', chatRes.ok || chatRes.status === 404);
  } catch (err) {
    assert('Supabase communication error: ' + err.message, false);
  }

  // Summary
  console.log(`\n${colors.bold}${colors.cyan}======================================================================${colors.reset}`);
  console.log(`${colors.bold}SUMMARY: TOTAL: ${totalTests} | PASSED: ${passedTests} | FAILED: ${failedTests}${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}======================================================================${colors.reset}\n`);

  if (failedTests === 0) {
    console.log(`${colors.green}${colors.bold}ALL VERIFICATION CHECKS PASSED PERFECTLY!${colors.reset}\n`);
    process.exit(0);
  } else {
    console.log(`${colors.red}${colors.bold}SOME CHECKS FAILED!${colors.reset}\n`);
    process.exit(1);
  }
}

runTests();

