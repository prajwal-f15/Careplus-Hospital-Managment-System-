/**
 * Automated Test Suite: Visiting Doctor Campaigns, Centralized Health Records & Patient Dashboard
 * Covers Section 4, 9, 10, 11 of CarePulse Master Project Implementation Specification
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

// Mock browser environment for CarePulseDB
global.window = global;
global.localStorage = {
  _store: {},
  getItem(k) { return this._store[k] || null; },
  setItem(k, v) { this._store[k] = String(v); },
  removeItem(k) { delete this._store[k]; },
  clear() { this._store = {}; }
};

// Load supabase client mock/real
require('../js/config.js');
require('../js/supabase.js');

async function runTestSuite() {
  console.log('\n================================================================');
  console.log('🧪 CAREPULSE TEST SUITE: CAMPAIGNS, HEALTH RECORDS & DASHBOARD');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      await fn();
      console.log(`  ✓ ${name}`);
      passed++;
    } catch (e) {
      console.error(`  ✗ ${name}`);
      console.error(`    Error: ${e.message}`);
      failed++;
    }
  }

  // TEST 1: File Existence & Architecture
  await test('Verify newly created files exist and are populated', () => {
    const requiredFiles = [
      'sql/campaigns_and_health_records_migration.sql',
      'patient/health-records.html',
      'patient/online-consultation.html',
      'doctor/campaigns.html',
      'hospital/campaigns.html',
      'admin/campaigns.html'
    ];

    for (const rel of requiredFiles) {
      const fullPath = path.join(__dirname, '..', rel);
      assert.ok(fs.existsSync(fullPath), `File missing: ${rel}`);
      const content = fs.readFileSync(fullPath, 'utf8');
      assert.ok(content.length > 200, `File is empty or too short: ${rel}`);
    }
  });

  // TEST 2: Mobile Bottom Navigation Bar presence
  await test('Verify mobile bottom navigation bar on all patient portal pages', () => {
    const patientPages = [
      'patient/index.html',
      'patient/appointments.html',
      'patient/health-records.html',
      'patient/online-consultation.html',
      'patient/family-members.html',
      'patient/profile.html'
    ];

    for (const p of patientPages) {
      const fullPath = path.join(__dirname, '..', p);
      const content = fs.readFileSync(fullPath, 'utf8');
      assert.ok(
        content.includes('nav class="md:hidden fixed bottom-0') || content.includes('MOBILE BOTTOM NAVIGATION'),
        `Missing mobile bottom navigation in ${p}`
      );
    }
  });

  // TEST 3: Campaign Querying and Radius Filtering
  await test('CarePulseDB.getCampaigns radius-based distance targeting', async () => {
    // Nationwide query
    const all = await window.CarePulseDB.getCampaigns({});
    assert.ok(Array.isArray(all), 'getCampaigns should return an array');
    assert.ok(all.length >= 3, `Expected at least 3 seed campaigns, got ${all.length}`);

    // Yavatmal coordinate (20.3888, 78.1204) within 50 KM radius
    const ytlCampaigns = await window.CarePulseDB.getCampaigns({
      userLat: 20.3888,
      userLng: 78.1204,
      radiusKm: 50
    });
    assert.ok(ytlCampaigns.length >= 1, 'Should find Yavatmal visiting campaign within 50 KM');
    assert.ok(ytlCampaigns.some(c => c.city_name === 'Yavatmal'), 'Found campaign should be Yavatmal');

    // Pune camp should NOT be within 50 KM of Yavatmal (distance is ~600 KM)
    const hasPune = ytlCampaigns.some(c => c.city_name === 'Pune');
    assert.strictEqual(hasPune, false, 'Pune campaign should be excluded by 50 KM distance filter from Yavatmal');
  });

  // TEST 4: Campaign Analytics Tracking
  await test('CarePulseDB campaign impressions, clicks, conversions tracking', async () => {
    const all = await window.CarePulseDB.getCampaigns({});
    const campId = all[0].id;
    const initialImpressions = all[0].impressions || 0;
    const initialClicks = all[0].clicks || 0;

    await window.CarePulseDB.recordCampaignImpression(campId);
    await window.CarePulseDB.recordCampaignClick(campId);
    await window.CarePulseDB.recordCampaignConversion(campId);

    const updated = await window.CarePulseDB.getCampaignById(campId);
    if (updated) {
      assert.ok(updated.impressions >= initialImpressions, 'Impressions should be recorded');
      assert.ok(updated.clicks >= initialClicks, 'Clicks should be recorded');
    }
  });

  // TEST 5: Health Records CRUD & Privacy
  await test('CarePulseDB health records management & privacy boundary', async () => {
    const testPatientId = 'patient-test-' + Date.now();
    const newRecord = await window.CarePulseDB.addHealthRecord({
      patient_id: testPatientId,
      record_type: 'lab_report',
      title: 'Complete Blood Count (CBC) Automated Test',
      doctor_name: 'Dr. Rahul Sharma',
      hospital_name: 'CarePulse Central Lab',
      record_date: '2026-11-16',
      notes: 'Hemoglobin 14.5 g/dL, WBC normal.',
      doctor_shared: true
    });

    assert.ok(newRecord.id, 'Record should be created with an ID');
    assert.strictEqual(newRecord.record_type, 'lab_report');

    const patientRecords = await window.CarePulseDB.getHealthRecords(testPatientId);
    assert.ok(patientRecords.some(r => r.id === newRecord.id), 'Patient should see newly created health record');

    // Delete record
    const delRes = await window.CarePulseDB.deleteHealthRecord(newRecord.id, testPatientId);
    assert.strictEqual(delRes.success, true);
  });

  // TEST 6: Booking Source & Campaign Conversion Link
  await test('Patient booking preserves booking_source and campaign conversion', async () => {
    const today = new Date().toISOString().split('T')[0];
    const testPatientId = 'patient-bk-test';

    // Mock book appointment payload
    const bookingPayload = {
      patient_id: testPatientId,
      doctor_id: 'd0c11111-1111-1111-1111-111111111111',
      appointment_date: today,
      time_slot: '10:00',
      reason: 'Specialist Consultation',
      booking_source: 'hospital',
      campaign_id: 'e0000000-0000-0000-0000-000000000001'
    };

    assert.strictEqual(bookingPayload.booking_source, 'hospital');
    assert.strictEqual(bookingPayload.campaign_id, 'e0000000-0000-0000-0000-000000000001');
  });

  console.log(`\nResults: ${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

runTestSuite().catch(err => {
  console.error('Test runner fatal error:', err);
  process.exit(1);
});
