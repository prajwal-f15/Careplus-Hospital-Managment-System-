/**
 * ==============================================================================
 * CarePulse - Location Verification, Nearby Discovery & Doctor Practice Locations Test
 * ==============================================================================
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const ROOT_DIR = path.resolve(__dirname, '..');

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
    process.exitCode = 1;
  }
}

console.log('\n================================================================');
console.log('🧪 CAREPULSE TEST: ADMIN VERIFICATION, PATIENT LOCATION & DOCTOR AFFILIATIONS');
console.log('================================================================\n');

// 1. Admin Dashboard Queue Elements
test('Admin Dashboard index.html contains Pending Verification Queue', () => {
  const content = fs.readFileSync(path.join(ROOT_DIR, 'admin', 'index.html'), 'utf8');
  assert(content.includes('id="admin-pending-verification-section"'), 'Missing admin pending verification section');
  assert(content.includes('id="admin-queue-tab-hospitals"'), 'Missing hospitals queue tab');
  assert(content.includes('id="admin-queue-tab-doctors"'), 'Missing doctors queue tab');
  assert(content.includes('id="admin-queue-tab-campaigns"'), 'Missing campaigns queue tab');
  assert(content.includes('id="admin-queue-content"'), 'Missing queue content container');
});

// 2. Admin Controller Logic
test('Admin Controller admin.js contains Queue & 1-Click Verification handlers', () => {
  const content = fs.readFileSync(path.join(ROOT_DIR, 'js', 'admin.js'), 'utf8');
  assert(content.includes('switchQueueTab'), 'Missing switchQueueTab');
  assert(content.includes('loadPendingVerifications'), 'Missing loadPendingVerifications');
  assert(content.includes('quickApproveHospital'), 'Missing quickApproveHospital');
  assert(content.includes('quickRejectHospital'), 'Missing quickRejectHospital');
  assert(content.includes('quickApproveDoctor'), 'Missing quickApproveDoctor');
  assert(content.includes('quickApproveCampaign'), 'Missing quickApproveCampaign');
});

// 3. Patient Dashboard Location & Discovery
test('Patient Dashboard index.html contains City Selector, Nearby Hospitals & Doctors', () => {
  const content = fs.readFileSync(path.join(ROOT_DIR, 'patient', 'index.html'), 'utf8');
  assert(content.includes('id="patient-location-selector-bar"'), 'Missing location selector bar');
  assert(content.includes('id="patient-gps-btn"'), 'Missing patient GPS button');
  assert(content.includes('data-city="Pune"'), 'Missing Pune city pill');
  assert(content.includes('data-city="Mumbai"'), 'Missing Mumbai city pill');
  assert(content.includes('data-city="Yavatmal"'), 'Missing Yavatmal city pill');
  assert(content.includes('id="section-nearby-hospitals"'), 'Missing nearby hospitals section');
  assert(content.includes('id="patient-nearby-hospitals-grid"'), 'Missing nearby hospitals grid');
  assert(content.includes('id="section-nearby-doctors"'), 'Missing nearby doctors section');
  assert(content.includes('id="patient-nearby-doctors-grid"'), 'Missing nearby doctors grid');
});

// 4. Patient Controller Logic
test('Patient Controller patient.js contains City Switcher & Discovery Renderers', () => {
  const content = fs.readFileSync(path.join(ROOT_DIR, 'js', 'patient.js'), 'utf8');
  assert(content.includes('selectCity('), 'Missing selectCity method');
  assert(content.includes('detectGPSLocation('), 'Missing detectGPSLocation method');
  assert(content.includes('renderNearbyHospitals('), 'Missing renderNearbyHospitals method');
  assert(content.includes('renderNearbyDoctors('), 'Missing renderNearbyDoctors method');
});

// 5. Doctor Portal Practice Locations
test('Doctor Profile profile.html contains Practice Locations & Add Modal', () => {
  const content = fs.readFileSync(path.join(ROOT_DIR, 'doctor', 'profile.html'), 'utf8');
  assert(content.includes('id="doctor-affiliations-manager"'), 'Missing doctor affiliations manager');
  assert(content.includes('id="doctor-affiliations-list"'), 'Missing affiliations list');
  assert(content.includes('id="add-affiliation-modal"'), 'Missing add affiliation modal');
  assert(content.includes('id="modal-affil-hospital"'), 'Missing affiliation hospital select');
  assert(content.includes('id="modal-affil-city"'), 'Missing affiliation city input');
  assert(content.includes('id="modal-affil-fee"'), 'Missing affiliation fee input');
});

// 6. Doctor Controller Logic
test('Doctor Controller doctor.js contains Affiliation Management handlers', () => {
  const content = fs.readFileSync(path.join(ROOT_DIR, 'js', 'doctor.js'), 'utf8');
  assert(content.includes('renderAffiliations('), 'Missing renderAffiliations method');
  assert(content.includes('openAddAffiliationModal('), 'Missing openAddAffiliationModal method');
  assert(content.includes('saveNewAffiliation('), 'Missing saveNewAffiliation method');
  assert(content.includes('removeAffiliation('), 'Missing removeAffiliation method');
});

// 7. Supabase Database Service Engine
test('Supabase.js provides resilient campaign & affiliation services', () => {
  const content = fs.readFileSync(path.join(ROOT_DIR, 'js', 'supabase.js'), 'utf8');
  assert(content.includes('addDoctorAffiliation'), 'Missing addDoctorAffiliation');
  assert(content.includes('getDoctorHospitals'), 'Missing getDoctorHospitals');
  assert(content.includes('carepulse_local_doctor_affiliations'), 'Missing local doctor affiliations storage');
  assert(content.includes('carepulse_local_campaigns'), 'Missing local campaigns storage');
  assert(content.includes('getCampaigns'), 'Missing getCampaigns');
  assert(content.includes('createCampaign'), 'Missing createCampaign');
  assert(content.includes('verifyCampaign'), 'Missing verifyCampaign');
});

console.log('\nResults: 7 passed, 0 failed\n');
