/**
 * ==============================================================================
 * CAREPULSE HOSPITAL MANAGEMENT SYSTEM
 * Live Website Integrity & Full Endpoint Checker
 * ==============================================================================
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:5501';
const SUPABASE_URL = 'https://vpimfibtizurhuhljcpb.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZwaW1maWJ0aXp1cmh1aGxqY3BiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg4NzExNzIsImV4cCI6MjEwNDQ0NzE3Mn0.tziYyO2_xJY3xoRfwVIn34jsGYnuAo6_YXdDPtOYKDU';

const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  cyan: "\x1b[36m",
  yellow: "\x1b[33m",
  bold: "\x1b[1m"
};

let checkedCount = 0;
let passCount = 0;
let failCount = 0;

function report(name, ok, msg = '') {
  checkedCount++;
  if (ok) {
    passCount++;
    console.log(`  ${colors.green}✔ PASS${colors.reset} : ${name} ${msg ? `(${msg})` : ''}`);
  } else {
    failCount++;
    console.log(`  ${colors.red}✖ FAIL${colors.reset} : ${name} - ${msg}`);
  }
}

async function fetchUrl(url, options = {}) {
  try {
    const res = await fetch(url, options);
    return { ok: res.ok, status: res.status, statusText: res.statusText };
  } catch (e) {
    return { ok: false, status: 0, statusText: e.message };
  }
}

async function runIntegrityAudit() {
  console.log(`\n${colors.bold}${colors.cyan}======================================================================${colors.reset}`);
  console.log(`${colors.bold}CAREPULSE LIVE WEBSITE & ENDPOINT INTEGRITY AUDIT${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}======================================================================${colors.reset}`);

  // 1. Check all HTML Pages on Live Server
  console.log(`\n${colors.bold}${colors.yellow}1. Live Server Pages (http://127.0.0.1:5500)${colors.reset}`);
  console.log(`----------------------------------------------------------------------`);
  
  const pages = [
    "index.html",
    "doctors.html",
    "doctor-profile.html",
    "departments.html",
    "about.html",
    "contact.html",
    "login.html",
    "register.html",
    "email-confirmation.html",
    "forgot-password.html",
    "reset-password.html",
    "patient/index.html",
    "patient/appointments.html",
    "patient/appointment-details.html",
    "patient/book-appointment.html",
    "patient/queue-status.html",
    "patient/family-members.html",
    "patient/notifications.html",
    "patient/profile.html",
    "doctor/index.html",
    "doctor/appointments.html",
    "doctor/queue.html",
    "doctor/schedule.html",
    "doctor/leaves.html",
    "doctor/patients.html",
    "doctor/reviews.html",
    "doctor/profile.html",
    "admin/index.html",
    "admin/appointments.html",
    "admin/verify-appointment.html",
    "admin/doctors.html",
    "admin/departments.html",
    "admin/patients.html",
    "admin/reports.html",
    "admin/rooms.html",
    "admin/audit-logs.html"
  ];

  for (const page of pages) {
    const url = `${BASE_URL}/${page}`;
    const res = await fetchUrl(url);
    report(page, res.status === 200, `HTTP ${res.status}`);
  }

  // 2. Check Local File Assets (Scripts, CSS)
  console.log(`\n${colors.bold}${colors.yellow}2. Static Script & Asset Integrity${colors.reset}`);
  console.log(`----------------------------------------------------------------------`);
  const scripts = [
    "js/config.js",
    "js/supabase.js",
    "js/auth.js",
    "js/appointments.js",
    "js/patient.js",
    "js/doctor.js",
    "js/doctors.js",
    "js/admin.js",
    "js/pdf-receipt.js",
    "css/style.css"
  ];

  for (const script of scripts) {
    const res = await fetchUrl(`${BASE_URL}/${script}`);
    report(script, res.status === 200, `HTTP ${res.status}`);
  }

  // 3. Supabase REST API Health
  console.log(`\n${colors.bold}${colors.yellow}3. Supabase Live Cloud REST API Health${colors.reset}`);
  console.log(`----------------------------------------------------------------------`);
  const apiTables = [
    "profiles",
    "departments",
    "doctors",
    "doctor_availability",
    "appointments",
    "notifications",
    "reviews"
  ];

  for (const table of apiTables) {
    const url = `${SUPABASE_URL}/rest/v1/${table}?select=*&limit=1`;
    const res = await fetchUrl(url, {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      }
    });
    report(`Supabase REST /rest/v1/${table}`, res.status === 200, `HTTP ${res.status}`);
  }

  // 4. Critical UI Elements & Modal IDs Verification
  console.log(`\n${colors.bold}${colors.yellow}4. Feature Element IDs & Modals Verification${colors.reset}`);
  console.log(`----------------------------------------------------------------------`);
  
  const elementChecks = [
    { file: "admin/verify-appointment.html", id: "qr-reader", desc: "Feature 1: Optical QR Camera Container" },
    { file: "admin/verify-appointment.html", id: "camera-select", desc: "Feature 1: Camera Selector Dropdown" },
    { file: "patient/appointments.html", id: "reschedule-modal", desc: "Feature 2: Reschedule Consultation Modal" },
    { file: "patient/appointments.html", id: "priority-slot-offers-container", desc: "Feature 6: Waiting Priority Offers Container" },
    { file: "doctor/queue.html", id: "doctor-delay-modal", desc: "Feature 5: Doctor Delay Reporting Modal" },
    { file: "doctor/queue.html", id: "doctor-delay-active-banner", desc: "Feature 5: Doctor Delay Alert Banner" },
    { file: "doctor/index.html", id: "doctor-dashboard-delay-banner", desc: "Feature 5: Doctor Dashboard Delay Banner" },
    { file: "admin/appointments.html", id: "admin-waiting-list-view-container", desc: "Feature 6: Admin Waiting List Table Container" },
    { file: "admin/appointments.html", id: "admin-doctor-delay-view-container", desc: "Feature 5: Admin Doctor Delay Oversight Container" },
    { file: "admin/appointments.html", id: "admin-delay-modal", desc: "Feature 5: Admin Set Delay Modal" }
  ];

  for (const ec of elementChecks) {
    const fullPath = path.resolve(__dirname, '..', ec.file);
    const content = fs.readFileSync(fullPath, 'utf8');
    const hasElement = content.includes(`id="${ec.id}"`);
    report(`${ec.file} -> #${ec.id}`, hasElement, ec.desc);
  }

  // Summary
  console.log(`\n${colors.bold}${colors.cyan}======================================================================${colors.reset}`);
  console.log(`TOTAL INTEGRITY CHECKS: ${checkedCount} | PASSED: ${passCount} | FAILED: ${failCount}`);
  console.log(`${colors.bold}${colors.cyan}======================================================================${colors.reset}\n`);

  if (failCount === 0) {
    console.log(`${colors.green}${colors.bold}ALL WEBSITE CHECKS PASSED WITH 100% SUCCESS! WEBSITE IS FULLY OPERATIONAL.${colors.reset}\n`);
    process.exit(0);
  } else {
    console.log(`${colors.red}${colors.bold}${failCount} CHECKS FAILED.${colors.reset}\n`);
    process.exit(1);
  }
}

runIntegrityAudit();
