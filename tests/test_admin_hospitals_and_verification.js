/**
 * ==============================================================================
 * CAREPULSE TEST SUITE: ADMIN HOSPITALS & COMPREHENSIVE VERIFICATION ENGINE
 * Validates dedicated Admin Hospitals portal, full facility details,
 * doctor verification, hospital verification, and admin navigation integrity.
 * ==============================================================================
 */

const fs = require('fs');
const path = require('path');

const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  yellow: '\x1b[33m',
  reset: '\x1b[0m'
};

let passed = 0;
let failed = 0;

function assert(description, condition) {
  if (condition) {
    console.log(`  ${colors.green}✔ PASS:${colors.reset} ${description}`);
    passed++;
  } else {
    console.error(`  ${colors.red}✖ FAIL:${colors.reset} ${description}`);
    failed++;
  }
}

// Mock browser globals for testing
global.window = {
  LocationService: {
    getCities: async () => [
      { id: '10000000-0000-0000-0000-000000000001', city_name: 'Mumbai', state_name: 'Maharashtra', district_name: 'Mumbai', pincode: '400001' },
      { id: '10000000-0000-0000-0000-000000000004', city_name: 'Yavatmal', state_name: 'Maharashtra', district_name: 'Yavatmal', pincode: '445001' }
    ]
  }
};
global.localStorage = {
  _store: {},
  getItem(k) { return this._store[k] || null; },
  setItem(k, v) { this._store[k] = String(v); },
  removeItem(k) { delete this._store[k]; },
  clear() { this._store = {}; }
};

// Load supabase.js in Node environment
const supabaseJsContent = fs.readFileSync(path.join(__dirname, '../js/supabase.js'), 'utf8');
eval(supabaseJsContent);

async function runAdminHospitalsAndVerificationTests() {
  console.log(`\n${colors.cyan}======================================================================${colors.reset}`);
  console.log(`${colors.cyan}CAREPULSE: ADMIN HOSPITALS & VERIFICATION INTEGRATION TEST${colors.reset}`);
  console.log(`${colors.cyan}======================================================================${colors.reset}\n`);

  // 1. Validate admin/hospitals.html existence & structure
  console.log(`${colors.yellow}1. Admin Hospitals Portal HTML & Structure${colors.reset}`);
  const hospitalsHtmlPath = path.join(__dirname, '../admin/hospitals.html');
  assert('admin/hospitals.html file exists on disk', fs.existsSync(hospitalsHtmlPath));

  const hospContent = fs.readFileSync(hospitalsHtmlPath, 'utf8');
  assert('Contains viewport meta tag for mobile responsiveness', hospContent.includes('viewport'));
  assert('Contains table body element "admin-hospitals-table-body"', hospContent.includes('id="admin-hospitals-table-body"'));
  assert('Contains search input "admin-hosp-search"', hospContent.includes('id="admin-hosp-search"'));
  assert('Contains facility type filter dropdown', hospContent.includes('id="admin-hosp-type-filter"'));
  assert('Contains city filter dropdown', hospContent.includes('id="admin-hosp-city-filter"'));
  assert('Contains status filter dropdown', hospContent.includes('id="admin-hosp-status-filter"'));
  assert('Contains KPI card for total hospitals', hospContent.includes('id="kpi-admin-total-hospitals"'));
  assert('Contains KPI card for approved hospitals', hospContent.includes('id="kpi-admin-approved-hospitals"'));
  assert('Contains KPI card for pending verification', hospContent.includes('id="kpi-admin-pending-hospitals"'));
  assert('Contains KPI card for total bed capacity', hospContent.includes('id="kpi-admin-total-beds"'));
  assert('Contains complete details modal "hospital-details-modal"', hospContent.includes('id="hospital-details-modal"'));
  assert('Contains quick verification modal "hospital-verify-modal"', hospContent.includes('id="hospital-verify-modal"'));
  assert('Contains onboard hospital modal "add-hospital-modal"', hospContent.includes('id="add-hospital-modal"'));

  // 2. Validate Hospital Querying & Full Details Exposure
  console.log(`\n${colors.yellow}2. CarePulseDB Hospital Querying with Full Details${colors.reset}`);
  const allHospitals = await window.CarePulseDB.getHospitals({ includeUnapproved: true });
  assert('getHospitals({ includeUnapproved: true }) returns hospitals array', Array.isArray(allHospitals) && allHospitals.length > 0);

  const sampleHosp = allHospitals[0];
  assert('Hospital has ID', !!sampleHosp.id);
  assert('Hospital has Name', !!sampleHosp.name);
  assert('Hospital has Hospital Type', !!sampleHosp.hospital_type);
  assert('Hospital has Establishment License Number', !!sampleHosp.license_number);
  assert('Hospital has State Registration Number', !!sampleHosp.registration_number);
  assert('Hospital has Complete Address', !!sampleHosp.address);
  assert('Hospital has City Name', !!sampleHosp.city_name);
  assert('Hospital has District Name', !!sampleHosp.district_name);
  assert('Hospital has State Name', !!sampleHosp.state_name);
  assert('Hospital has PIN code', !!sampleHosp.pincode);
  assert('Hospital has 24x7 Emergency Contact Phone', !!sampleHosp.emergency_phone);
  assert('Hospital has Bed Capacity number', typeof sampleHosp.total_beds === 'number' && sampleHosp.total_beds > 0);
  assert('Hospital has Accredited Facilities list', Array.isArray(sampleHosp.facilities) && sampleHosp.facilities.length > 0);
  assert('Hospital has Verification Status', !!sampleHosp.verification_status);

  // 3. Validate Public vs Admin Visibility Guard
  console.log(`\n${colors.yellow}3. Public Search vs Admin Visibility Guard${colors.reset}`);
  const publicHospitals = await window.CarePulseDB.getHospitals(); // default includeUnapproved = false
  const unapprovedInPublic = publicHospitals.some(h => (h.verification_status || 'approved') !== 'approved' || h.is_active === false);
  assert('Public patient query strictly excludes unapproved or pending facilities', !unapprovedInPublic);

  const pendingInAdmin = allHospitals.some(h => h.verification_status === 'pending');
  assert('Admin query with includeUnapproved: true includes pending facilities for verification', pendingInAdmin);

  // 4. Validate Hospital Verification Actions & Mandatory Audit Rationale
  console.log(`\n${colors.yellow}4. Hospital Verification Action (Approve / Reject / Audit)${colors.reset}`);
  const pendingHosp = allHospitals.find(h => h.verification_status === 'pending') || allHospitals[allHospitals.length - 1];

  let threwWithoutReason = false;
  try {
    await window.CarePulseDB.verifyHospital({
      hospitalId: pendingHosp.id,
      adminId: 'a0000000-0000-0000-0000-000000000001',
      decision: 'approved',
      reason: '' // empty reason
    });
  } catch (e) {
    threwWithoutReason = true;
  }
  assert('verifyHospital rejects empty justification reason (Mandatory audit trail)', threwWithoutReason);

  // Valid Approval
  const approvalRes = await window.CarePulseDB.verifyHospital({
    hospitalId: pendingHosp.id,
    adminId: 'a0000000-0000-0000-0000-000000000001',
    decision: 'approved',
    reason: 'Clinical Establishment Act License verified with District Health Officer.'
  });
  assert('verifyHospital successfully returns approval confirmation', approvalRes && approvalRes.success === true && approvalRes.decision === 'approved');
  
  const verifiedHosp = await window.CarePulseDB.getHospitalById(pendingHosp.id);
  assert('Hospital in-memory status updated to approved', verifiedHosp && verifiedHosp.verification_status === 'approved' && verifiedHosp.is_active === true);

  // Audit event logged
  const auditLogs = await window.CarePulseDB.getAuditLogs(10);
  const hospAudit = auditLogs.find(a => a.entity_id === pendingHosp.id && a.action === 'hospital_verification_approved');
  assert('Administrative decision logged in audit_logs table with rationale', !!hospAudit);

  // 5. Validate Doctor Verification Actions & Audit
  console.log(`\n${colors.yellow}5. Doctor Verification Action & Mandatory Audit Rationale${colors.reset}`);
  const allDocs = await window.CarePulseDB.getDoctors({ includeUnapproved: true });
  const docToVerify = allDocs.find(d => d.verification_status === 'pending') || allDocs[0];

  let threwDocWithoutReason = false;
  try {
    await window.CarePulseDB.verifyDoctor({
      doctorId: docToVerify.id,
      adminId: 'a0000000-0000-0000-0000-000000000001',
      decision: 'approved',
      reason: ''
    });
  } catch (e) {
    threwDocWithoutReason = true;
  }
  assert('verifyDoctor rejects empty justification reason', threwDocWithoutReason);

  const docApproval = await window.CarePulseDB.verifyDoctor({
    doctorId: docToVerify.id,
    adminId: 'a0000000-0000-0000-0000-000000000001',
    decision: 'approved',
    reason: 'Verified against Maharashtra Medical Council Active Register 2024.'
  });
  assert('verifyDoctor successfully returns approval confirmation', docApproval && docApproval.success === true);
  
  const verifiedDoc = await window.CarePulseDB.getDoctorById(docToVerify.id);
  assert('Doctor in-memory status updated to approved & verified', verifiedDoc && verifiedDoc.verification_status === 'approved' && verifiedDoc.is_verified === true);

  // 6. Validate Admin Navigation Bar Links Across All Admin Pages
  console.log(`\n${colors.yellow}6. Admin Navigation Bar Links Across All Admin Pages${colors.reset}`);
  const adminPages = [
    'admin/index.html',
    'admin/hospitals.html',
    'admin/doctors.html',
    'admin/verification.html',
    'admin/patients.html',
    'admin/appointments.html',
    'admin/departments.html',
    'admin/reports.html'
  ];

  adminPages.forEach(p => {
    const fullP = path.join(__dirname, '../', p);
    assert(`Page ${p} exists on disk`, fs.existsSync(fullP));
    const content = fs.readFileSync(fullP, 'utf8');
    const hasHospLink = content.includes('href="hospitals.html"');
    const hasVerifyLink = content.includes('href="verification.html"');
    assert(`Page ${p} navbar contains link to hospitals.html`, hasHospLink);
    assert(`Page ${p} navbar contains link to verification.html`, hasVerifyLink);
  });

  // 7. Validate Admin Dashboard Alert Banner & KPI Cards
  console.log(`\n${colors.yellow}7. Admin Dashboard KPI & Verification Alert Banner${colors.reset}`);
  const indexContent = fs.readFileSync(path.join(__dirname, '../admin/index.html'), 'utf8');
  assert('Admin index contains "stat-admin-hospitals"', indexContent.includes('id="stat-admin-hospitals"'));
  assert('Admin index contains "stat-admin-pending-verifications"', indexContent.includes('id="stat-admin-pending-verifications"'));
  assert('Admin index contains "admin-verification-alert-banner"', indexContent.includes('id="admin-verification-alert-banner"'));
  assert('Admin index contains "nav-pending-badge"', indexContent.includes('id="nav-pending-badge"'));

  console.log(`\n${colors.cyan}======================================================================${colors.reset}`);
  console.log(`TEST SUMMARY: ${colors.green}${passed} PASSED${colors.reset}, ${failed === 0 ? colors.green : colors.red}${failed} FAILED${colors.reset}`);
  console.log(`${colors.cyan}======================================================================${colors.reset}\n`);

  process.exit(failed > 0 ? 1 : 0);
}

runAdminHospitalsAndVerificationTests().then(() => {
  process.exit(failed > 0 ? 1 : 0);
}).catch(err => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
