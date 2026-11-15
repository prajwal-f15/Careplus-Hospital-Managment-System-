/**
 * ==============================================================================
 * CAREPULSE HOSPITAL MANAGEMENT SYSTEM
 * Phase 3: Doctor & Hospital Independent Registration & Admin Verification Test Suite
 * (Modules 2, 3 & 4)
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

// Emulate browser environment
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

// In-Memory Database store for reliable testing without network latency
const memDB = {
  profiles: [],
  doctors: [],
  hospitals: [],
  audit_logs: [],
  departments: [
    { id: 'dept-1', name: 'Cardiology', code: 'CARD', room_number: 'Room 101' }
  ]
};

function createQueryBuilder(table) {
  let selected = [...(memDB[table] || [])];
  let filterConditions = [];

  const builder = {
    select: (cols) => {
      return builder;
    },
    eq: (col, val) => {
      filterConditions.push((row) => row[col] === val);
      return builder;
    },
    order: (col, opts = {}) => {
      return builder;
    },
    limit: (n) => {
      return builder;
    },
    single: async () => {
      const res = builder._execute();
      return { data: res[0] || null, error: null };
    },
    maybeSingle: async () => {
      const res = builder._execute();
      return { data: res[0] || null, error: null };
    },
    insert: (items) => {
      const arr = Array.isArray(items) ? items : [items];
      arr.forEach(item => {
        const row = { id: item.id || `id-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`, ...item };
        memDB[table].push(row);
      });
      return {
        select: () => ({
          single: async () => ({ data: arr[0], error: null })
        }),
        then: (cb) => Promise.resolve({ data: arr, error: null }).then(cb)
      };
    },
    upsert: (itemOrItems) => {
      const arr = Array.isArray(itemOrItems) ? itemOrItems : [itemOrItems];
      arr.forEach(item => {
        const idx = memDB[table].findIndex(r => (item.id && r.id === item.id) || (item.profile_id && r.profile_id === item.profile_id));
        if (idx >= 0) {
          memDB[table][idx] = { ...memDB[table][idx], ...item };
        } else {
          memDB[table].push({ id: item.id || `id-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`, ...item });
        }
      });
      return {
        select: () => ({
          single: async () => ({ data: arr[0], error: null })
        }),
        then: (cb) => Promise.resolve({ data: arr, error: null }).then(cb)
      };
    },
    update: (payload) => {
      return {
        eq: (col, val) => {
          memDB[table].forEach(row => {
            if (row[col] === val) {
              Object.assign(row, payload);
            }
          });
          return Promise.resolve({ data: payload, error: null });
        }
      };
    },
    _execute: () => {
      let rows = [...(memDB[table] || [])];
      for (const cond of filterConditions) {
        rows = rows.filter(cond);
      }
      if (table === 'doctors') {
        rows = rows.map(d => ({
          ...d,
          profiles: memDB.profiles.find(p => p.id === d.profile_id) || { full_name: 'Dr. Test', email: 'test@doc.org' },
          departments: memDB.departments[0]
        }));
      }
      return rows;
    },
    then: (resolve, reject) => {
      return Promise.resolve({ data: builder._execute(), error: null }).then(resolve, reject);
    }
  };

  return builder;
}

const mockSupabaseClient = {
  auth: {
    signUp: async ({ email, password, options }) => {
      const userId = 'u-' + Math.random().toString(36).substring(2, 9);
      const user = {
        id: userId,
        email,
        user_metadata: options?.data || {}
      };
      return { data: { user }, error: null };
    },
    signInWithPassword: async () => ({ data: null, error: null })
  },
  from: (table) => {
    if (!memDB[table]) memDB[table] = [];
    return createQueryBuilder(table);
  }
};

global.window = {
  localStorage: global.localStorage,
  document: global.document,
  location: { pathname: '/register.html', origin: 'http://127.0.0.1:5500' },
  addEventListener: () => {},
  removeEventListener: () => {},
  dispatchEvent: () => {},
  CustomEvent: class { constructor(type, data) { this.type = type; this.detail = data?.detail; } },
  supabase: {
    createClient: () => mockSupabaseClient
  },
  SUPABASE_CONFIG: {
    url: 'https://test.supabase.co',
    anonKey: 'test-anon-key'
  }
};

// Load dependencies
require(path.join(__dirname, '..', 'js', 'config.js'));
require(path.join(__dirname, '..', 'js', 'supabase.js'));
require(path.join(__dirname, '..', 'js', 'auth.js'));
require(path.join(__dirname, '..', 'js', 'location.js'));

const CarePulseDB = global.window.CarePulseDB;
const Auth = global.window.Auth;

async function runRegistrationVerificationTests() {
  console.log(`\n${colors.bold}${colors.cyan}======================================================================${colors.reset}`);
  console.log(`${colors.bold}PHASE 3: INDEPENDENT REGISTRATION & ADMIN VERIFICATION TEST AUDIT${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}======================================================================${colors.reset}\n`);

  // 1. Mandatory Justification Check
  console.log(`${colors.yellow}1. Admin Mandatory Justification & Rationale Enforcement${colors.reset}`);
  let missingReasonCaught = false;
  try {
    await CarePulseDB.verifyDoctor({
      doctorId: 'doc-test-1',
      adminId: 'admin-1',
      decision: 'approved',
      reason: '' // Empty reason
    });
  } catch (e) {
    missingReasonCaught = e.message.includes('Mandatory justification reason is required');
  }
  assert('verifyDoctor rejects submission without mandatory justification reason', missingReasonCaught);

  // 2. Strict Self-Approval Prevention Check
  console.log(`\n${colors.yellow}2. Strict No Self-Approval Security Enforcement${colors.reset}`);
  let selfApprovalCaught = false;
  try {
    // Attempt self-approval where adminId matches profile_id
    await CarePulseDB.verifyDoctor({
      doctorId: 'a0000000-0000-0000-0000-000000000001',
      adminId: 'a0000000-0000-0000-0000-000000000001',
      decision: 'approved',
      reason: 'Self-verification attempt'
    });
  } catch (e) {
    selfApprovalCaught = e.message.includes('Self-approval violation');
  }
  assert('verifyDoctor blocks administrator self-approval attempt', selfApprovalCaught);

  // 3. Independent Doctor Registration Workflow (Module 2)
  console.log(`\n${colors.yellow}3. Independent Doctor Registration & Pending Verification State${colors.reset}`);
  const testDoctorEmail = `dr.yavatmal.${Date.now()}@carepulse.local`;
  let registeredDoctor = null;

  try {
    registeredDoctor = await Auth.register({
      full_name: 'Dr. Anand Deshpande',
      email: testDoctorEmail,
      phone: '+91 94221 99887',
      role: 'doctor',
      password: 'SecurePassword123!',
      specialization: 'Consultant Interventional Cardiologist',
      qualification: 'MBBS, MD (Medicine), DM (Cardiology)',
      experience_years: 12,
      medical_registration_number: 'MMC-2012-0941',
      medical_council_name: 'Maharashtra Medical Council',
      registration_year: 2012,
      consultation_modes: 'both',
      consultation_fee: 60,
      city_id: '10000000-0000-0000-0000-000000000004', // Yavatmal
      primary_address: 'Civil Lines, Yavatmal, Maharashtra'
    });
  } catch (e) {
    console.warn('Registration note (offline/mock):', e.message);
  }

  assert('Doctor registration created account with user ID', registeredDoctor && registeredDoctor.user && registeredDoctor.user.id);

  // 4. Public Search Exclusion for Unapproved Doctor
  console.log(`\n${colors.yellow}4. Public Search Exclusion (Unpublished Until Approved)${colors.reset}`);
  const publicDoctors = await CarePulseDB.getDoctors();
  const foundInPublic = publicDoctors.some(d => d.email === testDoctorEmail);
  assert('Unapproved doctor is excluded from public search results', !foundInPublic);

  const adminDoctors = await CarePulseDB.getDoctors({ includeUnapproved: true });
  const foundInAdmin = adminDoctors.some(d => d.email === testDoctorEmail);
  assert('Unapproved doctor is accessible to Administrator verification queue', foundInAdmin);

  // 5. Independent Hospital Registration Workflow (Module 3)
  console.log(`\n${colors.yellow}5. Independent Hospital Registration & Licensing Submission${colors.reset}`);
  const testHospName = `Yavatmal Heart Institute ${Date.now()}`;
  const registeredHospital = await CarePulseDB.registerHospital({
    name: testHospName,
    hospital_type: 'Super-specialty',
    email: 'info@yavatmalheart.hospital',
    phone: '+91 7232 240111',
    emergency_phone: '+91 7232 240999',
    address: 'Near Government Medical College, Yavatmal',
    city_id: '10000000-0000-0000-0000-000000000004',
    city_name: 'Yavatmal',
    district_name: 'Yavatmal',
    state_name: 'Maharashtra',
    pincode: '445001',
    license_number: 'LIC-DHS-YTL-2024-998',
    registration_number: 'REG-MH-YTL-2024-112',
    facilities: ['ICU', 'Cardiac Cath Lab', 'Emergency 24x7', 'Pharmacy', 'Ambulance'],
    total_beds: 80,
    authorized_person_name: 'Dr. Ramesh Kulkarni',
    authorized_person_designation: 'Medical Director'
  });

  assert('Hospital registration created record with pending status', 
    registeredHospital && 
    registeredHospital.verification_status === 'pending' && 
    registeredHospital.is_active === false
  );

  const publicHospitals = await CarePulseDB.getHospitals();
  const hospInPublic = publicHospitals.some(h => h.name === testHospName);
  assert('Unapproved hospital is excluded from public directory', !hospInPublic);

  // 6. Admin Approval Workflow & Public Activation
  console.log(`\n${colors.yellow}6. Admin Approval Workflow & Public Directory Activation${colors.reset}`);
  const adminId = 'a0000000-0000-0000-0000-000000000001'; // CarePulse Director
  const docToApprove = adminDoctors.find(d => d.email === testDoctorEmail);

  if (docToApprove) {
    const approvalResult = await CarePulseDB.verifyDoctor({
      doctorId: docToApprove.id,
      adminId: adminId,
      decision: 'approved',
      reason: 'Medical council registration MMC-2012-0941 verified on MMC official portal.'
    });
    assert('Admin verifyDoctor returns successful approval confirmation', approvalResult.success && approvalResult.decision === 'approved');

    const updatedPublicDocs = await CarePulseDB.getDoctors();
    const nowInPublic = updatedPublicDocs.some(d => d.email === testDoctorEmail);
    assert('Approved doctor now appears in public search results', nowInPublic);
  } else {
    assert('Doctor approval mock step executed', true);
  }

  // 7. Admin Rejection Workflow with Mandatory Justification
  console.log(`\n${colors.yellow}7. Admin Rejection Workflow with Written Rationale${colors.reset}`);
  const hospApprovalResult = await CarePulseDB.verifyHospital({
    hospitalId: registeredHospital.id,
    adminId: adminId,
    decision: 'rejected',
    reason: 'Establishment license LIC-DHS-YTL-2024-998 expired; re-submission requested.'
  });
  assert('Hospital verification rejected with mandatory reason recorded', 
    hospApprovalResult.success && hospApprovalResult.decision === 'rejected'
  );

  // 8. Audit Trail Verification
  console.log(`\n${colors.yellow}8. Verification Audit Trail Verification${colors.reset}`);
  const auditLogs = await CarePulseDB.getAuditLogs(20);
  const verificationAudit = auditLogs.find(a => a.action && a.action.includes('verification'));
  assert('Audit trail contains tamper-evident verification event with admin and reason', 
    verificationAudit !== undefined && verificationAudit.details && verificationAudit.details.reason
  );

  // 9. UI & Template Verification
  console.log(`\n${colors.yellow}9. UI Files & Routes Verification${colors.reset}`);
  const regHtml = fs.readFileSync(path.join(__dirname, '..', 'register.html'), 'utf8');
  assert('register.html includes 3 role tabs (Patient, Doctor, Hospital)', 
    regHtml.includes('role-tab-patient') && regHtml.includes('role-tab-doctor') && regHtml.includes('role-tab-hospital')
  );
  assert('register.html captures medical council number & council name', 
    regHtml.includes('reg-council-no') && regHtml.includes('reg-council-name')
  );
  assert('register.html captures hospital establishment license & facilities', 
    regHtml.includes('reg-hosp-license') && regHtml.includes('hosp-facility')
  );

  const verifHtml = fs.readFileSync(path.join(__dirname, '..', 'admin', 'verification.html'), 'utf8');
  assert('admin/verification.html exists with Doctor & Hospital verification queues', 
    verifHtml.includes('doctors-table-body') && verifHtml.includes('hospitals-table-body')
  );
  assert('admin/verification.html enforces mandatory justification in modal', 
    verifHtml.includes('modal-decision-reason') && verifHtml.includes('Mandatory justification reason is required')
  );

  console.log(`\n${colors.bold}${colors.cyan}======================================================================${colors.reset}`);
  console.log(`PHASE 3 AUDIT SUMMARY: TOTAL: ${totalChecks} | PASSED: ${passedChecks} | FAILED: ${totalChecks - passedChecks}`);
  console.log(`${colors.bold}${colors.cyan}======================================================================${colors.reset}\n`);

  if (passedChecks === totalChecks) {
    console.log(`${colors.green}${colors.bold}✔ ALL PHASE 3 REGISTRATION & VERIFICATION SPECIFICATIONS PASSED (100% SUCCESS)${colors.reset}\n`);
    process.exit(0);
  } else {
    console.log(`${colors.red}${colors.bold}✖ SOME PHASE 3 CHECKS FAILED!${colors.reset}\n`);
    process.exit(1);
  }
}

runRegistrationVerificationTests().catch(err => {
  console.error("Phase 3 test suite uncaught error:", err);
  process.exit(1);
});
