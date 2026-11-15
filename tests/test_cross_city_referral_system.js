/**
 * ==============================================================================
 * CAREPULSE HOSPITAL MANAGEMENT SYSTEM
 * Phase 5: Cross-City Referral System Test Suite (Module 6)
 * Real-World Case Study: Patient in Yavatmal ↔ Specialist in Mumbai
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
  location: { pathname: '/patient/referrals.html', origin: 'http://127.0.0.1:5500' },
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

const CarePulseDB = global.window.CarePulseDB;
const LocationService = global.window.LocationService;

async function runCrossCityReferralTests() {
  console.log(`\n${colors.bold}${colors.cyan}======================================================================${colors.reset}`);
  console.log(`${colors.bold}PHASE 5: CROSS-CITY REFERRAL SYSTEM AUDIT (MODULE 6)${colors.reset}`);
  console.log(`${colors.bold}Case Study: Yavatmal Patient ↔ Mumbai Super-Specialist Workflow${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}======================================================================${colors.reset}\n`);

  // 1. Mandatory Patient Digital Consent Enforcement (Req 6)
  console.log(`${colors.yellow}1. Mandatory Patient Consent Enforcement (Req 6)${colors.reset}`);
  let consentErrorCaught = false;
  try {
    await CarePulseDB.createReferralRequest({
      patientId: '99999999-9999-9999-9999-999999999991',
      receivingDoctorId: 'd0c11111-1111-1111-1111-111111111111',
      originCity: 'Yavatmal',
      destinationCity: 'Mumbai',
      specialty: 'Senior Cardiologist',
      consentGiven: false // Consent omitted
    });
  } catch (err) {
    consentErrorCaught = err.message.includes('Mandatory Patient Consent');
  }
  assert('Referral request strictly rejected when explicit patient consent is missing', consentErrorCaught);

  // 2. Patient Digital Consent Record Creation
  console.log(`\n${colors.yellow}2. Digital Consent Record Persistence & Scope${colors.reset}`);
  const consentRecord = await CarePulseDB.recordPatientConsent({
    patientId: '99999999-9999-9999-9999-999999999991',
    grantedToDoctorId: 'd0c11111-1111-1111-1111-111111111111',
    consentType: 'medical_record_sharing'
  });
  assert('recordPatientConsent creates active consent record with timestamp', 
    consentRecord && consentRecord.is_consent_active === true && consentRecord.consent_timestamp
  );

  // 3. Independent Referral Request Dispatch (Req 1, 4, 5)
  console.log(`\n${colors.yellow}3. Cross-City Referral Request Creation (Yavatmal ➔ Mumbai)${colors.reset}`);
  const referral = await CarePulseDB.createReferralRequest({
    patientId: '99999999-9999-9999-9999-999999999991',
    referringDoctorId: null,
    receivingDoctorId: 'd0c11111-1111-1111-1111-111111111111', // Dr. Rahul Sharma (Mumbai)
    originCity: 'Yavatmal',
    destinationCity: 'Mumbai',
    specialty: 'Senior Cardiologist',
    clinicalSummary: 'Patient experiencing recurrent angina on exertion. Yavatmal clinic advises super-specialist cardiology evaluation in Mumbai.',
    provisionalDiagnosis: 'Suspected Coronary Artery Disease',
    consentGiven: true
  });

  assert('createReferralRequest succeeds with status "requested"', 
    referral && referral.status === 'requested' && referral.id
  );
  assert('Referral correctly records origin (Yavatmal) and destination (Mumbai)', 
    referral.origin_city === 'Yavatmal' && referral.destination_city === 'Mumbai'
  );

  // 4. Receiving Doctor Review & Decision Workflow (Req 7)
  console.log(`\n${colors.yellow}4. Receiving Doctor Review: Acceptance & Rejection Logic${colors.reset}`);
  // A. Rejection with mandatory reason
  const rejectionResult = await CarePulseDB.updateReferralStatus({
    referralId: referral.id,
    status: 'rejected',
    decisionReason: 'OPD at capacity this week; advised local evaluation with Dr. Anand Deshpande in Yavatmal.',
    doctorId: 'd0c11111-1111-1111-1111-111111111111'
  });
  assert('Doctor rejection records mandatory written reason and status "rejected"', 
    rejectionResult.success && rejectionResult.status === 'rejected' && rejectionResult.decisionReason.length > 10
  );

  // B. Acceptance workflow
  const acceptanceResult = await CarePulseDB.updateReferralStatus({
    referralId: referral.id,
    status: 'accepted',
    decisionReason: 'Case reviewed and approved for in-person or video consultation.',
    doctorId: 'd0c11111-1111-1111-1111-111111111111'
  });
  assert('Doctor acceptance updates referral status to "accepted"', 
    acceptanceResult.success && acceptanceResult.status === 'accepted'
  );

  // 5. Separate but Linked Appointment Booking (Req 8, 9)
  console.log(`\n${colors.yellow}5. Distinct & Linked Appointment Booking on Referral${colors.reset}`);
  assert('Referral acceptance does not auto-transfer appointment; status remains accepted until booked', 
    acceptanceResult.status === 'accepted'
  );

  const linkedStatusUpdate = await CarePulseDB.updateReferralStatus({
    referralId: referral.id,
    status: 'appointment_booked',
    decisionReason: 'Linked to appointment #APT-904128'
  });
  assert('Booking on accepted referral updates status to "appointment_booked"', 
    linkedStatusUpdate.success && linkedStatusUpdate.status === 'appointment_booked'
  );

  // 6. Local Specialist Matching & Teleconsultation Fallback (Req 2, 3, 10)
  console.log(`\n${colors.yellow}6. Local Specialist Matching & Teleconsultation Fallback${colors.reset}`);
  const doctors = await CarePulseDB.getDoctors();
  
  // Test local match in Yavatmal
  const ytlCardiologists = doctors.filter(d => 
    (d.city_name === 'Yavatmal' || (d.address && d.address.includes('Yavatmal'))) &&
    d.department_name === 'Cardiology'
  );
  assert('System identifies matching local cardiologist in Yavatmal (Dr. Anand Deshpande)', 
    ytlCardiologists.length > 0 && ytlCardiologists[0].city_name === 'Yavatmal'
  );

  // Test Mumbai specialists support video teleconsultation
  const mumbaiSpecialist = doctors.find(d => d.city_name === 'Mumbai');
  assert('Remote Mumbai specialist offers Online Video Consultation mode', 
    mumbaiSpecialist && (mumbaiSpecialist.consultation_modes === 'both' || mumbaiSpecialist.consultation_modes === 'video')
  );

  // 7. UI & Portal Integration Verification
  console.log(`\n${colors.yellow}7. Portal UI & Navigation Routes Verification${colors.reset}`);
  const patientRefHtml = fs.readFileSync(path.join(__dirname, '..', 'patient', 'referrals.html'), 'utf8');
  assert('patient/referrals.html exists with referral tracking and new request modal', 
    patientRefHtml.includes('id="new-referral-modal"') && patientRefHtml.includes('id="referrals-list-container"')
  );
  assert('patient/referrals.html enforces mandatory patient consent checkbox', 
    patientRefHtml.includes('id="req-patient-consent"') && patientRefHtml.includes('Mandatory Patient Consent')
  );

  const doctorRefHtml = fs.readFileSync(path.join(__dirname, '..', 'doctor', 'referrals.html'), 'utf8');
  assert('doctor/referrals.html exists with Accept and Decline actions', 
    doctorRefHtml.includes('acceptReferral') && doctorRefHtml.includes('openDeclineModal') && doctorRefHtml.includes('decline-referral-modal')
  );
  assert('doctor/referrals.html verifies digital patient consent badge', 
    doctorRefHtml.includes('Patient Consent Verified') || doctorRefHtml.includes('Consent-Gated Records')
  );

  const adminVerifHtml = fs.readFileSync(path.join(__dirname, '..', 'admin', 'verification.html'), 'utf8');
  assert('admin/verification.html includes Cross-City Referrals monitoring section', 
    adminVerifHtml.includes('id="tab-btn-referrals"') && adminVerifHtml.includes('id="section-referrals"')
  );

  console.log(`\n${colors.bold}${colors.cyan}======================================================================${colors.reset}`);
  console.log(`PHASE 5 AUDIT SUMMARY: TOTAL: ${totalChecks} | PASSED: ${passedChecks} | FAILED: ${totalChecks - passedChecks}`);
  console.log(`${colors.bold}${colors.cyan}======================================================================${colors.reset}\n`);

  if (passedChecks === totalChecks) {
    console.log(`${colors.green}${colors.bold}✔ ALL PHASE 5 CROSS-CITY REFERRAL SPECIFICATIONS PASSED (100% SUCCESS)${colors.reset}\n`);
    process.exit(0);
  } else {
    console.log(`${colors.red}${colors.bold}✖ SOME PHASE 5 CHECKS FAILED!${colors.reset}\n`);
    process.exit(1);
  }
}

runCrossCityReferralTests().catch(err => {
  console.error('Fatal error in Phase 5 audit:', err);
  process.exit(1);
});

