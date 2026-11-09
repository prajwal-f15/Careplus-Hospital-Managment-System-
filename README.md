# CarePulse - Hospital Appointment Booking System

A complete, modern, responsive **Hospital Appointment Booking System** connecting **Patients, Doctors, and Healthcare Administrators**.

Designed as a production-ready **BCA Capstone Project** with full **Supabase PostgreSQL**, **Row Level Security (RLS)**, real-time queue tracking, conflict-free appointment scheduling, digital token issuance, and **Chart.js** analytics (excluding billing as required).

---

## 🌟 Key Highlights & Features

### 👤 1. Patient Portal (`/patient/`)
- **Smart Appointment Booking**: Multi-step wizard selecting Department → Doctor → Date → 30-minute available slots.
- **Double-Booking Prevention**: Database-level unique constraints and dynamic slot calculator ensure no two patients can book the same doctor at the same slot.
- **Digital Token Slip**: Generates unique department-coded queue tokens (e.g. `CARD-001`, `NEUR-014`).
- **Live Queue Tracker (`queue-status.html`)**: Real-time room token display, estimated waiting time calculation, and queue distance.
- **jsPDF Slip Download**: Download and print official hospital token slips and receipts.
- **5-Star Doctor Reviews**: Submit ratings and feedback upon completed visits.
- **Notification Center**: Real-time alerts for booking confirmation, rescheduling, and doctor calls.

### 👨‍⚕️ 2. Doctor Portal (`/doctor/`)
- **Queue Control Center**: Live patient caller button to initiate consultation and notify the patient.
- **Appointment Request Manager**: Accept or reject incoming requests with customizable notes.
- **Weekly Schedule Planner**: Configure available days (Mon-Sun), start/end hours, and slot intervals.
- **Patient History & Records**: Chronological log of previous visits and clinical observations.
- **Patient Reviews**: Read verified feedback from completed consultations.

### 👨‍💼 3. Admin Control Panel (`/admin/`)
- **Visual Analytics (Chart.js)**:
  - 7-Day Appointment Booking Volume (Line Chart)
  - Appointment Status Breakdown (Donut Chart)
  - Specialists by Department (Bar Chart)
- **Key Metrics**: Total Patients, Total Doctors, Total Appointments, Pending, Confirmed, Completed, Cancelled *(Strictly no revenue or billing statistics)*.
- **Doctor Management**: Add doctor modal, edit bio/fees, toggle verified specialist badge, delete doctor.
- **Patient Directory**: Manage registered patient accounts, view history, toggle active/suspended status.
- **Department Management**: Add/edit medical wings (Cardiology, Neurology, Orthopedics, etc.).
- **Master Reports**: Exportable and printable department utilization report.

---

## 🛠️ Technology Stack

| Layer | Technologies |
|---|---|
| **Frontend** | HTML5, CSS3 (Modern Medical Design System, Glassmorphism), Vanilla JavaScript ES6+, Tailwind CSS |
| **Icons & Visuals** | Lucide Icons, Unsplash Curated Healthcare Assets |
| **Data & Backend** | Supabase (PostgreSQL 15), Supabase Auth, Row Level Security (RLS), Supabase Realtime |
| **Offline Simulator** | Dual-Mode engine with built-in localStorage store and 1-click test credentials |
| **Libraries** | `Chart.js` (Hospital Analytics), `jsPDF` (Appointment Token Slips) |
| **Deployment** | Vercel / Netlify Static Web Hosting |

---

## 🔑 Pre-Configured Demo Accounts (1-Click Login)

The login page (`login.html`) features **1-Click Demo Buttons** so you can instantly experience all three dashboards without typing:

| Role | Email | Password | Access Portal |
|---|---|---|---|
| **Patient** | `patient@hospital.com` | `password123` | `/patient/index.html` |
| **Doctor** | `rahul.sharma@hospital.com` | `password123` | `/doctor/index.html` |
| **Admin** | `admin@hospital.com` | `password123` | `/admin/index.html` |

---

## 🗄️ Database Architecture (`/sql`)

All SQL scripts are stored in the `/sql/` directory:

1. **`sql/schema.sql`**:
   - `profiles`: Common identity table linked to `auth.users`.
   - `departments`: Medical departments with code prefixes and room assignments.
   - `doctors`: Doctor details, qualifications, experience, rating, fees.
   - `doctor_availability`: Weekly schedules (Mon–Sun) with start/end times.
   - `appointments`: Core booking table with `idx_prevent_double_booking` unique index.
   - `notifications`: User notification queue.
   - `reviews`: 1–5 star ratings and comments.
   - Triggers: Auto-update average doctor rating and auto-create profile on signup.

2. **`sql/rls_policies.sql`**:
   - Complete Row Level Security (RLS) policies for Patient, Doctor, and Admin roles.

3. **`sql/seed.sql`**:
   - Rich seed data with 8 departments, verified doctors, weekly schedules, test appointments, and patient reviews.

### How to Run in Supabase SQL Editor:
1. Open your Supabase Project dashboard (`https://supabase.com/dashboard`).
2. Go to the **SQL Editor**.
3. Copy and run `sql/schema.sql`.
4. Copy and run `sql/rls_policies.sql`.
5. Copy and run `sql/seed.sql`.
6. Go to `login.html`, click **Supabase Config**, and paste your **Project URL** and **Anon Key**.

---

## 📂 Project Structure

```
Hospital Management System/
├── index.html                   # Public Landing Page with Hero & Quick Search
├── doctors.html                 # Specialist Discovery & Department Filters
├── doctor-profile.html          # Doctor Bio, OPD Hours & Reviews
├── departments.html             # Hospital Medical Departments Directory
├── about.html                   # Hospital Mission, Vision & Facilities
├── contact.html                 # 24/7 Hotline, Emergency & Inquiry Form
├── login.html                   # Multi-Role Login & 1-Click Demo Switcher
├── register.html                # Patient & Doctor Registration
│
├── patient/                     # Patient Portal
│   ├── index.html               # Patient Dashboard & Upcoming Token Card
│   ├── book-appointment.html   # Multi-Step Booking Wizard (Double-Booking Guard)
│   ├── appointments.html       # Consultation History, Reschedule & Review Modal
│   ├── queue-status.html       # Live Digital Token Queue Tracker
│   ├── notifications.html       # Real-Time Notifications Center
│   └── profile.html            # Medical Profile & Contact Settings
│
├── doctor/                      # Doctor Portal
│   ├── index.html               # Doctor Dashboard & Live Queue Caller
│   ├── appointments.html       # Request Approvals, Start & Complete Consultation
│   ├── schedule.html           # Weekly OPD Availability Manager
│   ├── patients.html           # Patient Consultation History Logs
│   ├── reviews.html            # Patient 5-Star Ratings & Feedback
│   └── profile.html            # Physician Bio & Clinic Room Manager
│
├── admin/                       # Admin Portal
│   ├── index.html               # Admin Dashboard & Chart.js Analytics (No Billing)
│   ├── doctors.html            # Doctor CRUD & Verification Toggle
│   ├── patients.html           # Patient Management & Status Toggles
│   ├── appointments.html       # Master Appointment Log & Filters
│   ├── departments.html        # Medical Department Management
│   └── reports.html            # Printable Hospital Utilization Reports
│
├── css/
│   └── style.css               # Medical Design System & Custom Animations
│
├── js/
│   ├── supabase.js             # Supabase Client + Offline Demo Engine
│   ├── auth.js                 # Authentication & Role Gate Guards
│   ├── appointments.js         # Slot Calculation & Queue Algorithms
│   ├── doctors.js              # Doctor Directory & Filtering
│   ├── patient.js              # Patient Controller
│   ├── doctor.js               # Doctor Controller
│   ├── admin.js                # Admin Controller & Chart.js Visuals
│   └── pdf-receipt.js          # jsPDF Digital Token Receipt Generator
│
├── sql/
│   ├── schema.sql              # Database Tables & Triggers
│   ├── rls_policies.sql        # Row Level Security Rules
│   └── seed.sql                # Initial Seed Records
│
├── vercel.json                  # Vercel Deployment Routing Config
└── README.md                   # Full Project Documentation
```

---

## 🚀 Deployment Instructions

### Deploy to Vercel (Recommended)
1. Push this repository to GitHub.
2. Go to [Vercel Dashboard](https://vercel.com).
3. Import your GitHub repository.
4. Click **Deploy** (No build step required as this is modern static web architecture).

### Deploy to Netlify
1. Drag and drop the root folder into the Netlify Drop dashboard.
2. Your site is live with clean routing enabled.

---

## 🎓 BCA Capstone Project Compliance Checklist

- [x] Three Role-Based Portals: Patient, Doctor, and Admin
- [x] Real-time Doctor Availability & 30-Minute Slot Generation
- [x] Prevention of Double Booking at both Application & Database level
- [x] Digital Queue Token Generation (`CARD-001`, `NEUR-014`, etc.)
- [x] Live Queue Tracking with Estimated Wait Calculations
- [x] Notification System for Appointment Status Changes
- [x] 5-Star Doctor Review & Rating System
- [x] Chart.js Analytics (No Revenue / Billing)
- [x] jsPDF Appointment Slips & Receipts
- [x] Supabase SQL Schema, Triggers, and RLS Security Policies
- [x] 100% Responsive Design on Desktop, Tablet, and Mobile
