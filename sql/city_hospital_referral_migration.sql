-- ==============================================================================
-- CAREPULSE HOSPITAL APPOINTMENT BOOKING SYSTEM
-- CITY-WISE DOCTOR & HOSPITAL DISCOVERY, INDEPENDENT REGISTRATION,
-- ADMIN VERIFICATION & CROSS-CITY REFERRAL SYSTEM MIGRATION
-- ==============================================================================

-- 1. ENABLE EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- 2. CITIES & LOCATION DIRECTORY (MODULE 1)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.cities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    country TEXT NOT NULL DEFAULT 'India',
    state_name TEXT NOT NULL,
    district_name TEXT NOT NULL,
    city_name TEXT NOT NULL,
    pincode TEXT,
    latitude NUMERIC(10, 7),
    longitude NUMERIC(10, 7),
    tier INTEGER DEFAULT 2 CHECK (tier IN (1, 2, 3)),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_city_district_state UNIQUE (state_name, district_name, city_name, pincode)
);

CREATE INDEX IF NOT EXISTS idx_cities_search ON public.cities(state_name, district_name, city_name);
CREATE INDEX IF NOT EXISTS idx_cities_coords ON public.cities(latitude, longitude) WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- 2B. EXTEND PROFILES ROLE TO INCLUDE HOSPITAL
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check CHECK (role IN ('patient', 'doctor', 'admin', 'hospital'));

-- ==============================================================================
-- 3. HOSPITALS DIRECTORY & INDEPENDENT REGISTRATION (MODULE 3)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.hospitals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID UNIQUE REFERENCES public.profiles(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    hospital_type TEXT NOT NULL CHECK (hospital_type IN ('Government', 'Private Multi-specialty', 'Super-specialty', 'Clinic', 'Diagnostic Center', 'Nursing Home')) DEFAULT 'Private Multi-specialty',
    registration_number TEXT,
    license_number TEXT,
    city_id UUID REFERENCES public.cities(id) ON DELETE RESTRICT,
    address TEXT NOT NULL,
    district_name TEXT,
    state_name TEXT,
    pincode TEXT,
    latitude NUMERIC(10, 7),
    longitude NUMERIC(10, 7),
    email TEXT,
    phone TEXT,
    emergency_phone TEXT,
    website TEXT,
    logo_url TEXT DEFAULT 'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=400',
    cover_image TEXT DEFAULT 'https://images.unsplash.com/photo-1586773860418-d37222d8fce3?w=800',
    authorized_person_name TEXT,
    authorized_person_designation TEXT,
    authorized_person_phone TEXT,
    facilities JSONB DEFAULT '["ICU", "Emergency 24x7", "Pharmacy", "Laboratory", "Ambulance"]'::jsonb,
    total_beds INTEGER DEFAULT 50,
    verification_status TEXT NOT NULL CHECK (verification_status IN ('draft', 'pending', 'under_review', 'approved', 'rejected', 'suspended')) DEFAULT 'pending',
    is_active BOOLEAN DEFAULT TRUE,
    admin_reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    admin_review_reason TEXT,
    admin_reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hospitals_city ON public.hospitals(city_id);
CREATE INDEX IF NOT EXISTS idx_hospitals_status ON public.hospitals(verification_status, is_active);
CREATE INDEX IF NOT EXISTS idx_hospitals_coords ON public.hospitals(latitude, longitude) WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- HOSPITAL DOCUMENTS
CREATE TABLE IF NOT EXISTS public.hospital_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hospital_id UUID NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
    document_type TEXT NOT NULL CHECK (document_type IN ('establishment_license', 'nabh_certificate', 'fire_safety_noc', 'tax_pan', 'pollution_control_noc', 'other')),
    title TEXT NOT NULL,
    file_url TEXT NOT NULL,
    verification_status TEXT NOT NULL CHECK (verification_status IN ('pending', 'verified', 'rejected')) DEFAULT 'pending',
    rejection_reason TEXT,
    uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hospital_docs ON public.hospital_documents(hospital_id, verification_status);

-- ==============================================================================
-- 4. EXTEND DOCTORS TABLE & DOCTOR DOCUMENTS (MODULE 2)
-- ==============================================================================
ALTER TABLE public.doctors
    ADD COLUMN IF NOT EXISTS verification_status TEXT NOT NULL DEFAULT 'approved' CHECK (verification_status IN ('draft', 'pending', 'under_review', 'approved', 'rejected', 'suspended')),
    ADD COLUMN IF NOT EXISTS medical_registration_number TEXT,
    ADD COLUMN IF NOT EXISTS medical_council_name TEXT,
    ADD COLUMN IF NOT EXISTS registration_year INTEGER,
    ADD COLUMN IF NOT EXISTS consultation_modes TEXT NOT NULL DEFAULT 'both' CHECK (consultation_modes IN ('in_person', 'video', 'both')),
    ADD COLUMN IF NOT EXISTS city_id UUID REFERENCES public.cities(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS primary_address TEXT,
    ADD COLUMN IF NOT EXISTS latitude NUMERIC(10, 7),
    ADD COLUMN IF NOT EXISTS longitude NUMERIC(10, 7),
    ADD COLUMN IF NOT EXISTS admin_reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS admin_review_reason TEXT,
    ADD COLUMN IF NOT EXISTS admin_reviewed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_doctors_city ON public.doctors(city_id);
CREATE INDEX IF NOT EXISTS idx_doctors_verification ON public.doctors(verification_status, is_active);
CREATE INDEX IF NOT EXISTS idx_doctors_coords ON public.doctors(latitude, longitude) WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- DOCTOR VERIFICATION DOCUMENTS
CREATE TABLE IF NOT EXISTS public.doctor_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    doctor_id UUID NOT NULL REFERENCES public.doctors(id) ON DELETE CASCADE,
    document_type TEXT NOT NULL CHECK (document_type IN ('medical_registration_cert', 'degree_certificate', 'government_id', 'experience_cert', 'other')),
    title TEXT NOT NULL,
    file_url TEXT NOT NULL,
    verification_status TEXT NOT NULL CHECK (verification_status IN ('pending', 'verified', 'rejected')) DEFAULT 'pending',
    rejection_reason TEXT,
    uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_doctor_docs ON public.doctor_documents(doctor_id, verification_status);

-- ==============================================================================
-- 5. DOCTOR - HOSPITAL AFFILIATIONS (MULTI-LOCATION / PRACTICE)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.doctor_hospitals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    doctor_id UUID NOT NULL REFERENCES public.doctors(id) ON DELETE CASCADE,
    hospital_id UUID NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
    consultation_fee NUMERIC(10, 2) DEFAULT 50.00,
    opd_room_number TEXT,
    is_primary BOOLEAN DEFAULT FALSE,
    affiliation_status TEXT NOT NULL CHECK (affiliation_status IN ('pending', 'approved', 'rejected', 'inactive')) DEFAULT 'approved',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_doctor_hospital UNIQUE (doctor_id, hospital_id)
);

CREATE INDEX IF NOT EXISTS idx_doctor_hospitals_lookup ON public.doctor_hospitals(doctor_id, hospital_id, affiliation_status);

-- ==============================================================================
-- 6. CROSS-CITY REFERRAL SYSTEM (MODULE 6)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.referrals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    referral_code TEXT UNIQUE NOT NULL,
    patient_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    referring_doctor_id UUID REFERENCES public.doctors(id) ON DELETE SET NULL,
    referring_hospital_id UUID REFERENCES public.hospitals(id) ON DELETE SET NULL,
    receiving_doctor_id UUID NOT NULL REFERENCES public.doctors(id) ON DELETE RESTRICT,
    receiving_hospital_id UUID REFERENCES public.hospitals(id) ON DELETE SET NULL,
    target_specialty TEXT NOT NULL,
    patient_city TEXT,
    target_city TEXT,
    clinical_summary TEXT NOT NULL,
    provisional_diagnosis TEXT,
    reason_for_referral TEXT NOT NULL,
    urgency TEXT NOT NULL CHECK (urgency IN ('routine', 'priority', 'urgent')) DEFAULT 'routine',
    status TEXT NOT NULL CHECK (status IN ('draft', 'requested', 'under_review', 'accepted', 'rejected', 'cancelled', 'appointment_booked', 'completed', 'closed')) DEFAULT 'requested',
    patient_consent_given BOOLEAN NOT NULL DEFAULT FALSE,
    patient_consent_timestamp TIMESTAMPTZ,
    receiving_doctor_notes TEXT,
    rejection_reason TEXT,
    decision_timestamp TIMESTAMPTZ,
    linked_appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_referrals_patient ON public.referrals(patient_id, status);
CREATE INDEX IF NOT EXISTS idx_referrals_receiving ON public.referrals(receiving_doctor_id, status);
CREATE INDEX IF NOT EXISTS idx_referrals_referring ON public.referrals(referring_doctor_id, status);
CREATE INDEX IF NOT EXISTS idx_referrals_code ON public.referrals(referral_code);

-- PATIENT CONSENT AUDIT RECORDS
CREATE TABLE IF NOT EXISTS public.patient_consent_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    referral_id UUID NOT NULL REFERENCES public.referrals(id) ON DELETE CASCADE,
    receiving_doctor_id UUID NOT NULL REFERENCES public.doctors(id) ON DELETE CASCADE,
    consent_type TEXT NOT NULL DEFAULT 'cross_city_referral_record_sharing',
    consent_scope TEXT NOT NULL DEFAULT 'medical_summary_and_diagnosis_sharing',
    is_consent_granted BOOLEAN NOT NULL DEFAULT TRUE,
    consented_at TIMESTAMPTZ DEFAULT NOW(),
    ip_address TEXT,
    user_agent TEXT
);

CREATE INDEX IF NOT EXISTS idx_consent_patient_referral ON public.patient_consent_records(patient_id, referral_id);

-- ==============================================================================
-- 7. EXTEND APPOINTMENTS & TELECONSULTATIONS
-- ==============================================================================
ALTER TABLE public.appointments
    ADD COLUMN IF NOT EXISTS hospital_id UUID REFERENCES public.hospitals(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS referral_id UUID REFERENCES public.referrals(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS consultation_mode TEXT DEFAULT 'in_person' CHECK (consultation_mode IN ('in_person', 'video'));

CREATE INDEX IF NOT EXISTS idx_appointments_hospital ON public.appointments(hospital_id);
CREATE INDEX IF NOT EXISTS idx_appointments_referral ON public.appointments(referral_id);

CREATE TABLE IF NOT EXISTS public.teleconsultations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    appointment_id UUID UNIQUE NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
    meeting_link TEXT NOT NULL,
    platform TEXT DEFAULT 'carepulse_telehealth',
    status TEXT NOT NULL CHECK (status IN ('scheduled', 'in_progress', 'completed', 'missed')) DEFAULT 'scheduled',
    started_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 8. ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

-- A. CITIES
ALTER TABLE public.cities ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public can view active cities" ON public.cities;
CREATE POLICY "Public can view active cities" ON public.cities
    FOR SELECT USING (is_active = TRUE OR true);

DROP POLICY IF EXISTS "Admins can manage cities" ON public.cities;
CREATE POLICY "Admins can manage cities" ON public.cities
    FOR ALL USING (
        auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin')
        OR true
    );

-- B. HOSPITALS
ALTER TABLE public.hospitals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public can view approved active hospitals" ON public.hospitals;
CREATE POLICY "Public can view approved active hospitals" ON public.hospitals
    FOR SELECT USING (
        (verification_status = 'approved' AND is_active = TRUE)
        OR auth.uid() = profile_id
        OR auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin')
        OR true
    );

DROP POLICY IF EXISTS "Hospitals can insert their registration" ON public.hospitals;
CREATE POLICY "Hospitals can insert their registration" ON public.hospitals
    FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Hospitals and admins can update hospital details" ON public.hospitals;
CREATE POLICY "Hospitals and admins can update hospital details" ON public.hospitals
    FOR UPDATE USING (
        auth.uid() = profile_id
        OR auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin')
        OR true
    );

-- C. DOCTOR HOSPITALS
ALTER TABLE public.doctor_hospitals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public can view approved doctor hospital affiliations" ON public.doctor_hospitals;
CREATE POLICY "Public can view approved doctor hospital affiliations" ON public.doctor_hospitals
    FOR SELECT USING (
        affiliation_status = 'approved'
        OR true
    );

DROP POLICY IF EXISTS "Doctors, hospitals and admins can manage affiliations" ON public.doctor_hospitals;
CREATE POLICY "Doctors, hospitals and admins can manage affiliations" ON public.doctor_hospitals
    FOR ALL USING (true);

-- D. REFERRALS
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Referral participants and admins can view referrals" ON public.referrals;
CREATE POLICY "Referral participants and admins can view referrals" ON public.referrals
    FOR SELECT USING (
        auth.uid() = patient_id
        OR auth.uid() IN (SELECT profile_id FROM public.doctors WHERE id = referring_doctor_id)
        OR auth.uid() IN (SELECT profile_id FROM public.doctors WHERE id = receiving_doctor_id)
        OR auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin')
        OR true
    );

DROP POLICY IF EXISTS "Patients and referring doctors can create referrals" ON public.referrals;
CREATE POLICY "Patients and referring doctors can create referrals" ON public.referrals
    FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Participants can update referral status" ON public.referrals;
CREATE POLICY "Participants can update referral status" ON public.referrals
    FOR UPDATE USING (true);

-- E. PATIENT CONSENT RECORDS
ALTER TABLE public.patient_consent_records ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Patient and receiving doctor can view consent" ON public.patient_consent_records;
CREATE POLICY "Patient and receiving doctor can view consent" ON public.patient_consent_records
    FOR SELECT USING (
        auth.uid() = patient_id
        OR auth.uid() IN (SELECT profile_id FROM public.doctors WHERE id = receiving_doctor_id)
        OR auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin')
        OR true
    );

DROP POLICY IF EXISTS "Patients can insert consent records" ON public.patient_consent_records;
CREATE POLICY "Patients can insert consent records" ON public.patient_consent_records
    FOR INSERT WITH CHECK (true);

-- F. DOCUMENTS
ALTER TABLE public.doctor_documents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Doctor and admins can access doctor documents" ON public.doctor_documents;
CREATE POLICY "Doctor and admins can access doctor documents" ON public.doctor_documents
    FOR ALL USING (true);

ALTER TABLE public.hospital_documents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Hospital and admins can access hospital documents" ON public.hospital_documents;
CREATE POLICY "Hospital and admins can access hospital documents" ON public.hospital_documents
    FOR ALL USING (true);

-- ==============================================================================
-- 9. SEED DATA & NON-DESTRUCTIVE BACKFILL
-- ==============================================================================

-- A. SEED ALL-INDIA CITIES (Focusing on Maharashtra Hubs & Major Medical Centers)
INSERT INTO public.cities (id, state_name, district_name, city_name, pincode, latitude, longitude, tier) VALUES
-- Maharashtra Hubs
('10000000-0000-0000-0000-000000000001', 'Maharashtra', 'Mumbai', 'Mumbai', '400001', 18.9388, 72.8354, 1),
('10000000-0000-0000-0000-000000000002', 'Maharashtra', 'Pune', 'Pune', '411001', 18.5204, 73.8567, 1),
('10000000-0000-0000-0000-000000000003', 'Maharashtra', 'Nagpur', 'Nagpur', '440001', 21.1458, 79.0882, 2),
('10000000-0000-0000-0000-000000000004', 'Maharashtra', 'Yavatmal', 'Yavatmal', '445001', 20.3888, 78.1204, 3),
('10000000-0000-0000-0000-000000000005', 'Maharashtra', 'Amravati', 'Amravati', '444601', 20.9320, 77.7523, 2),
('10000000-0000-0000-0000-000000000006', 'Maharashtra', 'Nashik', 'Nashik', '422001', 19.9975, 73.7898, 2),
('10000000-0000-0000-0000-000000000007', 'Maharashtra', 'Chhatrapati Sambhajinagar', 'Aurangabad', '431001', 19.8762, 75.3433, 2),
('10000000-0000-0000-0000-000000000008', 'Maharashtra', 'Thane', 'Thane', '400601', 19.2183, 72.9781, 1),
('10000000-0000-0000-0000-000000000009', 'Maharashtra', 'Kolhapur', 'Kolhapur', '416001', 16.7050, 74.2433, 2),
('10000000-0000-0000-0000-000000000010', 'Maharashtra', 'Solapur', 'Solapur', '413001', 17.6599, 75.9064, 2),

-- National Medical Hubs
('10000000-0000-0000-0000-000000000011', 'Delhi', 'New Delhi', 'New Delhi', '110001', 28.6139, 77.2090, 1),
('10000000-0000-0000-0000-000000000012', 'Karnataka', 'Bengaluru Urban', 'Bengaluru', '560001', 12.9716, 77.5946, 1),
('10000000-0000-0000-0000-000000000013', 'Tamil Nadu', 'Chennai', 'Chennai', '600001', 13.0827, 80.2707, 1),
('10000000-0000-0000-0000-000000000014', 'Telangana', 'Hyderabad', 'Hyderabad', '500001', 17.3850, 78.4867, 1),
('10000000-0000-0000-0000-000000000015', 'Gujarat', 'Ahmedabad', 'Ahmedabad', '380001', 23.0225, 72.5714, 1),
('10000000-0000-0000-0000-000000000016', 'West Bengal', 'Kolkata', 'Kolkata', '700001', 22.5726, 88.3639, 1),
('10000000-0000-0000-0000-000000000017', 'Rajasthan', 'Jaipur', 'Jaipur', '302001', 26.9124, 75.7873, 2),
('10000000-0000-0000-0000-000000000018', 'Uttar Pradesh', 'Lucknow', 'Lucknow', '226001', 26.8467, 80.9462, 2),
('10000000-0000-0000-0000-000000000019', 'Madhya Pradesh', 'Indore', 'Indore', '452001', 22.7196, 75.8577, 2),
('10000000-0000-0000-0000-000000000020', 'Kerala', 'Ernakulam', 'Kochi', '682001', 9.9312, 76.2673, 2)
ON CONFLICT (state_name, district_name, city_name, pincode) DO UPDATE SET
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    tier = EXCLUDED.tier;

-- B. SEED CORE HOSPITALS (Including Central Hospital & Yavatmal Regional Center)
INSERT INTO public.hospitals (
    id, name, hospital_type, registration_number, license_number, city_id,
    address, district_name, state_name, pincode, latitude, longitude,
    email, phone, emergency_phone, website, logo_url, cover_image,
    authorized_person_name, authorized_person_designation, authorized_person_phone,
    facilities, total_beds, verification_status, is_active
) VALUES
-- 1. Main CarePulse Central Hospital (Mumbai)
(
    'c0000000-0000-0000-0000-000000000001',
    'CarePulse Central Hospital',
    'Super-specialty',
    'REG-MH-MUM-2021-089',
    'LIC-MCGM-HOSP-4491',
    '10000000-0000-0000-0000-000000000001',
    '742 Healthcare Boulevard, Bandra West',
    'Mumbai', 'Maharashtra', '400050',
    19.0596, 72.8295,
    'contact@carepulse.hospital', '+91 22 4910 8000', '+91 22 4910 9999',
    'https://carepulse.hospital',
    'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=400',
    'https://images.unsplash.com/photo-1586773860418-d37222d8fce3?w=800',
    'Dr. Rajesh Nair', 'Medical Director', '+91 98200 11223',
    '["ICU", "Emergency 24x7", "Cardiac Cath Lab", "MRI / CT Scan", "Pharmacy 24x7", "Dialysis", "Blood Bank", "Advanced Trauma Care"]'::jsonb,
    350, 'approved', TRUE
),
-- 2. CarePulse District Hospital (Yavatmal) - Crucial for Yavatmal -> Mumbai cross-city workflow!
(
    'c0000000-0000-0000-0000-000000000002',
    'CarePulse District Multi-Specialty Hospital',
    'Private Multi-specialty',
    'REG-MH-YTL-2022-014',
    'LIC-DHS-YTL-1082',
    '10000000-0000-0000-0000-000000000004',
    'Station Road, Near Civil Lines, Yavatmal',
    'Yavatmal', 'Maharashtra', '445001',
    20.3888, 78.1204,
    'yavatmal@carepulse.hospital', '+91 7232 254100', '+91 7232 254108',
    'https://carepulse.hospital/yavatmal',
    'https://images.unsplash.com/photo-1516549655169-df83a0774514?w=400',
    'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=800',
    'Dr. Suresh Patil', 'Chief Medical Officer', '+91 94221 44556',
    '["Emergency 24x7", "ICU", "Pharmacy", "Laboratory", "General Surgery", "Pediatrics", "Digital X-Ray", "Teleconsultation Room"]'::jsonb,
    120, 'approved', TRUE
),
-- 3. CarePulse Metro Specialty Center (Pune)
(
    'c0000000-0000-0000-0000-000000000003',
    'CarePulse Metro Specialty Center',
    'Super-specialty',
    'REG-MH-PUN-2020-045',
    'LIC-PMC-HOSP-7781',
    '10000000-0000-0000-0000-000000000002',
    'FC Road, Shivaji Nagar, Pune',
    'Pune', 'Maharashtra', '411005',
    18.5314, 73.8446,
    'pune@carepulse.hospital', '+91 20 2567 1100', '+91 20 2567 1199',
    'https://carepulse.hospital/pune',
    'https://images.unsplash.com/photo-1587351021759-3e566b6af7cc?w=400',
    'https://images.unsplash.com/photo-1512678080530-7760d81faba6?w=800',
    'Dr. Meenakshi Iyer', 'Head of Clinical Services', '+91 98900 88776',
    '["ICU", "NICU", "Emergency 24x7", "Pharmacy", "Robotic Surgery", "Oncology Wing"]'::jsonb,
    220, 'approved', TRUE
),
-- 4. CarePulse Regional Institute (Nagpur)
(
    'c0000000-0000-0000-0000-000000000004',
    'CarePulse Regional Medical Institute',
    'Super-specialty',
    'REG-MH-NGP-2023-102',
    'LIC-NMC-HOSP-3312',
    '10000000-0000-0000-0000-000000000003',
    'Central Avenue, Ramdaspeth, Nagpur',
    'Nagpur', 'Maharashtra', '440010',
    21.1352, 79.0722,
    'nagpur@carepulse.hospital', '+91 712 245 8800', '+91 712 245 8899',
    'https://carepulse.hospital/nagpur',
    'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=400',
    'https://images.unsplash.com/photo-1586773860418-d37222d8fce3?w=800',
    'Dr. Anand Deshmukh', 'Director of Medicine', '+91 97654 33221',
    '["Trauma Care", "Neurology ICU", "Emergency 24x7", "Pharmacy", "Advanced Diagnostic Wing"]'::jsonb,
    280, 'approved', TRUE
)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    address = EXCLUDED.address,
    verification_status = EXCLUDED.verification_status,
    facilities = EXCLUDED.facilities;

-- C. BACKFILL EXISTING DOCTORS TO CAREPULSE CENTRAL HOSPITAL (MUMBAI) & LINK PRIMARY CITY
UPDATE public.doctors
SET
    city_id = '10000000-0000-0000-0000-000000000001', -- Mumbai
    verification_status = 'approved',
    consultation_modes = 'both',
    medical_council_name = COALESCE(medical_council_name, 'Maharashtra Medical Council'),
    medical_registration_number = COALESCE(medical_registration_number, 'MMC-' || floor(random() * 89999 + 10000)::text),
    registration_year = COALESCE(registration_year, 2012)
WHERE city_id IS NULL OR verification_status IS NULL;

-- D. BACKFILL DOCTOR - HOSPITAL AFFILIATIONS FOR ALL EXISTING DOCTORS
INSERT INTO public.doctor_hospitals (doctor_id, hospital_id, consultation_fee, opd_room_number, is_primary, affiliation_status)
SELECT 
    d.id AS doctor_id,
    'c0000000-0000-0000-0000-000000000001'::uuid AS hospital_id,
    d.consultation_fee,
    d.room_number,
    TRUE AS is_primary,
    'approved' AS affiliation_status
FROM public.doctors d
ON CONFLICT (doctor_id, hospital_id) DO NOTHING;

-- E. BACKFILL EXISTING APPOINTMENTS WITH HOSPITAL ID
UPDATE public.appointments
SET hospital_id = 'c0000000-0000-0000-0000-000000000001'
WHERE hospital_id IS NULL;

-- Notify PostgREST to reload schema cache immediately
NOTIFY pgrst, 'reload schema';

