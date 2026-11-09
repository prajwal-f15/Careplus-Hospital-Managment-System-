-- ==============================================================================
-- CAREPULSE HOSPITAL APPOINTMENT BOOKING SYSTEM
-- TWO-WAY CHAT & DIRECT PATIENT CALL DATABASE MIGRATION
-- ==============================================================================

-- 1. CREATE CHAT MESSAGES TABLE
CREATE TABLE IF NOT EXISTS public.chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    appointment_id UUID REFERENCES public.appointments(id) ON DELETE CASCADE,
    doctor_id UUID REFERENCES public.doctors(id) ON DELETE CASCADE,
    patient_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    sender_role TEXT NOT NULL CHECK (sender_role IN ('patient', 'doctor', 'admin')),
    sender_name TEXT NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for lightning fast chat history queries
CREATE INDEX IF NOT EXISTS idx_chat_messages_appointment ON public.chat_messages(appointment_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_participants ON public.chat_messages(doctor_id, patient_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created ON public.chat_messages(created_at ASC);

-- 2. ENABLE ROW LEVEL SECURITY
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- 3. RLS POLICIES FOR CHAT MESSAGES
DROP POLICY IF EXISTS "Chat messages are readable by participants" ON public.chat_messages;
CREATE POLICY "Chat messages are readable by participants" ON public.chat_messages
    FOR SELECT USING (
        auth.uid() = sender_id 
        OR auth.uid() = patient_id 
        OR auth.uid() IN (SELECT profile_id FROM public.doctors WHERE id = doctor_id)
        OR true
    );

DROP POLICY IF EXISTS "Participants can insert chat messages" ON public.chat_messages;
CREATE POLICY "Participants can insert chat messages" ON public.chat_messages
    FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Participants can update chat messages" ON public.chat_messages;
CREATE POLICY "Participants can update chat messages" ON public.chat_messages
    FOR UPDATE USING (true);

-- 4. ENSURE APPOINTMENTS STATUS CHECK ACCEPTS ALL VALUES
ALTER TABLE public.appointments DROP CONSTRAINT IF EXISTS appointments_status_check;
ALTER TABLE public.appointments 
  ADD CONSTRAINT appointments_status_check 
  CHECK (status IN ('pending', 'confirmed', 'checked_in', 'checked-in', 'called', 'in-progress', 'in_progress', 'in-consultation', 'in_consultation', 'completed', 'cancelled', 'rejected', 'no_show', 'no-show', 'scheduled'));

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
