-- ==============================================================================
-- CAREPULSE HEALTHCARE PLATFORM: CAMPAIGNS & HEALTH RECORDS MIGRATION
-- Supports: Visiting Doctor Campaigns, Medical Camps, Patient Health Records & Booking Source
-- ==============================================================================

-- 1. Create doctor_visit_campaigns table
CREATE TABLE IF NOT EXISTS public.doctor_visit_campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    doctor_id UUID REFERENCES public.doctors(id) ON DELETE CASCADE,
    hospital_id UUID REFERENCES public.hospitals(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    city_id UUID REFERENCES public.cities(id) ON DELETE SET NULL,
    venue_address TEXT NOT NULL,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    target_radius_km INT DEFAULT 50,
    banner_url TEXT DEFAULT 'https://images.unsplash.com/photo-1516549655169-df83a0774514?w=800',
    campaign_type TEXT DEFAULT 'visiting_specialist' CHECK (campaign_type IN ('visiting_specialist', 'visiting_surgeon', 'specialist_opd', 'medical_camp', 'free_checkup', 'diagnostic_camp')),
    specialization TEXT,
    available_slots INT DEFAULT 20,
    fee NUMERIC DEFAULT 0,
    status TEXT DEFAULT 'pending' CHECK (status IN ('draft', 'pending', 'approved', 'rejected', 'active', 'expired', 'cancelled')),
    is_active BOOLEAN DEFAULT FALSE,
    is_sponsored BOOLEAN DEFAULT FALSE,
    impressions INT DEFAULT 0,
    clicks INT DEFAULT 0,
    conversions INT DEFAULT 0,
    admin_reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    admin_review_reason TEXT,
    admin_reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast location and date queries
CREATE INDEX IF NOT EXISTS idx_campaigns_status_dates 
ON public.doctor_visit_campaigns(status, is_active, start_date, end_date);

CREATE INDEX IF NOT EXISTS idx_campaigns_city 
ON public.doctor_visit_campaigns(city_id);

-- 2. Create patient_health_records table
CREATE TABLE IF NOT EXISTS public.patient_health_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    family_member_id UUID REFERENCES public.family_members(id) ON DELETE SET NULL,
    record_type TEXT NOT NULL CHECK (record_type IN ('prescription', 'lab_report', 'discharge_summary', 'radiology', 'vaccination', 'other')),
    title TEXT NOT NULL,
    doctor_name TEXT,
    hospital_name TEXT,
    record_date DATE DEFAULT CURRENT_DATE,
    file_url TEXT,
    file_name TEXT,
    file_size_kb INT,
    notes TEXT,
    doctor_shared BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_health_records_patient 
ON public.patient_health_records(patient_id);

-- 3. Add booking_source to appointments
ALTER TABLE public.appointments 
ADD COLUMN IF NOT EXISTS booking_source TEXT DEFAULT 'doctor' CHECK (booking_source IN ('doctor', 'hospital'));

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.doctor_visit_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_health_records ENABLE ROW LEVEL SECURITY;

-- Campaign Policies
DROP POLICY IF EXISTS "Public can view approved active campaigns" ON public.doctor_visit_campaigns;
CREATE POLICY "Public can view approved active campaigns"
ON public.doctor_visit_campaigns FOR SELECT
USING (status = 'approved' AND is_active = TRUE);

DROP POLICY IF EXISTS "Staff and doctors can manage own campaigns" ON public.doctor_visit_campaigns;
CREATE POLICY "Staff and doctors can manage own campaigns"
ON public.doctor_visit_campaigns FOR ALL
USING (auth.uid() IS NOT NULL);

-- Health Records Policies
DROP POLICY IF EXISTS "Patients can view own health records" ON public.patient_health_records;
CREATE POLICY "Patients can view own health records"
ON public.patient_health_records FOR SELECT
USING (auth.uid() = patient_id OR auth.uid() IN (SELECT profile_id FROM public.doctors) OR auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin'));

DROP POLICY IF EXISTS "Patients can insert own health records" ON public.patient_health_records;
CREATE POLICY "Patients can insert own health records"
ON public.patient_health_records FOR INSERT
WITH CHECK (auth.uid() = patient_id OR auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin'));

-- 5. Seed Initial Approved Campaigns for Location-Based Testing
INSERT INTO public.doctor_visit_campaigns (
    id,
    doctor_id,
    hospital_id,
    title,
    description,
    city_id,
    venue_address,
    latitude,
    longitude,
    start_date,
    end_date,
    target_radius_km,
    banner_url,
    campaign_type,
    specialization,
    available_slots,
    fee,
    status,
    is_active,
    is_sponsored,
    impressions,
    clicks,
    conversions
) VALUES 
(
    'e0000000-0000-0000-0000-000000000001',
    'd0c11111-1111-1111-1111-111111111111', -- Dr. Rahul Sharma
    'c0000000-0000-0000-0000-000000000002', -- CarePulse District Hospital, Yavatmal
    'Senior Interventional Cardiologist 2-Day OPD Visit in Yavatmal',
    'Dr. Rahul Sharma (Senior Cardiologist from Mumbai) is visiting Yavatmal for advanced heart checkups, ECG evaluation, and hypertension consultations.',
    '10000000-0000-0000-0000-000000000004', -- Yavatmal city_id
    'CarePulse District Multi-Specialty Hospital, Station Road, Yavatmal',
    20.3888,
    78.1204,
    CURRENT_DATE,
    CURRENT_DATE + INTERVAL '5 days',
    50,
    'https://images.unsplash.com/photo-1579684385127-1ef15d508118?w=800',
    'visiting_specialist',
    'Interventional Cardiology',
    25,
    65.00,
    'approved',
    TRUE,
    TRUE,
    420,
    58,
    14
),
(
    'e0000000-0000-0000-0000-000000000002',
    'd0c22222-2222-2222-2222-222222222222', -- Dr. Priya Patel
    'c0000000-0000-0000-0000-000000000003', -- CarePulse Metro Center, Pune
    'Comprehensive Free Neurological Screening Camp',
    'Free screening for migraine, epilepsy, stroke rehabilitation, and spine disorders with expert neurologist Dr. Priya Patel.',
    '10000000-0000-0000-0000-000000000002', -- Pune city_id
    'CarePulse Metro Specialty Center, FC Road, Shivaji Nagar, Pune',
    18.5314,
    73.8446,
    CURRENT_DATE,
    CURRENT_DATE + INTERVAL '7 days',
    25,
    'https://images.unsplash.com/photo-1516549655169-df83a0774514?w=800',
    'medical_camp',
    'Neurology',
    50,
    0.00,
    'approved',
    TRUE,
    FALSE,
    680,
    112,
    35
)
ON CONFLICT (id) DO NOTHING;
