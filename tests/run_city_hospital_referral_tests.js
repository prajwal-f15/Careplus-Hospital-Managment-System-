/**
 * ==============================================================================
 * CAREPULSE HOSPITAL MANAGEMENT SYSTEM
 * Master Test Runner for City-wise Discovery, Hospital Registration & Referral Engine
 * ==============================================================================
 */

const { execSync } = require('child_process');
const path = require('path');

const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  cyan: "\x1b[36m",
  yellow: "\x1b[33m",
  bold: "\x1b[1m"
};

const suites = [
  { name: 'Phase 1: Database Schema, Tables, Constraints & Migration DDL', script: 'test_city_hospital_referral_schema.js' },
  { name: 'Phase 2: Location Directory & Geolocation Haversine Engine', script: 'test_location_directory.js' },
  { name: 'Phase 3: Independent Registration & Admin Verification', script: 'test_registration_verification.js' },
  { name: 'Phase 4: All-India Patient Search, Hospital & Doctor Profiles', script: 'test_patient_search_profiles.js' },
  { name: 'Phase 5: Cross-City Referral System (Yavatmal ↔ Mumbai)', script: 'test_cross_city_referral_system.js' },
  { name: 'Phase 6 & 7: Appointment Integration, Teleconsultation & Security', script: 'test_appointment_referral_integration.js' },
  { name: 'Phase 8: Clinical Departments Directory & Specialist Allocation', script: 'test_clinical_departments.js' },
  { name: 'Phase 9: Hospital Registration & Auth Error Guard', script: 'test_hospital_registration_auth.js' },
  { name: 'Phase 10: Admin Hospitals Directory & Multi-Entity Verification', script: 'test_admin_hospitals_and_verification.js' },
  { name: 'Mobile Responsiveness & Viewport Audit (42 HTML Pages)', script: 'audit_mobile_responsive.js' }
];

console.log(`\n${colors.bold}${colors.cyan}======================================================================${colors.reset}`);
console.log(`${colors.bold}CAREPULSE: ALL-INDIA DISCOVERY & REFERRAL ENGINE TEST SUITE RUNNER${colors.reset}`);
console.log(`${colors.bold}${colors.cyan}======================================================================${colors.reset}\n`);

let passedCount = 0;

for (const suite of suites) {
  process.stdout.write(`>>> RUNNING: ${suite.name}... `);
  try {
    const fullPath = path.join(__dirname, suite.script);
    execSync(`node "${fullPath}"`, { stdio: 'pipe' });
    console.log(`${colors.green}${colors.bold}✔ PASSED${colors.reset}`);
    passedCount++;
  } catch (err) {
    console.log(`${colors.red}${colors.bold}✖ FAILED${colors.reset}`);
    if (err.stdout) console.log(err.stdout.toString());
    if (err.stderr) console.error(err.stderr.toString());
    process.exit(1);
  }
}

console.log(`\n${colors.bold}${colors.cyan}======================================================================${colors.reset}`);
console.log(`${colors.green}${colors.bold}ALL ${passedCount} OF ${suites.length} SUITES PASSED WITH 100% SUCCESS RATE!${colors.reset}`);
console.log(`${colors.bold}${colors.cyan}======================================================================${colors.reset}\n`);

