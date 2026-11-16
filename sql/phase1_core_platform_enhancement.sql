-- ==============================================================================
-- CAREPULSE HOSPITAL MANAGEMENT SYSTEM
-- Phase 1: Core Platform Enhancement Migration
-- Multi-Hospital Doctor Practice, Hospital Staff & Location Directory
-- ==============================================================================

-- 1. Extend doctor_availability with hospital_id for multi-location schedules
ALTER TABLE public.doctor_availability 
  ADD COLUMN IF NOT EXISTS hospital_id UUID REFERENCES public.hospitals(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_doctor_availability_hospital 
  ON public.doctor_availability(doctor_id, hospital_id);

-- 2. Extend doctor_hospitals with practice schedule details
ALTER TABLE public.doctor_hospitals 
  ADD COLUMN IF NOT EXISTS consultation_days TEXT[] DEFAULT ARRAY['Monday', 'Wednesday', 'Friday'],
  ADD COLUMN IF NOT EXISTS opd_timing TEXT DEFAULT '09:00 - 13:00';

-- 3. Extend cities table with featured status and ordering
ALTER TABLE public.cities
  ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS display_order INT DEFAULT 100;

-- Set primary discovery hubs as featured
UPDATE public.cities SET is_featured = TRUE, display_order = 1 WHERE city_name = 'Mumbai';
UPDATE public.cities SET is_featured = TRUE, display_order = 2 WHERE city_name = 'Pune';
UPDATE public.cities SET is_featured = TRUE, display_order = 3 WHERE city_name = 'Nagpur';
UPDATE public.cities SET is_featured = TRUE, display_order = 4 WHERE city_name = 'Yavatmal';

-- 4. Create hospital_staff table for Hospital & Clinic Portal
CREATE TABLE IF NOT EXISTS public.hospital_staff (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hospital_id UUID NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL DEFAULT 'hospital_admin' CHECK (role IN ('hospital_admin', 'receptionist', 'opd_manager', 'nurse')),
    designation TEXT DEFAULT 'Hospital Administrator',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_hospital_staff_member UNIQUE (hospital_id, profile_id)
);

CREATE INDEX IF NOT EXISTS idx_hospital_staff_lookup 
  ON public.hospital_staff(hospital_id, profile_id, is_active);

-- Enable RLS on hospital_staff
ALTER TABLE public.hospital_staff ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view active hospital staff" ON public.hospital_staff;
CREATE POLICY "Public can view active hospital staff" ON public.hospital_staff
    FOR SELECT USING (is_active = TRUE);

DROP POLICY IF EXISTS "Hospital admins and super admins can manage hospital staff" ON public.hospital_staff;
CREATE POLICY "Hospital admins and super admins can manage hospital staff" ON public.hospital_staff
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role IN ('admin', 'hospital')
        )
    );

-- 5. Appointments hospital_id consistency
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS hospital_id UUID REFERENCES public.hospitals(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_appointments_hospital_lookup
  ON public.appointments(hospital_id, appointment_date, status);

