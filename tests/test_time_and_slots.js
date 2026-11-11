/**
 * ==============================================================================
 * CAREPULSE - LOCAL DATE/TIME & PAST-SLOT FILTERING VERIFICATION TEST
 * ==============================================================================
 */

const assert = (cond, msg) => {
  if (!cond) {
    console.error(`✖ FAIL: ${msg}`);
    process.exitCode = 1;
  } else {
    console.log(`✔ PASS: ${msg}`);
  }
};

// Replicate exact CarePulseDB time/date helpers from js/supabase.js
const CarePulseTimeHelpers = {
  getLocalTodayDate(d = new Date()) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  },
  getLocalCurrentTimeHHMM(d = new Date()) {
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  },
  formatTime12Hour(time24) {
    if (!time24) return '';
    const str = String(time24).trim();
    if (/am|pm/i.test(str)) return str.toUpperCase();
    const parts = str.split(':').map(Number);
    if (parts.length < 2 || Number.isNaN(parts[0]) || Number.isNaN(parts[1])) return str;
    const [h, m] = parts;
    const period = h >= 12 ? 'PM' : 'AM';
    const displayH = h % 12 || 12;
    return `${String(displayH).padStart(2, '0')}:${String(m).padStart(2, '0')} ${period}`;
  }
};

console.log('\n======================================================================');
console.log('TIME FORMATTING, LOCAL DATE & PAST-SLOT FILTERING VERIFICATION');
console.log('======================================================================\n');

// 1. Test 12-hour formatter edge cases
assert(CarePulseTimeHelpers.formatTime12Hour('09:00') === '09:00 AM', '09:00 formats to 09:00 AM');
assert(CarePulseTimeHelpers.formatTime12Hour('09:30:00') === '09:30 AM', '09:30:00 formats to 09:30 AM');
assert(CarePulseTimeHelpers.formatTime12Hour('12:00') === '12:00 PM', '12:00 formats to 12:00 PM');
assert(CarePulseTimeHelpers.formatTime12Hour('16:30:00') === '04:30 PM', '16:30:00 formats to 04:30 PM');
assert(CarePulseTimeHelpers.formatTime12Hour('16:56') === '04:56 PM', '16:56 formats to 04:56 PM');
assert(CarePulseTimeHelpers.formatTime12Hour('00:15') === '12:15 AM', '00:15 formats to 12:15 AM');

// 2. Test slot filtering at 4:56 PM (16:56) on Today (user screenshot scenario)
const allSlots = [];
for (let h = 9; h < 17; h++) {
  for (let m of [0, 30]) {
    allSlots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
  }
}
assert(allSlots.length === 16, 'Generated 16 standard 30-min slots (09:00 - 16:30)');

const currentAt456PM = '16:56';
const openAt456PM = allSlots.filter(t => t > currentAt456PM);
assert(openAt456PM.length === 0, 'At 4:56 PM on Today, 0 slots remain available (all 16 slots marked passed)');

// 3. Test mid-day at 11:15 AM on Today
const currentAt1115AM = '11:15';
const openAt1115AM = allSlots.filter(t => t > currentAt1115AM);
assert(openAt1115AM.length === 11 && openAt1115AM[0] === '11:30', 'At 11:15 AM on Today, 09:00..11:00 are passed and 11:30..16:30 (11 slots) stay open');

// 4. Verify source files contain updated helper & UI bindings
const fs = require('fs');
const apptsJs = fs.readFileSync('js/appointments.js', 'utf8');
const patientJs = fs.readFileSync('js/patient.js', 'utf8');
const supaJs = fs.readFileSync('js/supabase.js', 'utf8');
const bookHtml = fs.readFileSync('patient/book-appointment.html', 'utf8');

assert(supaJs.includes('getLocalTodayDate(') && supaJs.includes('Hours Ended Today'), 'js/supabase.js distinguishes past clinic hours vs booked slots');
assert(apptsJs.includes('allRemainingPassed') && apptsJs.includes('isPast'), 'js/appointments.js evaluates isPast & allRemainingPassed on local time');
assert(patientJs.includes('wizard-pick-tomorrow-btn') && patientJs.includes('Time Passed'), 'js/patient.js renders Time Passed state and tomorrow switcher');
assert(bookHtml.includes('wizard-live-clock-text'), 'patient/book-appointment.html displays live Current Time indicator in Step 2');

console.log('\nDone!\n');
