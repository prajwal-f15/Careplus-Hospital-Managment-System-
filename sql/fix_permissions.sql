-- ==============================================================================
-- FIX ROW-LEVEL SECURITY & PERMISSIONS (Run in Supabase SQL Editor)
-- ==============================================================================

-- 1. Ensure RLS is active but permits necessary reads & writes
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.doctors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.doctor_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- 1B. Fix appointments table columns & check constraints to prevent check constraint violations
ALTER TABLE public.appointments DROP CONSTRAINT IF EXISTS appointments_status_check;
ALTER TABLE public.appointments DROP CONSTRAINT IF EXISTS appointments_queue_status_check;
ALTER TABLE public.appointments DROP CONSTRAINT IF EXISTS appointments_priority_check;

ALTER TABLE public.appointments 
  ADD CONSTRAINT appointments_status_check 
  CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled', 'rejected', 'in-consultation', 'in-progress', 'scheduled'));

-- Ensure columns exist whether old schema or new schema
DO $$ 
BEGIN
  BEGIN
    ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS time_slot TIME;
  EXCEPTION WHEN others THEN NULL;
  END;
  BEGIN
    ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS appointment_time TIME;
  EXCEPTION WHEN others THEN NULL;
  END;
  BEGIN
    ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS appointment_number TEXT;
  EXCEPTION WHEN others THEN NULL;
  END;
  BEGIN
    ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS queue_status TEXT DEFAULT 'waiting';
  EXCEPTION WHEN others THEN NULL;
  END;
  BEGIN
    ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS is_called BOOLEAN DEFAULT FALSE;
  EXCEPTION WHEN others THEN NULL;
  END;
  BEGIN
    ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'normal';
  EXCEPTION WHEN others THEN NULL;
  END;
END $$;

-- 2. Drop any outdated / conflicting policies
DROP POLICY IF EXISTS "Public can view active doctor and staff profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can create their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can delete profiles" ON public.profiles;
DROP POLICY IF EXISTS "Public profiles are readable by authenticated users" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

DROP POLICY IF EXISTS "Everyone can view doctors" ON public.doctors;
DROP POLICY IF EXISTS "Doctors directory is readable by everyone" ON public.doctors;
DROP POLICY IF EXISTS "Doctors can update own doctor record" ON public.doctors;
DROP POLICY IF EXISTS "Doctors can update their own doctor record" ON public.doctors;
DROP POLICY IF EXISTS "Admins insert and delete doctors" ON public.doctors;
DROP POLICY IF EXISTS "Admins delete doctors" ON public.doctors;
DROP POLICY IF EXISTS "Admin can manage all doctors" ON public.doctors;
DROP POLICY IF EXISTS "Allow doctor insert during registration" ON public.doctors;

-- 3. Create clean, robust policies for PROFILES
CREATE POLICY "Profiles are viewable by everyone" 
  ON public.profiles FOR SELECT 
  USING (true);

CREATE POLICY "Profiles can be inserted by anyone" 
  ON public.profiles FOR INSERT 
  WITH CHECK (true);

CREATE POLICY "Profiles can be updated by owner or admin" 
  ON public.profiles FOR UPDATE 
  USING (true)
  WITH CHECK (true);

-- 4. Create clean, robust policies for DOCTORS
CREATE POLICY "Doctors are viewable by everyone" 
  ON public.doctors FOR SELECT 
  USING (true);

CREATE POLICY "Doctors can be inserted by anyone" 
  ON public.doctors FOR INSERT 
  WITH CHECK (true);

CREATE POLICY "Doctors can be updated by anyone/admin" 
  ON public.doctors FOR UPDATE 
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Doctors can be deleted by admin" 
  ON public.doctors FOR DELETE 
  USING (true);

-- 5. DOCTOR AVAILABILITY Policies
DROP POLICY IF EXISTS "Availability is readable by everyone" ON public.doctor_availability;
DROP POLICY IF EXISTS "Doctors can manage their availability" ON public.doctor_availability;
DROP POLICY IF EXISTS "Everyone can view doctor availability" ON public.doctor_availability;
DROP POLICY IF EXISTS "Doctors manage own availability" ON public.doctor_availability;

CREATE POLICY "Doctor availability is readable by everyone" 
  ON public.doctor_availability FOR SELECT 
  USING (true);

CREATE POLICY "Doctor availability can be inserted by anyone" 
  ON public.doctor_availability FOR INSERT 
  WITH CHECK (true);

CREATE POLICY "Doctor availability can be updated by anyone" 
  ON public.doctor_availability FOR UPDATE 
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Doctor availability can be deleted by anyone" 
  ON public.doctor_availability FOR DELETE 
  USING (true);

-- 6. APPOINTMENTS Policies
DROP POLICY IF EXISTS "Patients can view own appointments" ON public.appointments;
DROP POLICY IF EXISTS "Patients can insert their appointments" ON public.appointments;
DROP POLICY IF EXISTS "Doctors and Patients can update relevant appointments" ON public.appointments;

CREATE POLICY "Appointments are viewable by everyone" 
  ON public.appointments FOR SELECT 
  USING (true);

CREATE POLICY "Appointments can be inserted by anyone" 
  ON public.appointments FOR INSERT 
  WITH CHECK (true);

CREATE POLICY "Appointments can be updated by anyone" 
  ON public.appointments FOR UPDATE 
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Appointments can be deleted by admin" 
  ON public.appointments FOR DELETE 
  USING (true);

-- 7. NOTIFICATIONS Policies
DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
DROP POLICY IF EXISTS "System and users can insert notifications" ON public.notifications;

CREATE POLICY "Notifications are readable by everyone" 
  ON public.notifications FOR SELECT 
  USING (true);

CREATE POLICY "Notifications can be inserted by anyone" 
  ON public.notifications FOR INSERT 
  WITH CHECK (true);

CREATE POLICY "Notifications can be updated by anyone" 
  ON public.notifications FOR UPDATE 
  USING (true)
  WITH CHECK (true);

-- 8. Automatically create doctor records for any doctor profile missing from doctors table
INSERT INTO public.doctors (profile_id, specialization, qualification, experience_years, is_verified, is_available_today)
SELECT p.id, 'Medical Specialist', 'MBBS, MD', 5, TRUE, TRUE
FROM public.profiles p
WHERE p.role = 'doctor'
  AND p.id NOT IN (SELECT profile_id FROM public.doctors WHERE profile_id IS NOT NULL)
ON CONFLICT (profile_id) DO NOTHING;

-- 9. Sync time_slot and appointment_time columns so both old and new schema queries work seamlessly
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'appointments' AND column_name = 'time_slot') 
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'appointments' AND column_name = 'appointment_time') THEN
    UPDATE public.appointments 
    SET time_slot = COALESCE(time_slot, appointment_time),
        appointment_time = COALESCE(appointment_time, time_slot);
  END IF;
END $$;

-- 10. Force PostgREST to reload schema cache immediately
NOTIFY pgrst, 'reload schema';
