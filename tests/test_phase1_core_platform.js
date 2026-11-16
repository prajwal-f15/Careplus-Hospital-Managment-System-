/**
 * ==============================================================================
 * CAREPULSE TEST SUITE: PHASE 1 CORE PLATFORM ENHANCEMENT
 * Validates dedicated Hospital Portal (hospital/), multi-hospital practice selection,
 * admin regional cities directory, role routing, and database helpers.
 * ==============================================================================
 */

const fs = require('fs');
const path = require('path');

const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  yellow: '\x1b[33m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

let passed = 0;
let failed = 0;

function assert(description, condition, details = '') {
  if (condition) {
    console.log(`  ${colors.green}✔ PASS:${colors.reset} ${description}`);
    passed++;
  } else {
    console.error(`  ${colors.red}✖ FAIL:${colors.reset} ${description} ${details ? '(' + details + ')' : ''}`);
    failed++;
  }
}

// Emulate browser environment
global.localStorage = {
  _store: {
    carepulse_current_user: JSON.stringify({ role: 'hospital', full_name: 'Dr. Rajesh Nair', hospital_name: 'CarePulse Central Hospital' })
  },
  getItem(k) { return this._store[k] || null; },
  setItem(k, v) { this._store[k] = String(v); },
  removeItem(k) { delete this._store[k]; }
};

global.document = {
  getElementById: () => null,
  querySelector: () => null,
  querySelectorAll: () => [],
  addEventListener: () => {}
};

global.window = {
  localStorage: global.localStorage,
  document: global.document,
  location: { pathname: '/hospital/index.html', search: '', href: '' },
  addEventListener: () => {}
};

require(path.join(__dirname, '..', 'js', 'config.js'));
require(path.join(__dirname, '..', 'js', 'supabase.js'));
require(path.join(__dirname, '..', 'js', 'auth.js'));

async function runPhase1CorePlatformTests() {
  console.log(`\n${colors.cyan}${colors.bold}======================================================================${colors.reset}`);
  console.log(`${colors.cyan}${colors.bold}CAREPULSE: PHASE 1 CORE PLATFORM INTEGRATION AUDIT${colors.reset}`);
  console.log(`${colors.cyan}${colors.bold}======================================================================${colors.reset}\n`);

  // 1. Dedicated Hospital & Clinic Portal Pages
  console.log(`${colors.yellow}1. Dedicated Hospital Portal (hospital/) Structure${colors.reset}`);
  const hospitalFiles = [
    'hospital/index.html',
    'hospital/doctors.html',
    'hospital/appointments.html',
    'hospital/departments.html',
    'hospital/profile.html',
    'js/hospital.js'
  ];

  hospitalFiles.forEach(f => {
    const fullPath = path.join(__dirname, '..', f);
    assert(`File exists: ${f}`, fs.existsSync(fullPath));
    if (f.endsWith('.html')) {
      const html = fs.readFileSync(fullPath, 'utf8');
      assert(`${f} has responsive viewport meta tag`, html.includes('name="viewport"'));
      assert(`${f} includes js/hospital.js script reference`, html.includes('js/hospital.js'));
      assert(`${f} includes navigation links`, html.includes('doctors.html') && html.includes('appointments.html'));
    }
  });

  // 2. Multi-Hospital Doctor Practice Location Selector
  console.log(`\n${colors.yellow}2. Multi-Hospital Doctor Practice Location Selector${colors.reset}`);
  const bookApptHtml = fs.readFileSync(path.join(__dirname, '..', 'patient', 'book-appointment.html'), 'utf8');
  assert('book-appointment.html contains practice location container', bookApptHtml.includes('wizard-practice-location-container'));
  assert('book-appointment.html contains hospital dropdown selector', bookApptHtml.includes('wizard-hospital-select'));

  const patientJs = fs.readFileSync(path.join(__dirname, '..', 'js', 'patient.js'), 'utf8');
  assert('patient.js implements updatePracticeLocations method', patientJs.includes('updatePracticeLocations(doctorId)'));
  assert('patient.js attaches selected hospital_id to appointment payload', patientJs.includes('hospital_id: selectedHospitalId'));

  const doctorScheduleHtml = fs.readFileSync(path.join(__dirname, '..', 'doctor', 'schedule.html'), 'utf8');
  assert('doctor/schedule.html contains hospital schedule card', doctorScheduleHtml.includes('doctor-hospital-schedule-card'));
  assert('doctor/schedule.html contains hospital select dropdown', doctorScheduleHtml.includes('doctor-schedule-hospital-select'));

  const doctorProfileHtml = fs.readFileSync(path.join(__dirname, '..', 'doctor', 'profile.html'), 'utf8');
  assert('doctor/profile.html contains medical registration number input', doctorProfileHtml.includes('doc-council-no'));
  assert('doctor/profile.html contains state medical council input', doctorProfileHtml.includes('doc-council-name'));
  assert('doctor/profile.html contains practice city input', doctorProfileHtml.includes('doc-city'));
  assert('doctor/profile.html contains consultation mode select', doctorProfileHtml.includes('doc-mode'));

  // 3. Super Admin Cities & Location Directory
  console.log(`\n${colors.yellow}3. Super Admin Cities Directory (admin/cities.html)${colors.reset}`);
  const citiesHtmlPath = path.join(__dirname, '..', 'admin', 'cities.html');
  assert('admin/cities.html exists on disk', fs.existsSync(citiesHtmlPath));

  const citiesHtml = fs.readFileSync(citiesHtmlPath, 'utf8');
  assert('admin/cities.html contains cities table body', citiesHtml.includes('admin-cities-tbody'));
  assert('admin/cities.html contains search input', citiesHtml.includes('city-search'));
  assert('admin/cities.html contains state filter', citiesHtml.includes('city-state-filter'));
  assert('admin/cities.html contains Add City modal', citiesHtml.includes('add-city-modal'));

  const allAdminPages = [
    'admin/index.html',
    'admin/hospitals.html',
    'admin/doctors.html',
    'admin/verification.html',
    'admin/patients.html',
    'admin/appointments.html',
    'admin/departments.html',
    'admin/rooms.html',
    'admin/reports.html',
    'admin/audit-logs.html',
    'admin/verify-appointment.html'
  ];

  allAdminPages.forEach(p => {
    const pPath = path.join(__dirname, '..', p);
    const content = fs.readFileSync(pPath, 'utf8');
    assert(`Navbar in ${p} links to cities.html`, content.includes('href="cities.html"'));
  });

  // 4. Role Guard & Auth Redirects for Hospital Role
  console.log(`\n${colors.yellow}4. Role Guard & Auth Redirects for Hospital Role${colors.reset}`);
  const authJs = fs.readFileSync(path.join(__dirname, '..', 'js', 'auth.js'), 'utf8');
  assert('auth.js redirectDashboard handles hospital role to hospital/index.html', authJs.includes("case 'hospital':") && authJs.includes("hospital/index.html"));
  assert('auth.js recognizes /hospital/ path in isInSubdir check', authJs.includes("window.location.pathname.includes('/hospital/')"));
  assert('auth.js loginAsDemo supports hospital role', authJs.includes("hospital: {") && authJs.includes("contact@carepulse.hospital"));

  // 5. Database Helpers in js/supabase.js
  console.log(`\n${colors.yellow}5. Database Helpers in js/supabase.js${colors.reset}`);
  const CarePulseDB = global.window.CarePulseDB;
  assert('CarePulseDB has getHospitalByProfileId', typeof CarePulseDB.getHospitalByProfileId === 'function');
  assert('CarePulseDB has updateHospital', typeof CarePulseDB.updateHospital === 'function');
  assert('CarePulseDB has getHospitalAppointments', typeof CarePulseDB.getHospitalAppointments === 'function');
  assert('CarePulseDB has addDoctorAffiliation', typeof CarePulseDB.addDoctorAffiliation === 'function');
  assert('CarePulseDB has removeDoctorAffiliation', typeof CarePulseDB.removeDoctorAffiliation === 'function');
  assert('CarePulseDB has getAdminCities', typeof CarePulseDB.getAdminCities === 'function');
  assert('CarePulseDB has addCity', typeof CarePulseDB.addCity === 'function');
  assert('CarePulseDB has updateCity', typeof CarePulseDB.updateCity === 'function');

  // Verify getAdminCities returns list
  const adminCities = await CarePulseDB.getAdminCities();
  assert('getAdminCities returns array of regional cities', Array.isArray(adminCities) && adminCities.length > 0);
  assert('Cities include Maharashtra cities', adminCities.some(c => c.city_name === 'Mumbai' || c.city_name === 'Yavatmal'));

  // 6. SQL Migration DDL Script
  console.log(`\n${colors.yellow}6. SQL Migration DDL Script${colors.reset}`);
  const phase1SqlPath = path.join(__dirname, '..', 'sql', 'phase1_core_platform_enhancement.sql');
  assert('sql/phase1_core_platform_enhancement.sql exists', fs.existsSync(phase1SqlPath));

  const phase1Sql = fs.readFileSync(phase1SqlPath, 'utf8');
  assert('DDL adds hospital_id to doctor_availability', phase1Sql.includes('hospital_id UUID REFERENCES public.hospitals'));
  assert('DDL adds consultation_days and opd_timing to doctor_hospitals', phase1Sql.includes('consultation_days') && phase1Sql.includes('opd_timing'));
  assert('DDL creates hospital_staff table', phase1Sql.includes('CREATE TABLE IF NOT EXISTS public.hospital_staff'));
  assert('DDL enables RLS on hospital_staff', phase1Sql.includes('ENABLE ROW LEVEL SECURITY'));

  console.log(`\n${colors.cyan}${colors.bold}======================================================================${colors.reset}`);
  console.log(`${colors.bold}SUMMARY: Total Assertions: ${passed + failed} | Passed: ${passed} | Failed: ${failed}${colors.reset}`);
  console.log(`${colors.cyan}${colors.bold}======================================================================${colors.reset}\n`);

  if (failed === 0) {
    console.log(`${colors.green}${colors.bold}✔ ALL PHASE 1 CORE PLATFORM ENHANCEMENT TESTS PASSED (100%)!${colors.reset}\n`);
    process.exit(0);
  } else {
    console.error(`${colors.red}${colors.bold}✖ SOME PHASE 1 TESTS FAILED!${colors.reset}\n`);
    process.exit(1);
  }
}

runPhase1CorePlatformTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
