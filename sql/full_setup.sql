-- ==============================================================================
-- CAREPULSE HOSPITAL APPOINTMENT BOOKING SYSTEM
-- COMPLETE SUPABASE POSTGRESQL DATABASE SETUP & ALL SEED DATA (ALL-IN-ONE)
-- ==============================================================================

-- 1. Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- 2. DROP EXISTING TABLES IF NEEDED (Clean Setup)
-- ==============================================================================
DROP TABLE IF EXISTS public.waiting_list CASCADE;
DROP TABLE IF EXISTS public.appointment_reminders CASCADE;
DROP TABLE IF EXISTS public.audit_logs CASCADE;
DROP TABLE IF EXISTS public.prescriptions CASCADE;
DROP TABLE IF EXISTS public.consultations CASCADE;
DROP TABLE IF EXISTS public.family_members CASCADE;
DROP TABLE IF EXISTS public.doctor_leaves CASCADE;
DROP TABLE IF EXISTS public.opd_rooms CASCADE;
DROP TABLE IF EXISTS public.reviews CASCADE;
DROP TABLE IF EXISTS public.notifications CASCADE;
DROP TABLE IF EXISTS public.appointments CASCADE;
DROP TABLE IF EXISTS public.doctor_availability CASCADE;
DROP TABLE IF EXISTS public.doctors CASCADE;
DROP TABLE IF EXISTS public.departments CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

-- ==============================================================================
-- 3. CREATE CORE TABLES
-- ==============================================================================

-- A. PROFILES TABLE
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    phone TEXT,
    role TEXT NOT NULL CHECK (role IN ('patient', 'doctor', 'admin')) DEFAULT 'patient',
    gender TEXT CHECK (gender IN ('Male', 'Female', 'Other')),
    date_of_birth DATE,
    blood_group TEXT,
    address TEXT,
    emergency_contact_name TEXT,
    emergency_contact_phone TEXT,
    allergies TEXT,
    chronic_conditions TEXT,
    profile_image TEXT DEFAULT 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- B. DEPARTMENTS TABLE
CREATE TABLE public.departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    code TEXT NOT NULL UNIQUE,
    description TEXT,
    icon TEXT DEFAULT 'activity',
    room_number TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- C. OPD ROOMS TABLE
CREATE TABLE public.opd_rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_number TEXT NOT NULL UNIQUE,
    department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
    status TEXT NOT NULL CHECK (status IN ('active', 'maintenance', 'occupied', 'inactive')) DEFAULT 'active',
    floor TEXT DEFAULT '1st Floor',
    wing TEXT DEFAULT 'Main Wing',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- D. DOCTORS TABLE
CREATE TABLE public.doctors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
    department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
    specialization TEXT NOT NULL,
    qualification TEXT NOT NULL,
    experience_years INTEGER NOT NULL DEFAULT 0,
    hospital_name TEXT DEFAULT 'CarePulse Central Hospital',
    room_number TEXT DEFAULT 'Room 101',
    consultation_fee NUMERIC(10, 2) DEFAULT 50.00,
    about TEXT,
    rating NUMERIC(3, 2) DEFAULT 5.00,
    total_reviews INTEGER DEFAULT 0,
    is_verified BOOLEAN DEFAULT TRUE,
    is_active BOOLEAN DEFAULT TRUE,
    is_available_today BOOLEAN DEFAULT TRUE,
    delay_minutes INTEGER DEFAULT 0,
    delay_reason TEXT,
    delay_reported_at TIMESTAMPTZ,
    live_opd_status TEXT DEFAULT 'available',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- E. DOCTOR AVAILABILITY SCHEDULES
CREATE TABLE public.doctor_availability (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    doctor_id UUID NOT NULL REFERENCES public.doctors(id) ON DELETE CASCADE,
    day_of_week TEXT NOT NULL CHECK (day_of_week IN ('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday')),
    start_time TIME NOT NULL DEFAULT '09:00',
    end_time TIME NOT NULL DEFAULT '17:00',
    slot_duration_minutes INTEGER NOT NULL DEFAULT 30,
    break_start TIME DEFAULT '13:00',
    break_end TIME DEFAULT '14:00',
    is_available BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_doctor_day UNIQUE (doctor_id, day_of_week)
);

-- F. DOCTOR LEAVES / UNAVAILABILITY
CREATE TABLE public.doctor_leaves (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    doctor_id UUID NOT NULL REFERENCES public.doctors(id) ON DELETE CASCADE,
    leave_date DATE NOT NULL,
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_doctor_leave UNIQUE (doctor_id, leave_date)
);

-- G. FAMILY MEMBERS TABLE
CREATE TABLE public.family_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    relationship TEXT NOT NULL CHECK (relationship IN ('Mother', 'Father', 'Spouse', 'Child', 'Sibling', 'Other')),
    gender TEXT CHECK (gender IN ('Male', 'Female', 'Other')),
    date_of_birth DATE,
    phone TEXT,
    blood_group TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- H. APPOINTMENTS & QUEUE MANAGEMENT
CREATE TABLE public.appointments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    appointment_number TEXT UNIQUE NOT NULL,
    token_number TEXT NOT NULL,
    patient_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    family_member_id UUID REFERENCES public.family_members(id) ON DELETE SET NULL,
    doctor_id UUID NOT NULL REFERENCES public.doctors(id) ON DELETE CASCADE,
    department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
    appointment_date DATE NOT NULL,
    time_slot TIME NOT NULL,
    appointment_time TIME,
    status TEXT NOT NULL CHECK (status IN ('pending', 'confirmed', 'checked_in', 'checked-in', 'called', 'in_consultation', 'in-progress', 'in_progress', 'completed', 'cancelled', 'rejected', 'no_show', 'no-show')) DEFAULT 'confirmed',
    reason TEXT,
    symptoms TEXT,
    priority TEXT NOT NULL CHECK (priority IN ('normal', 'urgent', 'emergency')) DEFAULT 'normal',
    doctor_notes TEXT,
    queue_status TEXT NOT NULL CHECK (queue_status IN ('waiting', 'called', 'in-room', 'completed', 'skipped')) DEFAULT 'waiting',
    is_called BOOLEAN DEFAULT FALSE,
    checked_in_at TIMESTAMPTZ,
    called_at TIMESTAMPTZ,
    consultation_started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    cancellation_reason TEXT,
    verification_hash TEXT,
    reschedule_count INTEGER DEFAULT 0,
    rescheduled_from_date DATE,
    rescheduled_from_slot TIME,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Strict Double-Booking Prevention Index
CREATE UNIQUE INDEX idx_prevent_double_booking 
ON public.appointments (doctor_id, appointment_date, time_slot) 
WHERE status NOT IN ('cancelled', 'rejected');

-- I. CONSULTATIONS
CREATE TABLE public.consultations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    appointment_id UUID UNIQUE NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
    doctor_id UUID NOT NULL REFERENCES public.doctors(id) ON DELETE CASCADE,
    patient_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    diagnosis TEXT,
    notes TEXT,
    follow_up_date DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- J. PRESCRIPTIONS
CREATE TABLE public.prescriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    consultation_id UUID NOT NULL REFERENCES public.consultations(id) ON DELETE CASCADE,
    medicine TEXT NOT NULL,
    dosage TEXT NOT NULL,
    frequency TEXT NOT NULL,
    duration TEXT NOT NULL,
    instructions TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- K. NOTIFICATIONS
CREATE TABLE public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('appointment', 'reminder', 'system', 'queue', 'cancellation', 'status_change')) DEFAULT 'appointment',
    link TEXT,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- L. REVIEWS & RATINGS
CREATE TABLE public.reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    doctor_id UUID NOT NULL REFERENCES public.doctors(id) ON DELETE CASCADE,
    patient_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    appointment_id UUID UNIQUE REFERENCES public.appointments(id) ON DELETE SET NULL,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    is_verified BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_patient_appointment_review UNIQUE (patient_id, appointment_id)
);

-- M. AUDIT LOGS
CREATE TABLE public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT,
    details JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- N. APPOINTMENT REMINDERS (Feature 4)
CREATE TABLE public.appointment_reminders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    appointment_id UUID NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
    patient_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    reminder_type TEXT NOT NULL CHECK (reminder_type IN ('24h', '1h')),
    scheduled_for TIMESTAMPTZ NOT NULL,
    sent_at TIMESTAMPTZ,
    status TEXT NOT NULL CHECK (status IN ('pending', 'sent', 'skipped_cancelled')) DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_appt_reminder UNIQUE (appointment_id, reminder_type)
);

-- O. WAITING LIST (Feature 6)
CREATE TABLE public.waiting_list (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    doctor_id UUID NOT NULL REFERENCES public.doctors(id) ON DELETE CASCADE,
    preferred_date DATE NOT NULL,
    preferred_time_range TEXT DEFAULT 'any',
    reason TEXT,
    symptoms TEXT,
    status TEXT NOT NULL CHECK (status IN ('waiting', 'offered', 'booked', 'expired', 'declined', 'cancelled')) DEFAULT 'waiting',
    priority INTEGER DEFAULT 1,
    offered_appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
    offered_time_slot TIME,
    offer_expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 4. DATABASE TRIGGERS
-- ==============================================================================

-- A. Auto Profile Creation on Supabase Auth Sign Up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO public.profiles (
    id,
    full_name,
    email,
    phone,
    role,
    gender,
    address
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'phone', ''),
    COALESCE(NEW.raw_user_meta_data->>'role', 'patient'),
    COALESCE(NEW.raw_user_meta_data->>'gender', 'Other'),
    COALESCE(NEW.raw_user_meta_data->>'address', '')
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    email = EXCLUDED.email;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- B. Auto Update Doctor Rating on New Review
CREATE OR REPLACE FUNCTION public.update_doctor_rating()
RETURNS TRIGGER 
LANGUAGE plpgsql AS $$
BEGIN
  UPDATE public.doctors
  SET 
    rating = (
      SELECT ROUND(AVG(rating)::numeric, 2)
      FROM public.reviews
      WHERE doctor_id = NEW.doctor_id
    ),
    total_reviews = (
      SELECT COUNT(*)
      FROM public.reviews
      WHERE doctor_id = NEW.doctor_id
    )
  WHERE id = NEW.doctor_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_doctor_rating ON public.reviews;
CREATE TRIGGER trg_update_doctor_rating
  AFTER INSERT OR UPDATE ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.update_doctor_rating();

-- ==============================================================================
-- 5. ROW LEVEL SECURITY (RLS) & POLICIES
-- ==============================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opd_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.doctors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.doctor_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.doctor_leaves ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consultations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prescriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointment_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.waiting_list ENABLE ROW LEVEL SECURITY;

-- Permissive Development Policies
CREATE POLICY "Profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Profiles can be inserted by anyone" ON public.profiles FOR INSERT WITH CHECK (true);
CREATE POLICY "Profiles can be updated by owner or admin" ON public.profiles FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "Departments are readable by everyone" ON public.departments FOR SELECT USING (true);
CREATE POLICY "Departments can be managed by anyone" ON public.departments FOR ALL USING (true);

CREATE POLICY "OPD rooms are readable by everyone" ON public.opd_rooms FOR SELECT USING (true);
CREATE POLICY "OPD rooms can be managed by anyone" ON public.opd_rooms FOR ALL USING (true);

CREATE POLICY "Doctors are viewable by everyone" ON public.doctors FOR SELECT USING (true);
CREATE POLICY "Doctors can be inserted by anyone" ON public.doctors FOR INSERT WITH CHECK (true);
CREATE POLICY "Doctors can be updated by anyone" ON public.doctors FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Doctors can be deleted by admin" ON public.doctors FOR DELETE USING (true);

CREATE POLICY "Doctor availability is readable by everyone" ON public.doctor_availability FOR SELECT USING (true);
CREATE POLICY "Doctor availability can be managed" ON public.doctor_availability FOR ALL USING (true);

CREATE POLICY "Doctor leaves are readable by everyone" ON public.doctor_leaves FOR SELECT USING (true);
CREATE POLICY "Doctor leaves can be managed" ON public.doctor_leaves FOR ALL USING (true);

CREATE POLICY "Family members are readable by everyone" ON public.family_members FOR SELECT USING (true);
CREATE POLICY "Family members can be managed" ON public.family_members FOR ALL USING (true);

CREATE POLICY "Appointments are viewable by everyone" ON public.appointments FOR SELECT USING (true);
CREATE POLICY "Appointments can be inserted by anyone" ON public.appointments FOR INSERT WITH CHECK (true);
CREATE POLICY "Appointments can be updated by anyone" ON public.appointments FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Appointments can be deleted by admin" ON public.appointments FOR DELETE USING (true);

CREATE POLICY "Consultations are viewable by everyone" ON public.consultations FOR SELECT USING (true);
CREATE POLICY "Consultations can be managed" ON public.consultations FOR ALL USING (true);

CREATE POLICY "Prescriptions are viewable by everyone" ON public.prescriptions FOR SELECT USING (true);
CREATE POLICY "Prescriptions can be managed" ON public.prescriptions FOR ALL USING (true);

CREATE POLICY "Notifications are readable by everyone" ON public.notifications FOR SELECT USING (true);
CREATE POLICY "Notifications can be inserted by anyone" ON public.notifications FOR INSERT WITH CHECK (true);
CREATE POLICY "Notifications can be updated by anyone" ON public.notifications FOR UPDATE USING (true);

CREATE POLICY "Reviews are readable by everyone" ON public.reviews FOR SELECT USING (true);
CREATE POLICY "Reviews can be inserted" ON public.reviews FOR INSERT WITH CHECK (true);

CREATE POLICY "Audit logs are readable by everyone" ON public.audit_logs FOR SELECT USING (true);
CREATE POLICY "Audit logs can be inserted" ON public.audit_logs FOR INSERT WITH CHECK (true);

CREATE POLICY "Appointment reminders readable by everyone" ON public.appointment_reminders FOR SELECT USING (true);
CREATE POLICY "Appointment reminders can be managed" ON public.appointment_reminders FOR ALL USING (true);

CREATE POLICY "Waiting list readable by everyone" ON public.waiting_list FOR SELECT USING (true);
CREATE POLICY "Waiting list can be managed" ON public.waiting_list FOR ALL USING (true);

-- ==============================================================================
-- 5.1 STORED PROCEDURES & ATOMIC FUNCTIONS (Features 4 & 6)
-- ==============================================================================

-- 1. ATOMIC WAITING LIST REALLOCATION FUNCTION (Feature 6)
CREATE OR REPLACE FUNCTION public.reallocate_cancelled_slot(p_cancelled_appointment_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_appt RECORD;
    v_wait RECORD;
    v_doc RECORD;
    v_expires_at TIMESTAMPTZ;
BEGIN
    SELECT * INTO v_appt FROM public.appointments WHERE id = p_cancelled_appointment_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'Appointment not found');
    END IF;

    SELECT d.*, p.full_name AS doctor_name INTO v_doc
    FROM public.doctors d
    JOIN public.profiles p ON d.profile_id = p.id
    WHERE d.id = v_appt.doctor_id;

    SELECT * INTO v_wait
    FROM public.waiting_list
    WHERE doctor_id = v_appt.doctor_id
      AND preferred_date = v_appt.appointment_date
      AND status = 'waiting'
    ORDER BY priority_score DESC, created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', true, 'reallocated', false, 'message', 'No waiting patients found');
    END IF;

    v_expires_at := NOW() + INTERVAL '30 minutes';

    UPDATE public.waiting_list
    SET status = 'offered',
        offered_slot = v_appt.time_slot,
        offer_expires_at = v_expires_at,
        updated_at = NOW()
    WHERE id = v_wait.id;

    INSERT INTO public.notifications (
        user_id,
        title,
        message,
        type,
        link
    ) VALUES (
        v_wait.patient_id,
        'Priority Slot Released!',
        format('A released slot for Dr. %s on %s at %s is now available for you. Confirm within 30 minutes!', 
               v_doc.doctor_name, v_appt.appointment_date, to_char(v_appt.time_slot, 'HH12:MI AM')),
        'queue',
        'patient/appointments.html?offer=' || v_wait.id
    );

    RETURN jsonb_build_object(
        'success', true,
        'reallocated', true,
        'waiting_id', v_wait.id,
        'patient_id', v_wait.patient_id,
        'offered_slot', v_appt.time_slot,
        'expires_at', v_expires_at
    );
END;
$$;

-- 2. APPOINTMENT REMINDERS CHECK FUNCTION (Feature 4)
CREATE OR REPLACE FUNCTION public.check_and_send_appointment_reminders()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_count_24h INTEGER := 0;
    v_count_1h INTEGER := 0;
    r RECORD;
    v_appt_datetime TIMESTAMPTZ;
    v_hours_until NUMERIC;
BEGIN
    FOR r IN 
        SELECT a.*, p.full_name AS doctor_name, pr.full_name AS patient_name
        FROM public.appointments a
        JOIN public.doctors d ON a.doctor_id = d.id
        JOIN public.profiles p ON d.profile_id = p.id
        JOIN public.profiles pr ON a.patient_id = pr.id
        WHERE a.status IN ('confirmed', 'pending')
          AND a.appointment_date >= CURRENT_DATE
    LOOP
        v_appt_datetime := (r.appointment_date::text || ' ' || COALESCE(r.time_slot, r.appointment_time, '09:00:00')::text)::timestamptz;
        v_hours_until := EXTRACT(EPOCH FROM (v_appt_datetime - NOW())) / 3600.0;

        -- 24 Hour Reminder Check
        IF v_hours_until <= 24.0 AND v_hours_until > 1.0 THEN
            IF NOT EXISTS (
                SELECT 1 FROM public.appointment_reminders 
                WHERE appointment_id = r.id AND reminder_type = '24h'
            ) THEN
                INSERT INTO public.appointment_reminders (appointment_id, patient_id, reminder_type, scheduled_for, sent_at, status)
                VALUES (r.id, r.patient_id, '24h', v_appt_datetime, NOW(), 'sent');

                INSERT INTO public.notifications (user_id, title, message, type, link)
                VALUES (
                    r.patient_id,
                    'Appointment Reminder: Tomorrow',
                    format('Reminder: You have an appointment tomorrow with Dr. %s at %s. Token: %s.',
                           r.doctor_name, to_char(r.time_slot, 'HH12:MI AM'), r.token_number),
                    'reminder',
                    'patient/appointment-details.html?id=' || r.id
                );
                v_count_24h := v_count_24h + 1;
            END IF;
        END IF;

        -- 1 Hour Reminder Check
        IF v_hours_until <= 1.0 AND v_hours_until > 0.0 THEN
            IF NOT EXISTS (
                SELECT 1 FROM public.appointment_reminders 
                WHERE appointment_id = r.id AND reminder_type = '1h'
            ) THEN
                INSERT INTO public.appointment_reminders (appointment_id, patient_id, reminder_type, scheduled_for, sent_at, status)
                VALUES (r.id, r.patient_id, '1h', v_appt_datetime, NOW(), 'sent');

                INSERT INTO public.notifications (user_id, title, message, type, link)
                VALUES (
                    r.patient_id,
                    'Appointment Reminder: Starting in 1 Hour',
                    format('Reminder: Your consultation with Dr. %s starts in 1 hour (%s). Token: %s. Track your live queue status.',
                           r.doctor_name, to_char(r.time_slot, 'HH12:MI AM'), r.token_number),
                    'reminder',
                    'patient/queue-status.html?id=' || r.id
                );
                v_count_1h := v_count_1h + 1;
            END IF;
        END IF;
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'reminders_24h_sent', v_count_24h,
        'reminders_1h_sent', v_count_1h
    );
END;
$$;

-- ==============================================================================
-- 6. COMPLETE SEED DATA (Departments, Rooms, Doctors, Schedules, Appointments)
-- ==============================================================================

-- 1. DEPARTMENTS
INSERT INTO public.departments (id, name, code, description, icon, room_number) VALUES
('d1111111-1111-1111-1111-111111111111', 'Cardiology', 'CARD', 'Comprehensive heart and cardiovascular care with modern diagnostic labs.', 'heart', 'Wing A - Room 101'),
('d2222222-2222-2222-2222-222222222222', 'Neurology', 'NEUR', 'Advanced diagnosis and treatment for brain, spine, and nerve disorders.', 'brain', 'Wing B - Room 204'),
('d3333333-3333-3333-3333-333333333333', 'Orthopedics', 'ORTH', 'Joint replacement, fracture care, and musculoskeletal rehabilitation.', 'bone', 'Wing C - Room 105'),
('d4444444-4444-4444-4444-444444444444', 'Dermatology', 'DERM', 'Clinical skin treatments, acne care, and cosmetic dermatology.', 'sparkles', 'Wing A - Room 302'),
('d5555555-5555-5555-5555-555555555555', 'Pediatrics', 'PED', 'Compassionate pediatric healthcare and developmental wellness for children.', 'baby', 'Wing D - Room 108'),
('d6666666-6666-6666-6666-666666666666', 'General Medicine', 'GEN', 'Primary healthcare, preventive wellness, and infectious disease management.', 'stethoscope', 'Wing B - Room 102'),
('d7777777-7777-7777-7777-777777777777', 'Dentistry', 'DENT', 'Complete oral health, root canals, orthodontics, and smile design.', 'smile', 'Wing C - Room 205'),
('d8888888-8888-8888-8888-888888888888', 'Ophthalmology', 'OPHT', 'Eye care, laser vision correction, cataract surgery, and retinal care.', 'eye', 'Wing A - Room 208')
ON CONFLICT (code) DO NOTHING;

-- 2. OPD ROOMS
INSERT INTO public.opd_rooms (room_number, department_id, status, floor, wing) VALUES
('Room 101', 'd1111111-1111-1111-1111-111111111111', 'active', '1st Floor', 'Wing A'),
('Room 102', 'd6666666-6666-6666-6666-666666666666', 'active', '1st Floor', 'Wing B'),
('Room 105', 'd3333333-3333-3333-3333-333333333333', 'active', '1st Floor', 'Wing C'),
('Room 108', 'd5555555-5555-5555-5555-555555555555', 'active', '1st Floor', 'Wing D'),
('Room 204', 'd2222222-2222-2222-2222-222222222222', 'active', '2nd Floor', 'Wing B'),
('Room 205', 'd7777777-7777-7777-7777-777777777777', 'active', '2nd Floor', 'Wing C'),
('Room 208', 'd8888888-8888-8888-8888-888888888888', 'active', '2nd Floor', 'Wing A'),
('Room 302', 'd4444444-4444-4444-4444-444444444444', 'active', '3rd Floor', 'Wing A')
ON CONFLICT (room_number) DO NOTHING;

-- 3. PROFILES
-- Admin
INSERT INTO public.profiles (id, full_name, email, phone, role, gender, address) VALUES
('a0000000-0000-0000-0000-000000000001', 'Admin Director', 'admin@hospital.com', '+91 9876500001', 'admin', 'Other', 'CarePulse Central Hospital Management Office')
ON CONFLICT (email) DO NOTHING;

-- Doctors
INSERT INTO public.profiles (id, full_name, email, phone, role, gender, address, profile_image) VALUES
('11111111-1111-1111-1111-111111111111', 'Dr. Rahul Sharma', 'rahul.sharma@hospital.com', '+91 9876500002', 'doctor', 'Male', 'Metro Health Towers, Suite 4B', 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=400&auto=format&fit=crop&q=80'),
('22222222-2222-2222-2222-222222222222', 'Dr. Priya Patel', 'priya.patel@hospital.com', '+91 9876500004', 'doctor', 'Female', 'Green Valley Medical Plaza', 'https://images.unsplash.com/photo-1594824813629-456cb04c3547?w=400&auto=format&fit=crop&q=80'),
('33333333-3333-3333-3333-333333333333', 'Dr. Vikram Sethi', 'vikram.sethi@hospital.com', '+91 9876500005', 'doctor', 'Male', 'Sunset Boulevard Medical Center', 'https://images.unsplash.com/photo-1537368910025-700350fe46c7?w=400&auto=format&fit=crop&q=80'),
('44444444-4444-4444-4444-444444444444', 'Dr. Ananya Roy', 'ananya.roy@hospital.com', '+91 9876500006', 'doctor', 'Female', 'CityCare Specialty Wing', 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=400&auto=format&fit=crop&q=80'),
('55555555-5555-5555-5555-555555555555', 'Dr. Aris Thorne', 'aris.thorne@hospital.com', '+91 9876500007', 'doctor', 'Male', 'Highland Park Health Complex', 'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=400&auto=format&fit=crop&q=80')
ON CONFLICT (email) DO NOTHING;

-- Patients
INSERT INTO public.profiles (id, full_name, email, phone, role, gender, date_of_birth, blood_group, address) VALUES
('99999999-9999-9999-9999-999999999991', 'John Doe', 'patient@hospital.com', '+91 9876500003', 'patient', 'Male', '1992-05-14', 'O+', '42 Elm Street, Downtown'),
('99999999-9999-9999-9999-999999999992', 'Sarah Jenkins', 'sarah.j@example.com', '+91 9876500008', 'patient', 'Female', '1988-11-20', 'A+', '88 Pine Ridge Road'),
('99999999-9999-9999-9999-999999999993', 'Michael Chang', 'mchang@example.com', '+91 9876500009', 'patient', 'Male', '1995-03-08', 'B+', '120 West Lakeview Drive')
ON CONFLICT (email) DO NOTHING;

-- 4. DOCTORS
INSERT INTO public.doctors (id, profile_id, department_id, specialization, qualification, experience_years, hospital_name, room_number, consultation_fee, about, rating, total_reviews, is_verified, is_available_today) VALUES
('d0c11111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'd1111111-1111-1111-1111-111111111111', 'Senior Interventional Cardiologist', 'MBBS, MD (Cardiology), FACC (USA)', 14, 'CarePulse Central Hospital', 'Wing A - Room 101', 65.00, 'Dr. Rahul Sharma has over 14 years of experience diagnosing complex cardiac conditions, angioplasty, hypertension management, and preventive heart care.', 4.9, 128, TRUE, TRUE),
('d0c22222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222', 'd2222222-2222-2222-2222-222222222222', 'Consultant Neurologist & Stroke Specialist', 'MBBS, DM (Neurology), Fellowship in Neurophysiology', 11, 'CarePulse Central Hospital', 'Wing B - Room 204', 70.00, 'Dr. Priya Patel specializes in stroke rehabilitation, migraine disorders, epilepsy management, and neurological evaluations with advanced EEG/EMG testing.', 4.8, 94, TRUE, TRUE),
('d0c33333-3333-3333-3333-333333333333', '33333333-3333-3333-3333-333333333333', 'd3333333-3333-3333-3333-333333333333', 'Orthopedic Surgeon & Joint Replacement Specialist', 'MBBS, MS (Ortho), MCh (Orthopedics, UK)', 16, 'CarePulse Central Hospital', 'Wing C - Room 105', 60.00, 'Dr. Vikram Sethi is a distinguished orthopedic surgeon specializing in robotic joint replacements, sports injuries, arthroscopic surgeries, and spine care.', 4.9, 142, TRUE, TRUE),
('d0c44444-4444-4444-4444-444444444444', '44444444-4444-4444-4444-444444444444', 'd4444444-4444-4444-4444-444444444444', 'Consultant Dermatologist & Aesthetician', 'MBBS, MD (Dermatology, Venereology & Leprosy)', 9, 'CarePulse Central Hospital', 'Wing A - Room 302', 50.00, 'Dr. Ananya Roy provides evidence-based treatments for clinical skin conditions, eczema, psoriasis, hair loss therapies, and laser dermatological procedures.', 4.7, 86, TRUE, TRUE),
('d0c55555-5555-5555-5555-555555555555', '55555555-5555-5555-5555-555555555555', 'd5555555-5555-5555-5555-555555555555', 'Lead Pediatrician & Neonatologist', 'MBBS, MD (Pediatrics), DNB (Pediatrics)', 12, 'CarePulse Central Hospital', 'Wing D - Room 108', 45.00, 'Dr. Aris Thorne focuses on child wellness, infant immunization, growth monitoring, developmental milestones, and pediatric respiratory conditions.', 4.9, 110, TRUE, TRUE)
ON CONFLICT (id) DO NOTHING;

-- 5. DOCTOR AVAILABILITY SCHEDULES
INSERT INTO public.doctor_availability (doctor_id, day_of_week, start_time, end_time, slot_duration_minutes, is_available) VALUES
-- Dr. Rahul Sharma (Mon - Sat)
('d0c11111-1111-1111-1111-111111111111', 'Monday', '09:00:00', '14:00:00', 30, TRUE),
('d0c11111-1111-1111-1111-111111111111', 'Tuesday', '09:00:00', '14:00:00', 30, TRUE),
('d0c11111-1111-1111-1111-111111111111', 'Wednesday', '09:00:00', '14:00:00', 30, TRUE),
('d0c11111-1111-1111-1111-111111111111', 'Thursday', '09:00:00', '14:00:00', 30, TRUE),
('d0c11111-1111-1111-1111-111111111111', 'Friday', '09:00:00', '14:00:00', 30, TRUE),
('d0c11111-1111-1111-1111-111111111111', 'Saturday', '10:00:00', '13:00:00', 30, TRUE),

-- Dr. Priya Patel (Mon, Wed, Fri, Sat)
('d0c22222-2222-2222-2222-222222222222', 'Monday', '10:00:00', '16:00:00', 30, TRUE),
('d0c22222-2222-2222-2222-222222222222', 'Wednesday', '10:00:00', '16:00:00', 30, TRUE),
('d0c22222-2222-2222-2222-222222222222', 'Friday', '10:00:00', '16:00:00', 30, TRUE),
('d0c22222-2222-2222-2222-222222222222', 'Saturday', '10:00:00', '14:00:00', 30, TRUE),

-- Dr. Vikram Sethi (Tue, Thu, Sat)
('d0c33333-3333-3333-3333-333333333333', 'Tuesday', '08:30:00', '13:30:00', 30, TRUE),
('d0c33333-3333-3333-3333-333333333333', 'Thursday', '08:30:00', '13:30:00', 30, TRUE),
('d0c33333-3333-3333-3333-333333333333', 'Saturday', '09:00:00', '15:00:00', 30, TRUE),

-- Dr. Ananya Roy (Mon - Sat)
('d0c44444-4444-4444-4444-444444444444', 'Monday', '11:00:00', '17:00:00', 30, TRUE),
('d0c44444-4444-4444-4444-444444444444', 'Tuesday', '11:00:00', '17:00:00', 30, TRUE),
('d0c44444-4444-4444-4444-444444444444', 'Thursday', '11:00:00', '17:00:00', 30, TRUE),
('d0c44444-4444-4444-4444-444444444444', 'Friday', '11:00:00', '17:00:00', 30, TRUE),

-- Dr. Aris Thorne (Mon - Fri)
('d0c55555-5555-5555-5555-555555555555', 'Monday', '09:00:00', '15:00:00', 30, TRUE),
('d0c55555-5555-5555-5555-555555555555', 'Wednesday', '09:00:00', '15:00:00', 30, TRUE),
('d0c55555-5555-5555-5555-555555555555', 'Friday', '09:00:00', '15:00:00', 30, TRUE)
ON CONFLICT DO NOTHING;

-- 6. INITIAL APPOINTMENTS
INSERT INTO public.appointments (id, appointment_number, patient_id, doctor_id, appointment_date, time_slot, appointment_time, token_number, reason, status, queue_status) VALUES
('a0711111-1111-1111-1111-111111111111', 'APT-100001', '99999999-9999-9999-9999-999999999991', 'd0c11111-1111-1111-1111-111111111111', CURRENT_DATE, '09:30:00', '09:30:00', 'CARD-001', 'Routine blood pressure review and mild chest tightness', 'confirmed', 'waiting'),
('a0722222-2222-2222-2222-222222222222', 'APT-100002', '99999999-9999-9999-9999-999999999992', 'd0c11111-1111-1111-1111-111111111111', CURRENT_DATE, '10:00:00', '10:00:00', 'CARD-002', 'Follow up consultation post cholesterol treatment', 'pending', 'waiting'),
('a0733333-3333-3333-3333-333333333333', 'APT-100003', '99999999-9999-9999-9999-999999999993', 'd0c11111-1111-1111-1111-111111111111', CURRENT_DATE, '10:30:00', '10:30:00', 'CARD-003', 'Palpitations after intense exercise', 'confirmed', 'waiting'),
('a0744444-4444-4444-4444-444444444444', 'APT-100004', '99999999-9999-9999-9999-999999999991', 'd0c22222-2222-2222-2222-222222222222', CURRENT_DATE - INTERVAL '7 days', '11:00:00', '11:00:00', 'NEUR-014', 'Frequent tension headaches and sleep disturbance', 'completed', 'completed'),
('a0755555-5555-5555-5555-555555555555', 'APT-100005', '99999999-9999-9999-9999-999999999991', 'd0c33333-3333-3333-3333-333333333333', CURRENT_DATE + INTERVAL '2 days', '09:00:00', '09:00:00', 'ORTH-005', 'Knee stiffness during morning jog', 'confirmed', 'waiting')
ON CONFLICT (id) DO NOTHING;

-- 7. SAMPLE REVIEWS
INSERT INTO public.reviews (id, patient_id, doctor_id, appointment_id, rating, comment) VALUES
('e0e11111-1111-1111-1111-111111111111', '99999999-9999-9999-9999-999999999991', 'd0c22222-2222-2222-2222-222222222222', 'a0744444-4444-4444-4444-444444444444', 5, 'Dr. Priya is exceptionally thorough and empathetic. She explained the cause of my tension headaches clearly and the recovery plan is working great!')
ON CONFLICT (id) DO NOTHING;

-- 8. NOTIFICATIONS
INSERT INTO public.notifications (user_id, title, message, type, link) VALUES
('99999999-9999-9999-9999-999999999991', 'Appointment Confirmed', 'Your appointment with Dr. Rahul Sharma has been confirmed for today at 09:30 AM. Token: CARD-001.', 'appointment', 'patient/queue-status.html'),
('11111111-1111-1111-1111-111111111111', 'New Appointment Request', 'Sarah Jenkins booked an appointment for today at 10:00 AM (Reason: Follow up cholesterol).', 'appointment', 'doctor/appointments.html')
ON CONFLICT DO NOTHING;

-- Force PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
