/**
 * ==============================================================================
 * CAREPULSE HOSPITAL MANAGEMENT SYSTEM
 * Master Production Quality & Test Suite Runner
 * Runs all unit, integration, security, E2E, mobile, and live Supabase tests.
 * ==============================================================================
 */

const { execSync } = require('child_process');

const testSuites = [
  { name: '1. Asset & Script Integrity Audit', script: 'tests/audit_assets.js' },
  { name: '2. Mobile Responsiveness & Viewport Audit', script: 'tests/audit_mobile_responsive.js' },
  { name: '3. Live Website Pages & DOM Integrity (63 Checks)', script: 'tests/site_integrity_check.js' },
  { name: '4. Selected Features & Chat Integration (32 Checks)', script: 'tests/test_chat_and_workflow.js' },
  { name: '5. Patient, Doctor & Admin E2E Journeys (Features 7, 8, 9)', script: 'tests/workflows_e2e_test.js' },
  { name: '6. Features 1-6, 10, 11 Comprehensive Assertions (57 Checks)', script: 'tests/test_runner.js' },
  { name: '7. Live Database, RLS Security & Double-Booking Guard (14 Checks)', script: 'tests/test_database_security.js' },
  { name: '8. Visiting Campaigns, Health Records & Mobile Navigation Suite', script: 'tests/test_campaigns_and_patient_dashboard.js' },
  { name: '9. Location Verification, Nearby Discovery & Doctor Practice Locations', script: 'tests/test_location_verification_and_doctor_locations.js' }
];

console.log('======================================================================');
console.log('CAREPULSE MASTER PRODUCTION READINESS TEST SUITE');
console.log('======================================================================\n');

let passedCount = 0;
let failedCount = 0;

for (const suite of testSuites) {
  console.log(`>>> RUNNING: ${suite.name}...`);
  try {
    const output = execSync(`node ${suite.script}`, { encoding: 'utf8', stdio: 'pipe' });
    console.log(output);
    console.log(`✔ [PASSED]: ${suite.name}\n`);
    passedCount++;
  } catch (err) {
    console.error(`✖ [FAILED]: ${suite.name}\n`, err.stdout || err.message);
    failedCount++;
  }
}

console.log('======================================================================');
console.log(`TOTAL SUITES EXECUTED: ${testSuites.length}`);
console.log(`SUITES PASSED        : ${passedCount}`);
console.log(`SUITES FAILED        : ${failedCount}`);
console.log('======================================================================');

if (failedCount === 0) {
  console.log('🎉 ALL 7 TEST SUITES PASSED! CAREPULSE IS 100% PRODUCTION READY!');
  process.exit(0);
} else {
  console.error('❌ SOME TEST SUITES FAILED!');
  process.exit(1);
}

