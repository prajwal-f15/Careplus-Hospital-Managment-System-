/**
 * ==============================================================================
 * CAREPULSE HOSPITAL MANAGEMENT SYSTEM
 * Clinical Departments Verification Test Suite
 * Verifies that clinical departments render reliably across all pages & portals.
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
  addEventListener: () => {},
  removeEventListener: () => {},
  dispatchEvent: () => {},
  CustomEvent: class { constructor(type, data) { this.type = type; this.detail = data?.detail; } }
};

require(path.join(__dirname, '..', 'js', 'config.js'));
require(path.join(__dirname, '..', 'js', 'supabase.js'));

const CarePulseDB = global.window.CarePulseDB;

async function runClinicalDepartmentTests() {
  console.log(`\n${colors.bold}${colors.cyan}======================================================================${colors.reset}`);
  console.log(`${colors.bold}CLINICAL DEPARTMENTS COMPREHENSIVE VERIFICATION AUDIT${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}======================================================================${colors.reset}\n`);

  // 1. Data Store & Fallback Integrity
  console.log(`${colors.yellow}1. Clinical Departments Data Store & Fallback Integrity${colors.reset}`);
  const departments = await CarePulseDB.getDepartments();
  assert('getDepartments() returns non-empty array of clinical departments', Array.isArray(departments) && departments.length >= 8);

  const expectedCodes = ['CARD', 'NEUR', 'ORTH', 'DERM', 'PED', 'GEN', 'DENT', 'OPHT'];
  const presentCodes = departments.map(d => d.code);
  assert('All 8 clinical department codes are present', expectedCodes.every(c => presentCodes.includes(c)));

  const expectedNames = [
    'Cardiology', 'Neurology', 'Orthopedics', 'Dermatology',
    'Pediatrics', 'General Medicine', 'Dentistry', 'Ophthalmology'
  ];
  const presentNames = departments.map(d => d.name);
  assert('All 8 clinical department names are accurately defined', expectedNames.every(n => presentNames.includes(n)));

  const cardDept = departments.find(d => d.code === 'CARD');
  assert('Cardiology department has complete room and description details', 
    cardDept && cardDept.room_number && cardDept.description && cardDept.icon === 'heart'
  );

  // 2. Department Lookup by ID
  console.log(`\n${colors.yellow}2. Department Lookup by ID${colors.reset}`);
  const lookupDept = await CarePulseDB.getDepartmentById(cardDept.id);
  assert('getDepartmentById() resolves Cardiology department record', lookupDept && lookupDept.name === 'Cardiology');

  const invalidLookup = await CarePulseDB.getDepartmentById('non-existent-dept-id');
  assert('getDepartmentById() gracefully returns null for unknown ID', invalidLookup === null);

  // 3. Department Association with Doctors & Specialists
  console.log(`\n${colors.yellow}3. Department Association with Doctors & Specialists${colors.reset}`);
  const doctors = await CarePulseDB.getDoctors();
  assert('Doctors dataset contains specialists affiliated with departments', Array.isArray(doctors) && doctors.length > 0);

  const doctorsWithDept = doctors.filter(d => d.department_id || d.department_name);
  assert('Every doctor in the directory is mapped to a clinical department', doctorsWithDept.length === doctors.length);

  // 4. UI Page Templates & Elements Verification
  console.log(`\n${colors.yellow}4. UI Page Templates & Elements Verification${colors.reset}`);
  
  // departments.html
  const deptHtml = fs.readFileSync(path.join(__dirname, '..', 'departments.html'), 'utf8');
  assert('departments.html contains #departments-list-grid container', deptHtml.includes('id="departments-list-grid"'));
  assert('departments.html includes navigation link to doctors with dept parameter', deptHtml.includes('doctors.html?dept='));
  assert('departments.html displays department code and specialist count', deptHtml.includes('${d.code}') && deptHtml.includes('Specialists'));

  // doctors.html & js/doctors.js
  const docHtml = fs.readFileSync(path.join(__dirname, '..', 'doctors.html'), 'utf8');
  assert('doctors.html contains #department-filter-options container', docHtml.includes('id="department-filter-options"'));
  const docJs = fs.readFileSync(path.join(__dirname, '..', 'js', 'doctors.js'), 'utf8');
  assert('doctors.js dynamically populates department radio filters', docJs.includes('renderDepartmentFilter'));
  assert('doctors.js matches doctors by both department_id and department_name', docJs.includes('doc.department_id === selectedDept') && docJs.includes('doc.department_name'));

  // hospital-profile.html
  const hospProfHtml = fs.readFileSync(path.join(__dirname, '..', 'hospital-profile.html'), 'utf8');
  assert('hospital-profile.html renders Clinical Departments & Specialties section', hospProfHtml.includes('Clinical Departments & Specialties'));
  assert('hospital-profile.html fetches departments via CarePulseDB.getDepartments()', hospProfHtml.includes('CarePulseDB.getDepartments()'));

  // patient/book-appointment.html & js/patient.js
  const bookHtml = fs.readFileSync(path.join(__dirname, '..', 'patient', 'book-appointment.html'), 'utf8');
  assert('book-appointment.html contains #wizard-dept-select dropdown', bookHtml.includes('id="wizard-dept-select"'));
  const patJs = fs.readFileSync(path.join(__dirname, '..', 'js', 'patient.js'), 'utf8');
  assert('patient.js populates department dropdown in booking wizard', patJs.includes('wizard-dept-select'));

  // admin/departments.html & js/admin.js
  const adminDeptHtml = fs.readFileSync(path.join(__dirname, '..', 'admin', 'departments.html'), 'utf8');
  assert('admin/departments.html contains #admin-departments-table-body', adminDeptHtml.includes('id="admin-departments-table-body"'));
  const adminJs = fs.readFileSync(path.join(__dirname, '..', 'js', 'admin.js'), 'utf8');
  assert('admin.js renders cached departments into table body', adminJs.includes('initDepartmentManager'));

  console.log(`\n${colors.bold}${colors.cyan}======================================================================${colors.reset}`);
  console.log(`${colors.bold}SUMMARY: Total Assertions: ${totalChecks} | Passed: ${passedChecks} | Failed: ${totalChecks - passedChecks}${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}======================================================================${colors.reset}\n`);

  if (passedChecks === totalChecks) {
    console.log(`${colors.green}${colors.bold}✔ ALL CLINICAL DEPARTMENT TESTS PASSED WITH 100% SUCCESS RATE!${colors.reset}\n`);
    process.exit(0);
  } else {
    console.error(`${colors.red}${colors.bold}✖ SOME CLINICAL DEPARTMENT TESTS FAILED!${colors.reset}\n`);
    process.exit(1);
  }
}

runClinicalDepartmentTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
