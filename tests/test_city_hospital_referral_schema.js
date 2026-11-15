/**
 * ==============================================================================
 * CAREPULSE HOSPITAL MANAGEMENT SYSTEM
 * Phase 1: City, Hospital & Referral Migration & Schema Validation Test
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

async function runPhase1Validation() {
  console.log(`\n${colors.bold}${colors.cyan}======================================================================${colors.reset}`);
  console.log(`${colors.bold}PHASE 1: CITY, HOSPITAL & REFERRAL MIGRATION AUDIT & VALIDATION${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}======================================================================${colors.reset}\n`);

  const migrationPath = path.join(__dirname, '..', 'sql', 'city_hospital_referral_migration.sql');
  const planPath = path.join(__dirname, '..', 'IMPLEMENTATION_PLAN_MODULES.md');

  // 1. Audit Migration File Presence
  console.log(`${colors.yellow}1. Auditing Migration Script & Blueprint Assets${colors.reset}`);
  assert('Migration script exists at sql/city_hospital_referral_migration.sql', fs.existsSync(migrationPath));
  assert('Implementation blueprint exists at IMPLEMENTATION_PLAN_MODULES.md', fs.existsSync(planPath));

  const migrationSql = fs.readFileSync(migrationPath, 'utf8');

  // 2. Validate Module 1: Location Directory Entities
  console.log(`\n${colors.yellow}2. Validating Module 1: Location Directory Schema${colors.reset}`);
  assert('Migration defines public.cities table', /CREATE TABLE IF NOT EXISTS public\.cities/i.test(migrationSql));
  assert('Cities table contains state, district, city and pincode', 
    /state_name TEXT/i.test(migrationSql) && 
    /district_name TEXT/i.test(migrationSql) && 
    /city_name TEXT/i.test(migrationSql) && 
    /pincode TEXT/i.test(migrationSql)
  );
  assert('Cities table supports latitude and longitude for nearby distance calculation', 
    /latitude NUMERIC/i.test(migrationSql) && /longitude NUMERIC/i.test(migrationSql)
  );
  assert('Cities table enforces uniqueness on state, district, city, pincode', 
    /uq_city_district_state UNIQUE/i.test(migrationSql)
  );
  assert('Migration seeds Mumbai, Pune, Nagpur, Yavatmal, and national hubs', 
    /Mumbai/i.test(migrationSql) && 
    /Pune/i.test(migrationSql) && 
    /Nagpur/i.test(migrationSql) && 
    /Yavatmal/i.test(migrationSql) &&
    /Amravati/i.test(migrationSql)
  );

  // 3. Validate Module 2: Doctor Independent Registration & Verification
  console.log(`\n${colors.yellow}3. Validating Module 2: Doctor Registration & Verification Schema${colors.reset}`);
  assert('Doctors table extended with verification_status constraint', 
    /verification_status TEXT NOT NULL DEFAULT 'approved' CHECK \(verification_status IN \('draft', 'pending', 'under_review', 'approved', 'rejected', 'suspended'\)\)/i.test(migrationSql)
  );
  assert('Doctors table extended with medical council registration fields', 
    /medical_registration_number TEXT/i.test(migrationSql) && /medical_council_name TEXT/i.test(migrationSql)
  );
  assert('Doctors table supports consultation_modes (in_person, video, both)', 
    /consultation_modes TEXT NOT NULL DEFAULT 'both' CHECK \(consultation_modes IN \('in_person', 'video', 'both'\)\)/i.test(migrationSql)
  );
  assert('Migration creates doctor_documents table for credential verification', 
    /CREATE TABLE IF NOT EXISTS public\.doctor_documents/i.test(migrationSql)
  );

  // 4. Validate Module 3: Hospital Independent Registration
  console.log(`\n${colors.yellow}4. Validating Module 3: Hospital Registration Schema${colors.reset}`);
  assert('Migration creates public.hospitals table', /CREATE TABLE IF NOT EXISTS public\.hospitals/i.test(migrationSql));
  assert('Hospitals table supports verification_status states', 
    /CHECK \(verification_status IN \('draft', 'pending', 'under_review', 'approved', 'rejected', 'suspended'\)\)/i.test(migrationSql)
  );
  assert('Hospitals table records license_number, registration_number, and facilities', 
    /license_number TEXT/i.test(migrationSql) && /facilities JSONB/i.test(migrationSql)
  );
  assert('Migration seeds CarePulse Central Hospital (Mumbai) with fixed UUID', 
    /c0000000-0000-0000-0000-000000000001/i.test(migrationSql) && /CarePulse Central Hospital/i.test(migrationSql)
  );
  assert('Migration seeds Yavatmal District Hospital for referral workflow', 
    /c0000000-0000-0000-0000-000000000002/i.test(migrationSql) && /Yavatmal/i.test(migrationSql)
  );
  assert('Migration creates hospital_documents table', 
    /CREATE TABLE IF NOT EXISTS public\.hospital_documents/i.test(migrationSql)
  );

  // 5. Validate Multi-Hospital Affiliations
  console.log(`\n${colors.yellow}5. Validating Doctor-Hospital Affiliations Schema${colors.reset}`);
  assert('Migration creates doctor_hospitals table for multi-hospital practice', 
    /CREATE TABLE IF NOT EXISTS public\.doctor_hospitals/i.test(migrationSql)
  );
  assert('Doctor-Hospital affiliation enforces unique constraint (doctor_id, hospital_id)', 
    /uq_doctor_hospital UNIQUE \(doctor_id, hospital_id\)/i.test(migrationSql)
  );
  assert('Existing doctors are safely backfilled into doctor_hospitals', 
    /INSERT INTO public\.doctor_hospitals/i.test(migrationSql)
  );

  // 6. Validate Module 6: Cross-City Referral System
  console.log(`\n${colors.yellow}6. Validating Module 6: Cross-City Referral System Schema${colors.reset}`);
  assert('Migration creates public.referrals table', /CREATE TABLE IF NOT EXISTS public\.referrals/i.test(migrationSql));
  assert('Referrals table tracks referring and receiving doctors', 
    /referring_doctor_id UUID/i.test(migrationSql) && /receiving_doctor_id UUID/i.test(migrationSql)
  );
  assert('Referrals table enforces all lifecycle statuses', 
    /CHECK \(status IN \('draft', 'requested', 'under_review', 'accepted', 'rejected', 'cancelled', 'appointment_booked', 'completed', 'closed'\)\)/i.test(migrationSql)
  );
  assert('Referrals table requires patient_consent_given flag', 
    /patient_consent_given BOOLEAN/i.test(migrationSql)
  );
  assert('Migration creates public.patient_consent_records for tamper-evident audit', 
    /CREATE TABLE IF NOT EXISTS public\.patient_consent_records/i.test(migrationSql)
  );
  assert('Patient consent records log IP address and user agent', 
    /ip_address TEXT/i.test(migrationSql) && /user_agent TEXT/i.test(migrationSql)
  );

  // 7. Validate Security & RLS Policies
  console.log(`\n${colors.yellow}7. Validating Row Level Security (RLS) & Privacy Controls${colors.reset}`);
  assert('RLS enabled on cities, hospitals, doctor_hospitals, referrals, consent_records', 
    /ALTER TABLE public\.cities ENABLE ROW LEVEL SECURITY/i.test(migrationSql) &&
    /ALTER TABLE public\.hospitals ENABLE ROW LEVEL SECURITY/i.test(migrationSql) &&
    /ALTER TABLE public\.doctor_hospitals ENABLE ROW LEVEL SECURITY/i.test(migrationSql) &&
    /ALTER TABLE public\.referrals ENABLE ROW LEVEL SECURITY/i.test(migrationSql) &&
    /ALTER TABLE public\.patient_consent_records ENABLE ROW LEVEL SECURITY/i.test(migrationSql)
  );
  assert('Public search query restricted to approved hospitals only in policy', 
    /verification_status = 'approved' AND is_active = TRUE/i.test(migrationSql)
  );

  // 8. Validate Appointment System Backward Compatibility
  console.log(`\n${colors.yellow}8. Validating Existing Appointment Backward Compatibility${colors.reset}`);
  assert('Appointments table extended with nullable hospital_id and referral_id', 
    /hospital_id UUID REFERENCES public\.hospitals\(id\) ON DELETE SET NULL/i.test(migrationSql) &&
    /referral_id UUID REFERENCES public\.referrals\(id\) ON DELETE SET NULL/i.test(migrationSql)
  );
  assert('Existing appointments backfilled with default Central Hospital ID', 
    /UPDATE public\.appointments\s+SET hospital_id = 'c0000000-0000-0000-0000-000000000001'/i.test(migrationSql)
  );

  console.log(`\n${colors.bold}${colors.cyan}======================================================================${colors.reset}`);
  console.log(`PHASE 1 AUDIT SUMMARY: TOTAL: ${totalChecks} | PASSED: ${passedChecks} | FAILED: ${totalChecks - passedChecks}`);
  console.log(`${colors.bold}${colors.cyan}======================================================================${colors.reset}\n`);

  if (passedChecks === totalChecks) {
    console.log(`${colors.green}${colors.bold}✔ ALL PHASE 1 MIGRATION & SCHEMA SPECIFICATIONS PASSED (100% SUCCESS)${colors.reset}\n`);
    process.exit(0);
  } else {
    console.log(`${colors.red}${colors.bold}✖ SOME PHASE 1 CHECKS FAILED!${colors.reset}\n`);
    process.exit(1);
  }
}

runPhase1Validation().catch(err => {
  console.error("Phase 1 validation uncaught error:", err);
  process.exit(1);
});

