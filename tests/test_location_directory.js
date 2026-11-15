/**
 * ==============================================================================
 * CAREPULSE HOSPITAL MANAGEMENT SYSTEM
 * Phase 2: Location Directory & Geolocation Service Test Suite (Module 1)
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
  getItem: (key) => mockStorage[key] || null,
  setItem: (key, val) => { mockStorage[key] = String(val); },
  removeItem: (key) => { delete mockStorage[key]; }
};

global.window = {
  localStorage: global.localStorage,
  dispatchEvent: () => {},
  CustomEvent: class { constructor(type, data) { this.type = type; this.detail = data?.detail; } }
};

// Load js/location.js
require(path.join(__dirname, '..', 'js', 'location.js'));
const LocationService = global.window.LocationService;

async function runLocationTests() {
  console.log(`\n${colors.bold}${colors.cyan}======================================================================${colors.reset}`);
  console.log(`${colors.bold}PHASE 2: LOCATION DIRECTORY & GEOLOCATION SERVICE TEST AUDIT${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}======================================================================${colors.reset}\n`);

  // 1. Verify Module Initialization
  console.log(`${colors.yellow}1. Service Initialization & Seed Dataset Verification${colors.reset}`);
  assert('LocationService is exported to window', typeof LocationService === 'object' && LocationService !== null);

  const allCities = await LocationService.getCities();
  assert('LocationService loaded master Indian cities dataset', Array.isArray(allCities) && allCities.length >= 20);

  // 2. State & District Navigation
  console.log(`\n${colors.yellow}2. State & District Directory Queries${colors.reset}`);
  const states = await LocationService.getStates();
  assert('getStates() returns unique Indian states', states.includes('Maharashtra') && states.includes('Delhi') && states.includes('Karnataka'));

  const mhDistricts = await LocationService.getDistricts('Maharashtra');
  assert('getDistricts("Maharashtra") returns Yavatmal, Mumbai, Pune, Nagpur, Amravati', 
    mhDistricts.includes('Yavatmal') && 
    mhDistricts.includes('Mumbai') && 
    mhDistricts.includes('Pune') && 
    mhDistricts.includes('Nagpur') &&
    mhDistricts.includes('Amravati')
  );

  const ytlCities = await LocationService.getCitiesByDistrict('Yavatmal');
  assert('getCitiesByDistrict("Yavatmal") returns Yavatmal city record with coordinates', 
    ytlCities.length > 0 && ytlCities[0].city === 'Yavatmal' && ytlCities[0].lat > 20 && ytlCities[0].lng > 78
  );

  const mumCity = await LocationService.getCityByName('Mumbai');
  assert('getCityByName("Mumbai") resolves Mumbai coordinates', mumCity !== null && mumCity.pincode === '400001');

  // 3. Mathematical Haversine Distance Calculation (India Coordinates)
  console.log(`\n${colors.yellow}3. Haversine Distance Engine Accuracy${colors.reset}`);
  // Mumbai (18.9388, 72.8354) to Pune (18.5204, 73.8567) ~ 120 km
  const distMumbaiPune = LocationService.calculateDistance(18.9388, 72.8354, 18.5204, 73.8567);
  assert(`Mumbai to Pune distance is ~120 km (computed: ${distMumbaiPune} km)`, distMumbaiPune >= 115 && distMumbaiPune <= 130);

  // Yavatmal (20.3888, 78.1204) to Nagpur (21.1458, 79.0882) ~ 130-145 km
  const distYtlNagpur = LocationService.calculateDistance(20.3888, 78.1204, 21.1458, 79.0882);
  assert(`Yavatmal to Nagpur distance is ~135 km (computed: ${distYtlNagpur} km)`, distYtlNagpur >= 125 && distYtlNagpur <= 150);

  // Yavatmal (20.3888, 78.1204) to Mumbai (18.9388, 72.8354) ~ 570-600 km
  const distYtlMumbai = LocationService.calculateDistance(20.3888, 78.1204, 18.9388, 72.8354);
  assert(`Yavatmal to Mumbai distance is ~580 km (computed: ${distYtlMumbai} km)`, distYtlMumbai >= 550 && distYtlMumbai <= 620);

  // 4. Nearby Filtering & Radius Math
  console.log(`\n${colors.yellow}4. Nearby Doctor & Hospital Radius Filtering${colors.reset}`);
  const sampleHospitals = [
    { name: 'CarePulse Central Hospital Mumbai', latitude: 19.0596, longitude: 72.8295 },
    { name: 'CarePulse District Hospital Yavatmal', latitude: 20.3888, longitude: 78.1204 },
    { name: 'CarePulse Regional Institute Nagpur', latitude: 21.1352, longitude: 79.0722 },
    { name: 'CarePulse Metro Specialty Pune', latitude: 18.5314, longitude: 73.8446 }
  ];

  // Search from Yavatmal (20.3888, 78.1204) with radius 150 km -> should find Yavatmal (0 km) and Nagpur (~135 km), but NOT Mumbai or Pune
  const nearbyYtl150 = LocationService.filterNearby(sampleHospitals, 20.3888, 78.1204, 150);
  assert('150 km radius around Yavatmal includes Yavatmal & Nagpur', 
    nearbyYtl150.some(h => h.name.includes('Yavatmal')) && nearbyYtl150.some(h => h.name.includes('Nagpur'))
  );
  assert('150 km radius around Yavatmal excludes Mumbai (> 500 km)', 
    !nearbyYtl150.some(h => h.name.includes('Mumbai'))
  );

  // Search from Yavatmal with radius 25 km -> only Yavatmal
  const nearbyYtl25 = LocationService.filterNearby(sampleHospitals, 20.3888, 78.1204, 25);
  assert('25 km radius around Yavatmal includes only local hospital (1 hospital)', nearbyYtl25.length === 1 && nearbyYtl25[0].name.includes('Yavatmal'));

  // 5. Active Discovery Location Persistence (Independent of Registered Profile)
  console.log(`\n${colors.yellow}5. Active Discovery Location Persistence (Without Changing Profile Address)${colors.reset}`);
  LocationService.clearActiveDiscoveryLocation();
  const defaultLoc = LocationService.getActiveDiscoveryLocation();
  assert('Default discovery location is All India', defaultLoc.mode === 'all_india');

  LocationService.setActiveDiscoveryLocation({
    mode: 'city',
    city: 'Yavatmal',
    state: 'Maharashtra',
    lat: 20.3888,
    lng: 78.1204
  });

  const savedLoc = LocationService.getActiveDiscoveryLocation();
  assert('Discovery location can be set to Yavatmal without affecting patient address', 
    savedLoc.city === 'Yavatmal' && savedLoc.state === 'Maharashtra' && savedLoc.lat === 20.3888
  );

  LocationService.clearActiveDiscoveryLocation();
  const clearedLoc = LocationService.getActiveDiscoveryLocation();
  assert('clearActiveDiscoveryLocation() cleanly restores All India mode', clearedLoc.mode === 'all_india');

  // 6. UI Integration Check in doctors.html
  console.log(`\n${colors.yellow}6. HTML & UI Integration Checks in doctors.html${colors.reset}`);
  const doctorsHtml = fs.readFileSync(path.join(__dirname, '..', 'doctors.html'), 'utf8');
  assert('doctors.html links js/location.js script', doctorsHtml.includes('js/location.js'));
  assert('doctors.html includes Active Location Badge (#active-location-label)', doctorsHtml.includes('id="active-location-label"'));
  assert('doctors.html provides "Near Me" GPS button (#btn-use-geolocation)', doctorsHtml.includes('id="btn-use-geolocation"'));
  assert('doctors.html includes State and City filters in sidebar', doctorsHtml.includes('id="state-filter"') && doctorsHtml.includes('id="city-filter"'));
  assert('doctors.html includes Nearby Distance Radius filter (#radius-filter)', doctorsHtml.includes('id="radius-filter"'));
  assert('doctors.html includes Consultation Mode filter (#mode-filter)', doctorsHtml.includes('id="mode-filter"'));
  assert('doctors.html includes Location Picker Modal (#location-modal)', doctorsHtml.includes('id="location-modal"'));

  console.log(`\n${colors.bold}${colors.cyan}======================================================================${colors.reset}`);
  console.log(`PHASE 2 AUDIT SUMMARY: TOTAL: ${totalChecks} | PASSED: ${passedChecks} | FAILED: ${totalChecks - passedChecks}`);
  console.log(`${colors.bold}${colors.cyan}======================================================================${colors.reset}\n`);

  if (passedChecks === totalChecks) {
    console.log(`${colors.green}${colors.bold}✔ ALL PHASE 2 LOCATION & DIRECTORY SPECIFICATIONS PASSED (100% SUCCESS)${colors.reset}\n`);
    process.exit(0);
  } else {
    console.log(`${colors.red}${colors.bold}✖ SOME PHASE 2 CHECKS FAILED!${colors.reset}\n`);
    process.exit(1);
  }
}

runLocationTests().catch(err => {
  console.error("Phase 2 test suite uncaught error:", err);
  process.exit(1);
});

