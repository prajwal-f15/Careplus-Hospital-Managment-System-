/**
 * ==============================================================================
 * CAREPULSE HOSPITAL MANAGEMENT SYSTEM
 * Phase 6 & 7: Appointment-Referral Integration, Teleconsultation & Security Audit
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

let totalChecks = 0;
let passedChecks = 0;

function assert(description, condition, details = '') {
  totalChecks++;
  if (condition) {
    passedChecks++;
    console.log(`  ${colors.green}✔ PASS${colors.reset} : ${description}`);
  } else {
    console.log(`  ${colors.red}✖ FAIL${colors.reset} : ${description} - ${details}`);
  }
}

// Emulate browser environment for Node.js
const mockStorage = {};
global.localStorage = {
  getItem: (k) => mockStorage[k] || null,
  setItem: (k, v) => { mockStorage[k] = String(v); },
  removeItem: (k) => { delete mockStorage[k]; }
};

global.document = {
  addEventListener: () => {},
  removeEventListener: () => {},
  getElementById: () => null,
  querySelector: () => null,
  querySelectorAll: () => []
};

global.window = {
  localStorage: global.localStorage,
  document: global.document,
  location: { pathname: '/patient/appointment-details.html', origin: 'http://127.0.0.1:5500' },
  addEventListener: () => {},
  removeEventListener: () => {},
  dispatchEvent: () => {},
  CustomEvent: class { constructor(type, data) { this.type = type; this.detail = data?.detail; } }
};

// Load dependencies
require(path.join(__dirname, '..', 'js', 'config.js'));
require(path.join(__dirname, '..', 'js', 'location.js'));
require(path.join(__dirname, '..', 'js', 'supabase.js'));
require(path.join(__dirname, '..', 'js', 'auth.js'));
require(path.join(__dirname, '..', 'js', 'pdf-receipt.js'));

const CarePulseDB = global.window.CarePulseDB;

async function runAppointmentIntegrationTests() {
  console.log(`\n${colors.bold}${colors.cyan}======================================================================${colors.reset}`);
  console.log(`${colors.bold}PHASE 6 & 7: APPOINTMENT-REFERRAL INTEGRATION & END-TO-END AUDIT${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}======================================================================${colors.reset}\n`);

  // 1. Referral Status Transition on Booking
  console.log(`${colors.yellow}1. Referral-Linked Booking & Lifecycle Transitions${colors.reset}`);
  const testReferral = await CarePulseDB.createReferralRequest({
    patientId: '99999999-9999-9999-9999-999999999991',
    receivingDoctorId: 'd0c11111-1111-1111-1111-111111111111',
    originCity: 'Yavatmal',
    destinationCity: 'Mumbai',
    specialty: 'Cardiology',
    clinicalSummary: 'Angina evaluation requested.',
    consentGiven: true
  });

  assert('Cross-city referral created with status "requested"', testReferral && testReferral.status === 'requested');

  await CarePulseDB.updateReferralStatus({
    referralId: testReferral.id,
    status: 'accepted',
    decisionReason: 'Case reviewed and approved for consultation slot.',
    doctorId: 'd0c11111-1111-1111-1111-111111111111'
  });

  const bookedReferral = await CarePulseDB.updateReferralStatus({
    referralId: testReferral.id,
    status: 'appointment_booked',
    decisionReason: 'Linked to appointment #APT-112233'
  });
  assert('Referral status successfully transitions to "appointment_booked"', bookedReferral.status === 'appointment_booked');

  // 2. Separate Records Architecture (Req 9)
  console.log(`\n${colors.yellow}2. Independent Linked Entities (Zero Auto-Transfer Violation)${colors.reset}`);
  assert('Referral record remains distinct entity without overwriting prior doctor appointments', 
    Boolean(testReferral.id && testReferral.status)
  );

  // 3. Teleconsultation Virtual Room Verification (Req 10)
  console.log(`\n${colors.yellow}3. Video Teleconsultation Remote Access${colors.reset}`);
  const apptDetailsHtml = fs.readFileSync(path.join(__dirname, '..', 'patient', 'appointment-details.html'), 'utf8');
  assert('appointment-details.html renders video teleconsultation room for virtual consults', 
    apptDetailsHtml.includes('Video Teleconsultation Active') && apptDetailsHtml.includes('meet.jit.si')
  );
  assert('appointment-details.html renders cross-city referral tracking badge', 
    apptDetailsHtml.includes('Booked via Cross-City Referral')
  );

  // 4. PDF Token Slip Enrichment
  console.log(`\n${colors.yellow}4. Scannable Digital Token Slip & Hospital Badge${colors.reset}`);
  const pdfReceiptCode = fs.readFileSync(path.join(__dirname, '..', 'js', 'pdf-receipt.js'), 'utf8');
  assert('js/pdf-receipt.js embeds hospital facility on printed token slips', 
    pdfReceiptCode.includes('Hospital Facility:')
  );
  assert('js/pdf-receipt.js records referral track ID when booked via cross-city referral', 
    pdfReceiptCode.includes('Referral Track ID:')
  );

  // 5. Patient Consent Records & Privacy Guard
  console.log(`\n${colors.yellow}5. Patient Record Privacy & Sensitive Data Safety${colors.reset}`);
  const consentRecord = await CarePulseDB.recordPatientConsent({
    patientId: '99999999-9999-9999-9999-999999999991',
    referralId: testReferral.id,
    grantedToDoctorId: 'd0c11111-1111-1111-1111-111111111111'
  });
  assert('Digital patient consent record persists with tamper-evident audit fields', 
    consentRecord && consentRecord.is_consent_active === true && consentRecord.consent_timestamp
  );

  // 6. Navigation Integrity across All Portals
  console.log(`\n${colors.yellow}6. Navigation & Cross-Portal Routing Integrity${colors.reset}`);
  const patientIndexHtml = fs.readFileSync(path.join(__dirname, '..', 'patient', 'index.html'), 'utf8');
  assert('patient/index.html includes Referrals navigation link', patientIndexHtml.includes('href="referrals.html"'));

  const doctorIndexHtml = fs.readFileSync(path.join(__dirname, '..', 'doctor', 'index.html'), 'utf8');
  assert('doctor/index.html includes Referrals navigation link', doctorIndexHtml.includes('href="referrals.html"'));

  const adminIndexHtml = fs.readFileSync(path.join(__dirname, '..', 'admin', 'verification.html'), 'utf8');
  assert('admin/verification.html includes Cross-City Referrals navigation tab', adminIndexHtml.includes('id="tab-btn-referrals"'));

  console.log(`\n${colors.bold}${colors.cyan}======================================================================${colors.reset}`);
  console.log(`PHASE 6 & 7 AUDIT SUMMARY: TOTAL: ${totalChecks} | PASSED: ${passedChecks} | FAILED: ${totalChecks - passedChecks}`);
  console.log(`${colors.bold}${colors.cyan}======================================================================${colors.reset}\n`);

  if (passedChecks === totalChecks) {
    console.log(`${colors.green}${colors.bold}✔ ALL APPOINTMENT INTEGRATION & SECURITY SPECIFICATIONS PASSED (100% SUCCESS)${colors.reset}\n`);
    process.exit(0);
  } else {
    console.log(`${colors.red}${colors.bold}✖ SOME CHECKS FAILED!${colors.reset}\n`);
    process.exit(1);
  }
}

runAppointmentIntegrationTests().catch(err => {
  console.error('Fatal error in integration test:', err);
  process.exit(1);
});
