/**
 * ==============================================================================
 * CAREPULSE HOSPITAL MANAGEMENT SYSTEM
 * Phase 4: Patient Discovery, Search & Profiles Test Suite (Module 5 & Module 6)
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
  location: { pathname: '/hospitals.html', origin: 'http://127.0.0.1:5500' },
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

async function runPatientSearchProfilesTests() {
  console.log(`\n${colors.bold}${colors.cyan}======================================================================${colors.reset}`);
  console.log(`${colors.bold}PHASE 4: PATIENT DISCOVERY, SEARCH & PROFILES AUDIT (MODULE 5)${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}======================================================================${colors.reset}\n`);

  // 1. Hospital Discovery & City-wise Search
  console.log(`${colors.yellow}1. Hospital Discovery & City-wise Filtering${colors.reset}`);
  const ytlHospitals = await CarePulseDB.searchHospitalsByLocation({ city: 'Yavatmal' });
  assert('searchHospitalsByLocation finds hospital in Yavatmal', 
    Array.isArray(ytlHospitals) && ytlHospitals.length > 0 && ytlHospitals[0].city_name === 'Yavatmal'
  );

  const mumbaiHospitals = await CarePulseDB.searchHospitalsByLocation({ city: 'Mumbai' });
  assert('searchHospitalsByLocation finds hospital in Mumbai', 
    Array.isArray(mumbaiHospitals) && mumbaiHospitals.length > 0 && mumbaiHospitals[0].city_name === 'Mumbai'
  );

  // 2. Hospital Facility & Type Filtering
  console.log(`\n${colors.yellow}2. Hospital Facility & Type Filtering${colors.reset}`);
  const icuHospitals = await CarePulseDB.searchHospitalsByLocation({ facility: 'ICU' });
  assert('searchHospitalsByLocation filters by facility (ICU)', 
    icuHospitals.length > 0 && icuHospitals.every(h => JSON.stringify(h.facilities).includes('ICU'))
  );

  const superSpecHospitals = await CarePulseDB.searchHospitalsByLocation({ hospitalType: 'Super-specialty' });
  assert('searchHospitalsByLocation filters by hospital type (Super-specialty)', 
    superSpecHospitals.length > 0 && superSpecHospitals.every(h => h.hospital_type === 'Super-specialty')
  );

  // 3. Distance Radius Nearby Search for Hospitals
  console.log(`\n${colors.yellow}3. Distance Radius Nearby Search for Hospitals${colors.reset}`);
  // Yavatmal coordinates: 20.3888, 78.1204
  const nearbyYtl10km = await CarePulseDB.searchHospitalsByLocation({
    userLat: 20.3888,
    userLng: 78.1204,
    radiusKm: 15
  });
  assert('Nearby radius search within 15 km of Yavatmal returns Yavatmal hospital', 
    nearbyYtl10km.some(h => h.city_name === 'Yavatmal')
  );
  assert('Nearby radius search within 15 km of Yavatmal excludes distant Mumbai hospitals', 
    !nearbyYtl10km.some(h => h.city_name === 'Mumbai')
  );

  // 4. Hospital Profile Details & Associated Doctors
  console.log(`\n${colors.yellow}4. Hospital Profile & Associated Doctor Roster${colors.reset}`);
  const sampleHosp = ytlHospitals[0];
  const hospDetails = await CarePulseDB.getHospitalById(sampleHosp.id);
  assert('getHospitalById retrieves complete hospital licensing & address details', 
    hospDetails && hospDetails.license_number && hospDetails.registration_number && hospDetails.address
  );

  const hospDoctors = await CarePulseDB.getHospitalDoctors(sampleHosp.id);
  assert('getHospitalDoctors returns active doctors affiliated with the hospital', 
    Array.isArray(hospDoctors) && hospDoctors.length > 0 && hospDoctors[0].full_name
  );

  // 5. Cross-City Referral Consent Enforcement (Module 6)
  console.log(`\n${colors.yellow}5. Cross-City Referral Patient Consent Enforcement${colors.reset}`);
  let missingConsentCaught = false;
  try {
    await CarePulseDB.createReferralRequest({
      patientId: 'patient-test-01',
      receivingDoctorId: '11111111-1111-1111-1111-111111111111',
      originCity: 'Yavatmal',
      destinationCity: 'Mumbai',
      specialty: 'Cardiology',
      consentGiven: false // Consent missing
    });
  } catch (e) {
    missingConsentCaught = e.message.includes('Mandatory Patient Consent');
  }
  assert('createReferralRequest strictly rejects submission without explicit patient consent', missingConsentCaught);

  const referralSuccess = await CarePulseDB.createReferralRequest({
    patientId: 'patient-test-01',
    receivingDoctorId: '11111111-1111-1111-1111-111111111111',
    originCity: 'Yavatmal',
    destinationCity: 'Mumbai',
    specialty: 'Cardiology',
    clinicalSummary: 'Recurrent angina, needs super-specialist evaluation',
    consentGiven: true
  });
  assert('createReferralRequest succeeds when patient consent is provided', 
    referralSuccess && referralSuccess.status === 'requested' && referralSuccess.patient_consent_given === true
  );

  // 6. UI & Page Route Verification
  console.log(`\n${colors.yellow}6. Discovery UI & Page Routes Verification${colors.reset}`);
  const hospDirHtml = fs.readFileSync(path.join(__dirname, '..', 'hospitals.html'), 'utf8');
  assert('hospitals.html includes hospital search input and location filters', 
    hospDirHtml.includes('id="hospital-search-input"') && hospDirHtml.includes('id="state-filter"') && hospDirHtml.includes('id="city-filter"')
  );
  assert('hospitals.html includes segmented switcher for Specialist Doctors vs Hospitals', 
    hospDirHtml.includes('Specialist Doctors') && hospDirHtml.includes('Hospitals & Centers')
  );

  const hospProfileHtml = fs.readFileSync(path.join(__dirname, '..', 'hospital-profile.html'), 'utf8');
  assert('hospital-profile.html includes interactive Leaflet map container', 
    hospProfileHtml.includes('id="hospital-map"') && hospProfileHtml.includes('leaflet')
  );
  assert('hospital-profile.html includes associated doctors section', 
    hospProfileHtml.includes('associated-doctors-section')
  );

  const docProfileHtml = fs.readFileSync(path.join(__dirname, '..', 'doctor-profile.html'), 'utf8');
  assert('doctor-profile.html displays Medical Council registration details', 
    docProfileHtml.includes('medical_council_name') && docProfileHtml.includes('medical_registration_number')
  );
  assert('doctor-profile.html includes Find Local Doctor / Referral modal trigger', 
    docProfileHtml.includes('btn-open-referral-finder') && docProfileHtml.includes('referral-finder-modal')
  );
  assert('doctor-profile.html enforces mandatory patient consent checkbox', 
    docProfileHtml.includes('chk-patient-consent') && docProfileHtml.includes('Mandatory Patient Consent')
  );

  console.log(`\n${colors.bold}${colors.cyan}======================================================================${colors.reset}`);
  console.log(`PHASE 4 AUDIT SUMMARY: TOTAL: ${totalChecks} | PASSED: ${passedChecks} | FAILED: ${totalChecks - passedChecks}`);
  console.log(`${colors.bold}${colors.cyan}======================================================================${colors.reset}\n`);

  if (passedChecks === totalChecks) {
    console.log(`${colors.green}${colors.bold}✔ ALL PHASE 4 PATIENT DISCOVERY & PROFILE SPECIFICATIONS PASSED (100% SUCCESS)${colors.reset}\n`);
    process.exit(0);
  } else {
    console.log(`${colors.red}${colors.bold}✖ SOME PHASE 4 CHECKS FAILED!${colors.reset}\n`);
    process.exit(1);
  }
}

runPatientSearchProfilesTests().catch(err => {
  console.error('Fatal error in Phase 4 audit:', err);
  process.exit(1);
});

