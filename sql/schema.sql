-- ==============================================================================
-- HOSPITAL APPOINTMENT BOOKING SYSTEM - DATABASE SCHEMA
-- PostgreSQL / Supabase Schema
-- ==============================================================================

-- 1. Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Drop existing tables if needed (in reverse dependency order)
DROP TABLE IF EXISTS reviews CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS appointments CASCADE;
DROP TABLE IF EXISTS doctor_availability CASCADE;
DROP TABLE IF EXISTS doctors CASCADE;
DROP TABLE IF EXISTS departments CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;

-- 3. PROFILES TABLE
-- Stores common user profile details for Patients, Doctors, and Admins
CREATE TABLE profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name VARCHAR(150) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(25),
    role VARCHAR(20) NOT NULL CHECK (role IN ('patient', 'doctor', 'admin')),
    gender VARCHAR(15) CHECK (gender IN ('Male', 'Female', 'Other', 'Prefer not to say')),
    date_of_birth DATE,
    address TEXT,
    profile_image TEXT,
    blood_group VARCHAR(10),
    emergency_contact_name VARCHAR(150),
    emergency_contact_phone VARCHAR(25),
    allergies TEXT,
    chronic_conditions TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. DEPARTMENTS TABLE
-- Stores medical departments (Cardiology, Neurology, Orthopedics, etc.)
CREATE TABLE departments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) UNIQUE NOT NULL,
    code VARCHAR(10) UNIQUE NOT NULL,
    description TEXT NOT NULL,
    icon VARCHAR(50) DEFAULT 'activity',
    image TEXT,
    room_number VARCHAR(50),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. DOCTORS TABLE
-- Extends the profile for users with role = 'doctor'
CREATE TABLE doctors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
    specialization VARCHAR(150) NOT NULL,
    qualification VARCHAR(200) NOT NULL,
    experience_years INTEGER NOT NULL DEFAULT 0,
    hospital_name VARCHAR(200) DEFAULT 'CarePulse Central Hospital',
    room_number VARCHAR(50) DEFAULT 'Room 101',
    consultation_fee NUMERIC(10, 2) DEFAULT 50.00,
    about TEXT,
    rating NUMERIC(3, 2) DEFAULT 5.00,
    total_reviews INTEGER DEFAULT 0,
    is_verified BOOLEAN DEFAULT TRUE,
    is_available_today BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. DOCTOR AVAILABILITY TABLE
-- Stores recurring weekly availability schedules for each doctor
CREATE TABLE doctor_availability (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
    day_of_week VARCHAR(15) NOT NULL CHECK (day_of_week IN ('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday')),
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    slot_duration_minutes INTEGER DEFAULT 30,
    max_patients INTEGER DEFAULT 20,
    is_available BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT valid_time_range CHECK (start_time < end_time)
);

-- 7. APPOINTMENTS TABLE
-- Core booking entity with double-booking prevention constraint and queue token
CREATE TABLE appointments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
    appointment_date DATE NOT NULL,
    appointment_time TIME NOT NULL,
    token_number VARCHAR(30) NOT NULL,
    token_sequence INTEGER NOT NULL DEFAULT 1,
    reason TEXT NOT NULL,
    symptoms TEXT,
    status VARCHAR(25) NOT NULL DEFAULT 'pending' 
        CHECK (status IN ('pending', 'confirmed', 'rejected', 'cancelled', 'completed', 'in-progress')),
    doctor_notes TEXT,
    cancellation_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Double-Booking Prevention Unique Index:
-- Ensures a doctor cannot have more than one active appointment at the exact same date & time.
CREATE UNIQUE INDEX idx_prevent_double_booking 
ON appointments (doctor_id, appointment_date, appointment_time) 
WHERE status NOT IN ('cancelled', 'rejected');

-- 8. NOTIFICATIONS TABLE
-- Real-time notification logs for all user roles
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(50) DEFAULT 'appointment' 
        CHECK (type IN ('appointment', 'queue', 'status_change', 'reminder', 'system')),
    link TEXT,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. REVIEWS TABLE
-- 1-5 Star Ratings and feedback from patients for completed appointments
CREATE TABLE reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
    appointment_id UUID UNIQUE REFERENCES appointments(id) ON DELETE CASCADE,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- INDEXES FOR PERFORMANCE
-- ==============================================================================
CREATE INDEX idx_profiles_role ON profiles(role);
CREATE INDEX idx_profiles_email ON profiles(email);
CREATE INDEX idx_doctors_dept ON doctors(department_id);
CREATE INDEX idx_doctors_profile ON doctors(profile_id);
CREATE INDEX idx_doctor_avail_doc ON doctor_availability(doctor_id);
CREATE INDEX idx_appts_patient ON appointments(patient_id);
CREATE INDEX idx_appts_doctor ON appointments(doctor_id);
CREATE INDEX idx_appts_date ON appointments(appointment_date);
CREATE INDEX idx_appts_status ON appointments(status);
CREATE INDEX idx_notifications_user ON notifications(user_id, is_read);
CREATE INDEX idx_reviews_doctor ON reviews(doctor_id);

-- ==============================================================================
-- DATABASE TRIGGERS & FUNCTIONS
-- ==============================================================================

-- Trigger: Automatically update doctor average rating and review count
CREATE OR REPLACE FUNCTION update_doctor_rating()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE doctors
    SET 
        rating = COALESCE((SELECT ROUND(AVG(rating)::numeric, 2) FROM reviews WHERE doctor_id = NEW.doctor_id), 5.0),
        total_reviews = (SELECT COUNT(*) FROM reviews WHERE doctor_id = NEW.doctor_id)
    WHERE id = NEW.doctor_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_doctor_rating
AFTER INSERT OR UPDATE OR DELETE ON reviews
FOR EACH ROW
EXECUTE FUNCTION update_doctor_rating();

-- Trigger: Auto-create Profile on Supabase Auth Signup
CREATE OR REPLACE FUNCTION handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, email, role, phone)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'New User'),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'role', 'patient'),
    NEW.raw_user_meta_data->>'phone'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger definition for auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
