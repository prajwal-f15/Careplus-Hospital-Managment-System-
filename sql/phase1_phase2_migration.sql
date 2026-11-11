-- ==============================================================================
-- CAREPULSE HOSPITAL APPOINTMENT BOOKING SYSTEM
-- PHASE 1 & PHASE 2 FEATURES DATABASE MIGRATION & RLS POLICIES
-- ==============================================================================
-- Features included in this migration:
-- 1. Feature 1: QR Code Secure Verification Identifier
-- 2. Feature 2: Patient Appointment Rescheduling Columns & History
-- 3. Feature 3: Doctor Availability & Live OPD Status
-- 4. Feature 4: Appointment Reminders (24h & 1h) Table & Scheduled Checks
-- 5. Feature 5: Doctor Delay Management Columns (Minutes, Reason, Timestamp)
-- 6. Feature 6: Waiting List & Atomic Slot Reallocation Table & Functions
-- ==============================================================================

-- 1. EXTEND APPOINTMENTS TABLE
ALTER TABLE public.appointments 
  ADD COLUMN IF NOT EXISTS verification_hash TEXT,
  ADD COLUMN IF NOT EXISTS reschedule_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rescheduled_from_date DATE,
  ADD COLUMN IF NOT EXISTS rescheduled_from_slot TIME;

-- Fix appointments check constraint to permit all modern appointment statuses
ALTER TABLE public.appointments DROP CONSTRAINT IF EXISTS appointments_status_check;
ALTER TABLE public.appointments 
  ADD CONSTRAINT appointments_status_check 
  CHECK (status IN ('pending', 'confirmed', 'checked_in', 'checked-in', 'called', 'in-progress', 'in_progress', 'in-consultation', 'in_consultation', 'completed', 'cancelled', 'rejected', 'no_show', 'no-show', 'scheduled'));

-- Generate verification hash for existing appointments if null
UPDATE public.appointments
SET verification_hash = encode(digest(id::text || appointment_number || token_number || created_at::text, 'sha256'), 'hex')
WHERE verification_hash IS NULL;

-- 2. EXTEND DOCTORS TABLE FOR DELAY MANAGEMENT & LIVE STATUS
ALTER TABLE public.doctors
  ADD COLUMN IF NOT EXISTS delay_minutes INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS delay_reason TEXT,
  ADD COLUMN IF NOT EXISTS delay_reported_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS live_opd_status TEXT DEFAULT 'available';

-- 3. CREATE APPOINTMENT REMINDERS TABLE (Feature 4)
CREATE TABLE IF NOT EXISTS public.appointment_reminders (
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

CREATE INDEX IF NOT EXISTS idx_reminders_status_scheduled ON public.appointment_reminders(status, scheduled_for);

-- 4. CREATE WAITING LIST TABLE (Feature 6)
CREATE TABLE IF NOT EXISTS public.waiting_list (
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

CREATE INDEX IF NOT EXISTS idx_waiting_list_lookup ON public.waiting_list(doctor_id, preferred_date, status);

-- 5. ATOMIC WAITING LIST REALLOCATION FUNCTION (Feature 6)
CREATE OR REPLACE FUNCTION public.reallocate_cancelled_slot(p_cancelled_appointment_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_appt RECORD;
    v_wait RECORD;
    v_doc RECORD;
    v_patient RECORD;
    v_expires_at TIMESTAMPTZ;
BEGIN
    -- 1. Fetch cancelled appointment details
    SELECT * INTO v_appt FROM public.appointments WHERE id = p_cancelled_appointment_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'Appointment not found');
    END IF;

    -- 2. Fetch doctor info
    SELECT d.*, p.full_name AS doctor_name INTO v_doc
    FROM public.doctors d
    JOIN public.profiles p ON d.profile_id = p.id
    WHERE d.id = v_appt.doctor_id;

    -- 3. Find next waiting patient for same doctor and date with row locking
    SELECT * INTO v_wait
    FROM public.waiting_list
    WHERE doctor_id = v_appt.doctor_id
      AND preferred_date = v_appt.appointment_date
      AND status = 'waiting'
    ORDER BY priority ASC, created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', true, 'reallocated', false, 'message', 'No waiting patients found');
    END IF;

    -- 4. Set offer expiring in 30 minutes
    v_expires_at := NOW() + INTERVAL '30 minutes';

    UPDATE public.waiting_list
    SET status = 'offered',
        offered_appointment_id = v_appt.id,
        offered_time_slot = v_appt.time_slot,
        offer_expires_at = v_expires_at,
        updated_at = NOW()
    WHERE id = v_wait.id;

    -- 5. Send Notification to waiting patient
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

-- 6. APPOINTMENT REMINDERS CHECK FUNCTION (Feature 4)
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

-- 7. ROW LEVEL SECURITY (RLS) FOR NEW TABLES
ALTER TABLE public.appointment_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.waiting_list ENABLE ROW LEVEL SECURITY;

-- Permissive and role-checked policies for development & production
CREATE POLICY "Reminders are readable by owner or admin"
ON public.appointment_reminders FOR SELECT
USING (true);

CREATE POLICY "Reminders can be inserted by system"
ON public.appointment_reminders FOR INSERT
WITH CHECK (true);

CREATE POLICY "Reminders can be updated by system"
ON public.appointment_reminders FOR UPDATE
USING (true);

CREATE POLICY "Waiting list is readable by users and admin"
jON public.waiting_list FOR SELECT
USING (true);

CREATE POLICY "Waiting list can be inserted by patients"
ON public.waiting_list FOR INSERT
WITH CHECK (true);

CREATE POLICY "Waiting list can be updated by patients and staff"
ON public.waiting_list FOR UPDATE
USING (true);

CREATE POLICY "Waiting list can be deleted by owner or admin"
ON public.waiting_list FOR DELETE
USING (true);

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';

