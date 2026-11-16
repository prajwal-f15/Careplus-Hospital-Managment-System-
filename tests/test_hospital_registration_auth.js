/**
 * ==============================================================================
 * CAREPULSE HOSPITAL MANAGEMENT SYSTEM
 * Hospital Registration & Auth Error Guard Test Suite
 * Verifies that hospital registration succeeds without "Database error saving new user"
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
require(path.join(__dirname, '..', 'js', 'auth.js'));

const CarePulseDB = global.window.CarePulseDB;
const Auth = global.window.Auth;

async function runHospitalRegistrationAuthTests() {
  console.log(`\n${colors.bold}${colors.cyan}======================================================================${colors.reset}`);
  console.log(`${colors.bold}HOSPITAL REGISTRATION & AUTH ERROR GUARD AUDIT${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}======================================================================${colors.reset}\n`);

  // 1. Auth Registration Safeguard Logic
  console.log(`${colors.yellow}1. Auth Registration Role Safeguard Logic${colors.reset}`);
  const authJs = fs.readFileSync(path.join(__dirname, '..', 'js', 'auth.js'), 'utf8');
  assert('auth.js maps isHospitalRole to safe authMetadataRole for auth.signUp', authJs.includes('const isHospitalRole = (role === \'hospital\' || role === \'hospital_admin\');') && authJs.includes('const authMetadataRole = isHospitalRole ? \'patient\' : role;'));
  assert('auth.js preserves actual_role and account_type in user_metadata', authJs.includes('account_type: isHospitalRole ? \'hospital\' : role') && authJs.includes('actual_role: role'));
  assert('auth.js includes fallback profile upsert if profiles_role_check only allows patient/doctor/admin', authJs.includes('fallbackProf'));

  // 2. Hospital Record Creation with Profile Association
  console.log(`\n${colors.yellow}2. Hospital Record Creation with Profile Association${colors.reset}`);
  const supabaseJs = fs.readFileSync(path.join(__dirname, '..', 'js', 'supabase.js'), 'utf8');
  assert('supabase.js registerHospital receives and stores profile_id', supabaseJs.includes('profile_id,') && supabaseJs.includes('profile_id: profile_id || null'));

  const hospRecord = await CarePulseDB.registerHospital({
    profile_id: 'test-profile-uuid-1234',
    name: 'Yavatmal District Multi-Specialty Clinic',
    hospital_type: 'Private Multi-specialty',
    email: 'yavatmal.clinic@carepulse.local',
    phone: '+91 7232 254999',
    emergency_phone: '1234567890',
    address: 'Civil Lines, Yavatmal',
    city_name: 'Yavatmal',
    pincode: '445001',
    license_number: '1256ujvcxstyuj',
    registration_number: 'REG-MH-YTL-2026',
    facilities: ['ICU', 'Emergency 24x7', 'Pharmacy', 'Laboratory', 'Ambulance'],
    total_beds: 60,
    authorized_person_name: 'Dr. Suresh Patil',
    authorized_person_designation: 'Medical Director'
  });

  assert('registerHospital successfully returns registered hospital entity', hospRecord && hospRecord.id);
  assert('registerHospital records status as pending for administrator review', hospRecord.verification_status === 'pending');
  assert('registerHospital is_active is false until approved', hospRecord.is_active === false);
  assert('registerHospital stores license_number accurately', hospRecord.license_number === '1256ujvcxstyuj');
  assert('registerHospital stores 24x7 emergency phone', hospRecord.emergency_phone === '1234567890');
  assert('registerHospital links profile_id to authorized administrator', hospRecord.profile_id === 'test-profile-uuid-1234');

  // 3. SQL Migration & Schema Constraints
  console.log(`\n${colors.yellow}3. SQL Migration & Schema Constraints${colors.reset}`);
  const migrationSql = fs.readFileSync(path.join(__dirname, '..', 'sql', 'city_hospital_referral_migration.sql'), 'utf8');
  assert('city_hospital_referral_migration.sql alters profiles_role_check to permit hospital', migrationSql.includes('role IN (\'patient\', \'doctor\', \'admin\', \'hospital\')'));

  const fixSql = fs.readFileSync(path.join(__dirname, '..', 'sql', 'fix_profiles_hospital_role.sql'), 'utf8');
  assert('fix_profiles_hospital_role.sql exists and contains ALTER TABLE profiles_role_check', fixSql.includes('profiles_role_check CHECK (role IN (\'patient\', \'doctor\', \'admin\', \'hospital\'))'));
  assert('fix_profiles_hospital_role.sql contains handle_new_user trigger update with CASE mapping', fixSql.includes('WHEN NEW.raw_user_meta_data->>\'role\' IN (\'doctor\', \'admin\', \'hospital\')'));

  // 4. Session & Dashboard Navigation
  console.log(`\n${colors.yellow}4. Session & Dashboard Navigation${colors.reset}`);
  assert('auth.js identifies hospital role from user_metadata or hospitals table', authJs.includes('const isHospitalAccount = profile.role === \'hospital\' ||'));
  assert('auth.js redirects hospital role to hospital portal', authJs.includes('case \'hospital\':') && authJs.includes('hospital/index.html'));

  console.log(`\n${colors.bold}${colors.cyan}======================================================================${colors.reset}`);
  console.log(`${colors.bold}SUMMARY: Total Assertions: ${totalChecks} | Passed: ${passedChecks} | Failed: ${totalChecks - passedChecks}${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}======================================================================${colors.reset}\n`);

  if (passedChecks === totalChecks) {
    console.log(`${colors.green}${colors.bold}✔ ALL HOSPITAL REGISTRATION & AUTH ERROR GUARD TESTS PASSED (100%)!${colors.reset}\n`);
    process.exit(0);
  } else {
    console.error(`${colors.red}${colors.bold}✖ SOME TESTS FAILED!${colors.reset}\n`);
    process.exit(1);
  }
}

runHospitalRegistrationAuthTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});

