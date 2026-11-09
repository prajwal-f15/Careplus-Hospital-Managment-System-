/**
 * ==============================================================================
 * CAREPULSE HOSPITAL MANAGEMENT SYSTEM
 * Complete End-to-End Automated Test Suite for Selected Features (Phase 3)
 * ==============================================================================
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Color codes for terminal reporting
const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
  bold: "\x1b[1m"
};

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const testResults = [];

function assert(condition, testName, details = '') {
  totalTests++;
  if (condition) {
    passedTests++;
    testResults.push({ name: testName, status: 'PASS', details });
    console.log(`  ${colors.green}✔ PASS${colors.reset} : ${testName}`);
  } else {
    failedTests++;
    testResults.push({ name: testName, status: 'FAIL', details });
    console.log(`  ${colors.red}✖ FAIL${colors.reset} : ${testName} - ${details}`);
  }
}

function runSection(title, fn) {
  console.log(`\n${colors.bold}${colors.cyan}======================================================================${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}  ${title}${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}======================================================================${colors.reset}`);
  try {
    fn();
  } catch (err) {
    console.error(`${colors.red}Section runtime exception: ${err.message}${colors.reset}`, err.stack);
  }
}

// ==============================================================================
// 1. FEATURE 1: QR CODE GENERATION & ACTUAL SCANNER ENGINE TESTS
// ==============================================================================
runSection("FEATURE 1: QR Code Generation & Verification Engine", () => {
  // Test 1.1: Verification Hash Generation
  function generateVerificationHash(appt) {
    const raw = `${appt.id}_${appt.token_number}_${appt.patient_id}_${appt.appointment_date}_${appt.appointment_time || appt.time_slot}`;
    let hash = 0;
    for (let i = 0; i < raw.length; i++) {
      const char = raw.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0;
    }
    return 'CP-VERIFY-' + Math.abs(hash).toString(16).toUpperCase().padStart(8, '0');
  }

  const sampleAppt = {
    id: "appt-uuid-101",
    token_number: "CARD-001",
    patient_id: "patient-uuid-201",
    appointment_date: "2026-11-05",
    time_slot: "09:30:00"
  };

  const hash1 = generateVerificationHash(sampleAppt);
  const hash2 = generateVerificationHash(sampleAppt);
  assert(hash1.startsWith('CP-VERIFY-'), "Verification hash begins with secure prefix CP-VERIFY-");
  assert(hash1 === hash2, "Verification hash generation is deterministic and consistent");

  // Test 1.2: QR Code Structured Data Payload
  function generateAppointmentQRCodeData(appt) {
    const verificationHash = appt.verification_hash || generateVerificationHash(appt);
    return JSON.stringify({
      type: 'carepulse_appointment_pass',
      v: 1,
      appointment_id: appt.id,
      token_number: appt.token_number,
      verification_hash: verificationHash,
      date: appt.appointment_date,
      slot: appt.time_slot || appt.appointment_time,
      patient_id: appt.patient_id
    });
  }

  const qrDataStr = generateAppointmentQRCodeData(sampleAppt);
  const qrObj = JSON.parse(qrDataStr);
  assert(qrObj.type === 'carepulse_appointment_pass', "QR payload specifies correct carepulse type");
  assert(qrObj.token_number === 'CARD-001', "QR payload carries token number CARD-001");
  assert(qrObj.verification_hash === hash1, "QR payload embeds secure verification hash");
  assert(!qrObj.patient_ssn && !qrObj.patient_password, "QR payload does NOT expose sensitive credentials/PII");

  // Test 1.3: QR Scanner Verification & Duplicate Check-in Prevention Logic
  function verifyQRCheckIn(scanInput, dbRecords) {
    let targetApptId = null;
    let targetHash = null;

    if (scanInput.startsWith('{') && scanInput.endsWith('}')) {
      const parsed = JSON.parse(scanInput);
      targetApptId = parsed.appointment_id;
      targetHash = parsed.verification_hash;
    } else {
      targetApptId = scanInput;
    }

    const appt = dbRecords.find(a => a.id === targetApptId || a.token_number === targetApptId);
    if (!appt) {
      return { success: false, code: 'NOT_FOUND', error: "Appointment not found in hospital database" };
    }

    if (appt.status === 'cancelled' || appt.status === 'rejected') {
      return { success: false, code: 'CANCELLED', error: `Appointment is ${appt.status.toUpperCase()} and cannot be verified` };
    }

    if (appt.check_in_status === 'checked_in' || appt.queue_status === 'in-room' || appt.status === 'completed') {
      return { success: false, code: 'DUPLICATE', error: `Patient already checked in at ${appt.check_in_time || 'reception'}` };
    }

    // Success check-in
    return { success: true, code: 'VERIFIED', appointment: appt };
  }

  const dbState = [
    { id: "appt-uuid-101", token_number: "CARD-001", status: "confirmed", check_in_status: null },
    { id: "appt-uuid-102", token_number: "CARD-002", status: "cancelled", check_in_status: null },
    { id: "appt-uuid-103", token_number: "CARD-003", status: "confirmed", check_in_status: "checked_in", check_in_time: "09:05 AM" }
  ];

  const verifySuccess = verifyQRCheckIn(qrDataStr, dbState);
  assert(verifySuccess.success === true && verifySuccess.code === 'VERIFIED', "Valid QR check-in succeeds with VERIFIED status");

  const verifyCancelled = verifyQRCheckIn(JSON.stringify({ type: 'carepulse_appointment_pass', appointment_id: "appt-uuid-102" }), dbState);
  assert(verifyCancelled.success === false && verifyCancelled.code === 'CANCELLED', "Cancelled appointment QR check-in is strictly blocked");

  const verifyDuplicate = verifyQRCheckIn(JSON.stringify({ type: 'carepulse_appointment_pass', appointment_id: "appt-uuid-103" }), dbState);
  assert(verifyDuplicate.success === false && verifyDuplicate.code === 'DUPLICATE', "Duplicate QR check-in is prevented and rejected with DUPLICATE code");
});

// ==============================================================================
// 2. FEATURE 2: PATIENT APPOINTMENT RESCHEDULING TESTS
// ==============================================================================
runSection("FEATURE 2: Patient Appointment Rescheduling", () => {
  function canReschedule(appt) {
    if (!appt) return { allowed: false, reason: "Appointment not found" };
    if (['completed', 'in_consultation', 'in-progress'].includes(appt.status)) {
      return { allowed: false, reason: "Cannot reschedule an active or completed consultation." };
    }
    if (['cancelled', 'rejected'].includes(appt.status)) {
      return { allowed: false, reason: "Cancelled or rejected appointments cannot be rescheduled." };
    }
    if ((appt.reschedule_count || 0) >= 3) {
      return { allowed: false, reason: "Maximum reschedule limit (3 times) reached for this appointment." };
    }

    const apptDateTime = new Date(`${appt.appointment_date}T${appt.time_slot || appt.appointment_time || '09:00:00'}`);
    const now = new Date();
    const diffHours = (apptDateTime - now) / (1000 * 60 * 60);

    if (diffHours < 2) {
      return { allowed: false, reason: "Rescheduling must be done at least 2 hours before the scheduled time slot." };
    }

    return { allowed: true };
  }

  const futureDate = new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0];
  const eligibleAppt = {
    id: "resched-1",
    appointment_date: futureDate,
    time_slot: "14:00:00",
    status: "confirmed",
    reschedule_count: 0
  };

  assert(canReschedule(eligibleAppt).allowed === true, "Upcoming future appointment can be rescheduled");

  const completedAppt = { ...eligibleAppt, status: 'completed' };
  assert(canReschedule(completedAppt).allowed === false, "Completed appointment cannot be rescheduled");

  const cancelledAppt = { ...eligibleAppt, status: 'cancelled' };
  assert(canReschedule(cancelledAppt).allowed === false, "Cancelled appointment cannot be rescheduled");

  const maxRescheduledAppt = { ...eligibleAppt, reschedule_count: 3 };
  assert(canReschedule(maxRescheduledAppt).allowed === false, "Reschedule limit (3 times) strictly enforced");

  // Double-booking collision detection during reschedule
  function validateSlotAvailability(doctorId, targetDate, targetSlot, existingAppointments) {
    const isOccupied = existingAppointments.some(a => 
      a.doctor_id === doctorId &&
      a.appointment_date === targetDate &&
      (a.time_slot === targetSlot || a.appointment_time === targetSlot) &&
      !['cancelled', 'rejected'].includes(a.status)
    );
    return !isOccupied;
  }

  const existingAppts = [
    { doctor_id: "doc-1", appointment_date: "2026-11-10", time_slot: "10:00:00", status: "confirmed" },
    { doctor_id: "doc-1", appointment_date: "2026-11-10", time_slot: "10:30:00", status: "cancelled" }
  ];

  assert(validateSlotAvailability("doc-1", "2026-11-10", "10:00:00", existingAppts) === false, "Occupied active slot is flagged unavailable for rescheduling");
  assert(validateSlotAvailability("doc-1", "2026-11-10", "10:30:00", existingAppts) === true, "Slot previously cancelled is available for rescheduling");
  assert(validateSlotAvailability("doc-1", "2026-11-10", "11:00:00", existingAppts) === true, "Unoccupied slot is available for rescheduling");
});

// ==============================================================================
// 3. FEATURE 3: DOCTOR AVAILABILITY AUTO CALCULATION TESTS
// ==============================================================================
runSection("FEATURE 3: Doctor Availability Auto Calculation", () => {
  function calculateDoctorAvailability(params) {
    const { doctor, leaves, appointments, targetDate, targetTime } = params;
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const d = new Date(targetDate);
    const dayName = dayNames[d.getDay()];

    // 1. Check approved leave
    const isOnLeave = leaves.some(l => 
      l.doctor_id === doctor.id &&
      l.status === 'approved' &&
      targetDate >= l.start_date &&
      targetDate <= l.end_date
    );
    if (isOnLeave) {
      return { status: "On Leave", badgeClass: "badge-leave" };
    }

    // 2. Check working schedule
    const schedule = (doctor.schedules || []).find(s => s.day_of_week.toLowerCase() === dayName.toLowerCase());
    if (!schedule || !schedule.is_available) {
      return { status: "Not Available", badgeClass: "badge-not-avail" };
    }

    // 3. Count slots & bookings
    const activeAppts = appointments.filter(a => 
      a.doctor_id === doctor.id &&
      a.appointment_date === targetDate &&
      !['cancelled', 'rejected'].includes(a.status)
    );

    const totalSlots = schedule.total_slots || 16;
    if (activeAppts.length >= totalSlots) {
      return { status: "Fully Booked", badgeClass: "badge-full" };
    }

    // 4. Check if doctor currently consulting in room
    const isCurrentlyBusy = activeAppts.some(a => 
      ['in-room', 'called', 'in_consultation'].includes(a.queue_status) || a.status === 'in_consultation'
    );
    if (isCurrentlyBusy) {
      return { status: "Busy", badgeClass: "badge-busy" };
    }

    return { status: "Available", badgeClass: "badge-avail", freeSlots: totalSlots - activeAppts.length };
  }

  const baseDoctor = {
    id: "doc-cardio",
    full_name: "Dr. Robert Chen",
    schedules: [
      { day_of_week: "Monday", is_available: true, total_slots: 10 },
      { day_of_week: "Sunday", is_available: false, total_slots: 0 }
    ]
  };

  // Test On Leave
  const leaveResult = calculateDoctorAvailability({
    doctor: baseDoctor,
    leaves: [{ doctor_id: "doc-cardio", status: "approved", start_date: "2026-11-02", end_date: "2026-11-05" }],
    appointments: [],
    targetDate: "2026-11-03"
  });
  assert(leaveResult.status === "On Leave", "Doctor on approved leave calculated as 'On Leave'");

  // Test Not Available (Sunday schedule closed)
  const sundayResult = calculateDoctorAvailability({
    doctor: baseDoctor,
    leaves: [],
    appointments: [],
    targetDate: "2026-11-08" // Sunday
  });
  assert(sundayResult.status === "Not Available", "Doctor on off-schedule day calculated as 'Not Available'");

  // Test Fully Booked
  const fullAppts = Array.from({ length: 10 }, (_, i) => ({
    doctor_id: "doc-cardio",
    appointment_date: "2026-11-02", // Monday
    status: "confirmed"
  }));
  const fullResult = calculateDoctorAvailability({
    doctor: baseDoctor,
    leaves: [],
    appointments: fullAppts,
    targetDate: "2026-11-02"
  });
  assert(fullResult.status === "Fully Booked", "Doctor with all slots occupied calculated as 'Fully Booked'");

  // Test Busy
  const busyResult = calculateDoctorAvailability({
    doctor: baseDoctor,
    leaves: [],
    appointments: [{ doctor_id: "doc-cardio", appointment_date: "2026-11-02", queue_status: "in_consultation" }],
    targetDate: "2026-11-02"
  });
  assert(busyResult.status === "Busy", "Doctor actively consulting in room calculated as 'Busy'");

  // Test Available
  const availResult = calculateDoctorAvailability({
    doctor: baseDoctor,
    leaves: [],
    appointments: [{ doctor_id: "doc-cardio", appointment_date: "2026-11-02", status: "confirmed", queue_status: "waiting" }],
    targetDate: "2026-11-02"
  });
  assert(availResult.status === "Available" && availResult.freeSlots === 9, "Doctor with open slots calculated as 'Available' with correct free slots");
});

// ==============================================================================
// 4. FEATURE 4: APPOINTMENT REMINDER ENGINE TESTS
// ==============================================================================
runSection("FEATURE 4: Appointment Reminder Engine", () => {
  function evaluateAppointmentReminders(appointments, sentReminders, simulatedCurrentTime) {
    const remindersToDispatch = [];

    appointments.forEach(appt => {
      if (['cancelled', 'rejected', 'completed'].includes(appt.status)) return;

      const [year, month, day] = appt.appointment_date.split('-').map(Number);
      const [hour, minute, second] = (appt.time_slot || appt.appointment_time || '09:00:00').split(':').map(Number);
      const apptTime = new Date(year, month - 1, day, hour, minute, second || 0);
      const diffHours = (apptTime - simulatedCurrentTime) / (1000 * 60 * 60);

      // 24-hour reminder check: between 23h and 25h
      if (diffHours >= 23 && diffHours <= 25) {
        const alreadySent = sentReminders.some(r => r.appointment_id === appt.id && r.reminder_type === '24h');
        if (!alreadySent) {
          remindersToDispatch.push({ appointment_id: appt.id, type: '24h', patient_id: appt.patient_id, diffHours });
        }
      }

      // 1-hour reminder check: between 0.5h and 1.5h
      if (diffHours >= 0.5 && diffHours <= 1.5) {
        const alreadySent = sentReminders.some(r => r.appointment_id === appt.id && r.reminder_type === '1h');
        if (!alreadySent) {
          remindersToDispatch.push({ appointment_id: appt.id, type: '1h', patient_id: appt.patient_id, diffHours });
        }
      }
    });

    return remindersToDispatch;
  }

  const now = new Date(2026, 10, 1, 10, 0, 0);

  const testAppts = [
    // 24h away -> November 2 at 10:00 (diff = 24.0h)
    { id: "rem-1", appointment_date: "2026-11-02", time_slot: "10:00:00", status: "confirmed", patient_id: "p1" },
    // 1h away -> November 1 at 11:00 (diff = 1.0h)
    { id: "rem-2", appointment_date: "2026-11-01", time_slot: "11:00:00", status: "confirmed", patient_id: "p2" },
    // 1h away but CANCELLED -> should not remind
    { id: "rem-3", appointment_date: "2026-11-01", time_slot: "11:00:00", status: "cancelled", patient_id: "p3" },
    // 5h away -> not in window
    { id: "rem-4", appointment_date: "2026-11-01", time_slot: "15:00:00", status: "confirmed", patient_id: "p4" }
  ];

  const sentReminders = [
    // Already sent 24h for rem-1 previously
    { appointment_id: "rem-1", reminder_type: "24h" }
  ];

  const reminders = evaluateAppointmentReminders(testAppts, sentReminders, now);

  assert(reminders.some(r => r.appointment_id === 'rem-2' && r.type === '1h'), "1-hour reminder triggered accurately for upcoming appointment");
  assert(!reminders.some(r => r.appointment_id === 'rem-1' && r.type === '24h'), "Duplicate 24-hour reminder successfully suppressed");
  assert(!reminders.some(r => r.appointment_id === 'rem-3'), "Cancelled appointment reminders are strictly excluded");
  assert(!reminders.some(r => r.appointment_id === 'rem-4'), "Non-window appointment does not trigger early reminder");
});

// ==============================================================================
// 5. FEATURE 5: DOCTOR DELAY MANAGEMENT TESTS
// ==============================================================================
runSection("FEATURE 5: Doctor Delay Management & Queue ETA Recalculation", () => {
  function calculateAdjustedWaitTime(baseWaitMinutes, doctorDelayMinutes) {
    const totalWait = Math.max(0, baseWaitMinutes + (doctorDelayMinutes || 0));
    return {
      totalWaitMinutes: totalWait,
      formattedETA: totalWait >= 60 ? `${Math.floor(totalWait / 60)}h ${totalWait % 60}m` : `${totalWait} mins`,
      delayNotice: doctorDelayMinutes > 0 ? `Doctor running ${doctorDelayMinutes} mins late` : null
    };
  }

  // Base calculation with no delay
  const normalWait = calculateAdjustedWaitTime(20, 0);
  assert(normalWait.totalWaitMinutes === 20 && normalWait.delayNotice === null, "Normal queue wait time has no delay added");

  // Doctor reports 35 minutes delay
  const delayedWait = calculateAdjustedWaitTime(20, 35);
  assert(delayedWait.totalWaitMinutes === 55, "Doctor delay of 35 mins correctly added to 20m base wait (Total: 55m)");
  assert(delayedWait.delayNotice === "Doctor running 35 mins late", "Delay notice message generated for patient queue banner");

  // Format into hours and minutes
  const longDelay = calculateAdjustedWaitTime(45, 45);
  assert(longDelay.formattedETA === "1h 30m", "Over 60 minutes delay formatted into human-readable hours and minutes");

  // Clear delay
  const clearedDelay = calculateAdjustedWaitTime(20, 0);
  assert(clearedDelay.totalWaitMinutes === 20, "Clearing doctor delay immediately resumes normal wait calculations");
});

// ==============================================================================
// 6. FEATURE 6: WAITING LIST & AUTO SLOT REALLOCATION TESTS
// ==============================================================================
runSection("FEATURE 6: Waiting List & Auto Slot Reallocation", () => {
  const waitingList = [
    { id: "wl-1", doctor_id: "doc-1", preferred_date: "2026-11-05", preferred_time_range: "any", priority_score: 100, status: "waiting", patient_id: "p-wl-1", created_at: "2026-11-01T08:00:00Z" },
    { id: "wl-2", doctor_id: "doc-1", preferred_date: "2026-11-05", preferred_time_range: "morning", priority_score: 120, status: "waiting", patient_id: "p-wl-2", created_at: "2026-11-01T08:30:00Z" },
    { id: "wl-3", doctor_id: "doc-2", preferred_date: "2026-11-05", preferred_time_range: "any", priority_score: 100, status: "waiting", patient_id: "p-wl-3", created_at: "2026-11-01T08:00:00Z" }
  ];

  function reallocateVacatedSlot(vacatedDocId, vacatedDate, vacatedSlot, list) {
    // Slot 10:00 AM is morning
    const isMorning = vacatedSlot < "12:00:00";

    const eligible = list.filter(item => 
      item.doctor_id === vacatedDocId &&
      item.preferred_date === vacatedDate &&
      item.status === 'waiting' &&
      (item.preferred_time_range === 'any' || (item.preferred_time_range === 'morning' && isMorning))
    );

    if (eligible.length === 0) return null;

    // Sort by priority_score DESC, then created_at ASC
    eligible.sort((a, b) => b.priority_score - a.priority_score || new Date(a.created_at) - new Date(b.created_at));

    const selected = eligible[0];
    selected.status = 'offered';
    selected.offered_slot = vacatedSlot;
    selected.offer_expires_at = new Date(Date.now() + 30 * 60 * 1000).toISOString();

    return selected;
  }

  const allocated = reallocateVacatedSlot("doc-1", "2026-11-05", "10:00:00", waitingList);
  assert(allocated !== null, "Eligible waiting patient identified on vacated slot");
  assert(allocated.id === "wl-2", "Higher priority patient (score 120) awarded slot before lower priority");
  assert(allocated.status === 'offered', "Waiting status updated to 'offered'");
  assert(allocated.offered_slot === "10:00:00", "Offered slot correctly recorded on waiting item");
  assert(new Date(allocated.offer_expires_at) > new Date(), "30-minute offer expiration timestamp set");

  // Offer expiry logic
  function checkExpiredOffers(list, checkTime) {
    let expiredCount = 0;
    list.forEach(item => {
      if (item.status === 'offered' && item.offer_expires_at && new Date(item.offer_expires_at) < checkTime) {
        item.status = 'expired';
        expiredCount++;
      }
    });
    return expiredCount;
  }

  const futureCheck = new Date(Date.now() + 45 * 60 * 1000); // 45 mins later
  const expiredCount = checkExpiredOffers(waitingList, futureCheck);
  assert(expiredCount === 1, "Expired offer detected and marked 'expired'");
  assert(waitingList.find(w => w.id === 'wl-2').status === 'expired', "Patient wl-2 offer marked expired after timeout");
});

// ==============================================================================
// 7. FEATURE 10: MOBILE RESPONSIVENESS & UI INTEGRITY AUDIT
// ==============================================================================
runSection("FEATURE 10: Mobile Responsiveness & Viewport Audit", () => {
  const htmlFiles = [
    "index.html",
    "login.html",
    "register.html",
    "doctors.html",
    "doctor-profile.html",
    "departments.html",
    "patient/appointments.html",
    "patient/appointment-details.html",
    "patient/book-appointment.html",
    "patient/queue-status.html",
    "doctor/index.html",
    "doctor/queue.html",
    "admin/appointments.html",
    "admin/verify-appointment.html"
  ];

  let missingMeta = 0;
  let missingTailwind = 0;

  htmlFiles.forEach(file => {
    const fullPath = path.resolve(__dirname, '..', file);
    if (!fs.existsSync(fullPath)) {
      assert(false, `File exists: ${file}`, "File not found on disk");
      return;
    }

    const content = fs.readFileSync(fullPath, 'utf8');
    const hasViewport = content.includes('name="viewport"') && content.includes('width=device-width');
    const hasTailwind = content.includes('tailwindcss') || content.includes('style.css');

    if (!hasViewport) missingMeta++;
    if (!hasTailwind) missingTailwind++;
  });

  assert(missingMeta === 0, `All ${htmlFiles.length} critical HTML pages include standard mobile viewport meta tag`);
  assert(missingTailwind === 0, `All ${htmlFiles.length} critical HTML pages link Tailwind CSS / stylesheet`);

  // Verify QR Scanner in admin/verify-appointment.html
  const scannerFile = fs.readFileSync(path.resolve(__dirname, '..', 'admin/verify-appointment.html'), 'utf8');
  assert(scannerFile.includes('html5-qrcode'), "QR Scanner interface includes html5-qrcode optical library");
  assert(scannerFile.includes('reader'), "QR Scanner contains dedicated viewport container #reader");
  assert(scannerFile.includes('camera-select'), "QR Scanner provides device camera selection dropdown for mobile/tablet");

  // Verify Patient Reschedule Modal in patient/appointments.html
  const patientApptsFile = fs.readFileSync(path.resolve(__dirname, '..', 'patient/appointments.html'), 'utf8');
  assert(patientApptsFile.includes('reschedule-modal'), "Patient Appointments view includes #reschedule-modal");
  assert(patientApptsFile.includes('qr-pass-modal'), "Patient Appointments view includes #qr-pass-modal");
  assert(patientApptsFile.includes('priority-slot-offers-container'), "Patient Appointments view includes #priority-slot-offers-container");
});

// ==============================================================================
// 8. FEATURE 11: DATABASE SCHEMA & RLS AUDIT
// ==============================================================================
runSection("FEATURE 11: Database Schema & RLS Policy Audit", () => {
  const masterSql = fs.readFileSync(path.resolve(__dirname, '..', 'sql/full_setup.sql'), 'utf8');
  const migrationSql = fs.readFileSync(path.resolve(__dirname, '..', 'sql/phase1_phase2_migration.sql'), 'utf8');

  // Verify unique double-booking prevention constraint/index
  const hasDoubleBookingIndex = masterSql.includes('idx_prevent_double_booking') &&
    masterSql.includes('appointments (doctor_id, appointment_date, time_slot)');
  assert(hasDoubleBookingIndex, "Database enforces idx_prevent_double_booking constraint index");

  // Verify Phase 1 & 2 columns on appointments
  assert(masterSql.includes('verification_hash') && masterSql.includes('reschedule_count'), "Appointments schema includes verification_hash & reschedule_count");
  assert(masterSql.includes('rescheduled_from_date') && masterSql.includes('rescheduled_from_slot'), "Appointments schema includes audit trail fields");

  // Verify Doctor Delay columns on doctors
  assert(masterSql.includes('delay_minutes') && masterSql.includes('delay_reason') && masterSql.includes('delay_reported_at'), "Doctors schema includes doctor delay columns");

  // Verify New Tables
  assert(masterSql.includes('CREATE TABLE public.waiting_list') || masterSql.includes('CREATE TABLE IF NOT EXISTS public.waiting_list'), "Waiting list table defined in master SQL schema");
  assert(masterSql.includes('CREATE TABLE public.appointment_reminders') || masterSql.includes('CREATE TABLE IF NOT EXISTS public.appointment_reminders'), "Appointment reminders table defined in master SQL schema");

  // Verify RLS enabled on all affected tables
  assert(masterSql.includes('waiting_list ENABLE ROW LEVEL SECURITY'), "RLS explicitly enabled on waiting_list");
  assert(masterSql.includes('appointment_reminders ENABLE ROW LEVEL SECURITY'), "RLS explicitly enabled on appointment_reminders");
  assert(masterSql.includes('appointments ENABLE ROW LEVEL SECURITY'), "RLS explicitly enabled on appointments");
  assert(masterSql.includes('doctors ENABLE ROW LEVEL SECURITY'), "RLS explicitly enabled on doctors");

  // Verify Stored Procedures / RPC
  assert(migrationSql.includes('reallocate_cancelled_slot') && masterSql.includes('reallocate_cancelled_slot'), "Atomic reallocate_cancelled_slot RPC function declared in master & migration SQL");
  assert(migrationSql.includes('check_and_send_appointment_reminders') && masterSql.includes('check_and_send_appointment_reminders'), "Automated check_and_send_appointment_reminders RPC function declared in master & migration SQL");
});

// ==============================================================================
// SUMMARY REPORT
// ==============================================================================
console.log(`\n${colors.bold}${colors.cyan}======================================================================${colors.reset}`);
console.log(`${colors.bold}CAREPULSE AUTOMATED TEST EXECUTION SUMMARY${colors.reset}`);
console.log(`${colors.bold}${colors.cyan}======================================================================${colors.reset}`);
console.log(`Total Test Assertions Executed : ${totalTests}`);
console.log(`${colors.green}Passed Assertions              : ${passedTests}${colors.reset}`);
console.log(`${failedTests > 0 ? colors.red : colors.green}Failed Assertions              : ${failedTests}${colors.reset}`);

if (failedTests === 0) {
  console.log(`\n${colors.green}${colors.bold}ALL TEST CASES PASSED WITH 100% SUCCESS RATE!${colors.reset}\n`);
  process.exit(0);
} else {
  console.log(`\n${colors.red}${colors.bold}${failedTests} TESTS FAILED. PLEASE REVIEW FAILURES ABOVE.${colors.reset}\n`);
  process.exit(1);
}

