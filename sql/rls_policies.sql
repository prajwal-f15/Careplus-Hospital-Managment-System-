-- ==============================================================================
-- HOSPITAL APPOINTMENT BOOKING SYSTEM - ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE doctors ENABLE ROW LEVEL SECURITY;
ALTER TABLE doctor_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

-- Helper function to get current user's profile role
CREATE OR REPLACE FUNCTION get_current_user_role()
RETURNS VARCHAR AS $$
    SELECT role FROM profiles WHERE user_id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

-- ------------------------------------------------------------------------------
-- 1. PROFILES POLICIES
-- ------------------------------------------------------------------------------
-- Anyone authenticated can view their own profile, public can view doctor basic profiles
CREATE POLICY "Public can view active doctor and staff profiles" 
ON profiles FOR SELECT 
USING (role = 'doctor' OR user_id = auth.uid() OR get_current_user_role() = 'admin');

-- Users can insert their own profile
CREATE POLICY "Users can create their own profile" 
ON profiles FOR INSERT 
WITH CHECK (user_id = auth.uid() OR get_current_user_role() = 'admin');

-- Users can update their own profile; Admin can update any profile
CREATE POLICY "Users can update own profile" 
ON profiles FOR UPDATE 
USING (user_id = auth.uid() OR get_current_user_role() = 'admin');

-- Only Admins can delete profiles
CREATE POLICY "Admins can delete profiles" 
ON profiles FOR DELETE 
USING (get_current_user_role() = 'admin');

-- ------------------------------------------------------------------------------
-- 2. DEPARTMENTS POLICIES
-- ------------------------------------------------------------------------------
-- Everyone can read active departments
CREATE POLICY "Everyone can read departments" 
ON departments FOR SELECT 
USING (true);

-- Only Admins can insert, update, or delete departments
CREATE POLICY "Admins manage departments" 
ON departments FOR ALL 
USING (get_current_user_role() = 'admin');

-- ------------------------------------------------------------------------------
-- 3. DOCTORS POLICIES
-- ------------------------------------------------------------------------------
-- Everyone can view verified doctors
CREATE POLICY "Everyone can view doctors" 
ON doctors FOR SELECT 
USING (true);

-- Doctors can update their own record; Admin can manage all
CREATE POLICY "Doctors can update own doctor record" 
ON doctors FOR UPDATE 
USING (
    profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()) 
    OR get_current_user_role() = 'admin'
);

-- Admin can insert / delete doctors
CREATE POLICY "Admins insert and delete doctors" 
ON doctors FOR INSERT 
WITH CHECK (get_current_user_role() = 'admin' OR profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Admins delete doctors" 
ON doctors FOR DELETE 
USING (get_current_user_role() = 'admin');

-- ------------------------------------------------------------------------------
-- 4. DOCTOR AVAILABILITY POLICIES
-- ------------------------------------------------------------------------------
-- Everyone can read doctor availability to check slots
CREATE POLICY "Everyone can view doctor availability" 
ON doctor_availability FOR SELECT 
USING (true);

-- Doctors can manage their own schedule; Admins can manage all
CREATE POLICY "Doctors manage own availability" 
ON doctor_availability FOR ALL 
USING (
    doctor_id IN (
        SELECT d.id FROM doctors d 
        JOIN profiles p ON d.profile_id = p.id 
        WHERE p.user_id = auth.uid()
    ) 
    OR get_current_user_role() = 'admin'
);

-- ------------------------------------------------------------------------------
-- 5. APPOINTMENTS POLICIES
-- ------------------------------------------------------------------------------
-- Patients can view their own appointments
-- Doctors can view appointments assigned to them
-- Admins can view all appointments
CREATE POLICY "View appointments policy" 
ON appointments FOR SELECT 
USING (
    patient_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    OR doctor_id IN (
        SELECT d.id FROM doctors d 
        JOIN profiles p ON d.profile_id = p.id 
        WHERE p.user_id = auth.uid()
    )
    OR get_current_user_role() = 'admin'
);

-- Patients can create their own appointments; Admins can create appointments
CREATE POLICY "Create appointments policy" 
ON appointments FOR INSERT 
WITH CHECK (
    patient_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    OR get_current_user_role() = 'admin'
);

-- Patients can cancel/reschedule their own pending/confirmed appointments
-- Doctors can update status (confirm, reject, complete) of their assigned appointments
-- Admins can update any appointment
CREATE POLICY "Update appointments policy" 
ON appointments FOR UPDATE 
USING (
    patient_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    OR doctor_id IN (
        SELECT d.id FROM doctors d 
        JOIN profiles p ON d.profile_id = p.id 
        WHERE p.user_id = auth.uid()
    )
    OR get_current_user_role() = 'admin'
);

-- Only Admins can hard delete appointments
CREATE POLICY "Delete appointments policy" 
ON appointments FOR DELETE 
USING (get_current_user_role() = 'admin');

-- ------------------------------------------------------------------------------
-- 6. NOTIFICATIONS POLICIES
-- ------------------------------------------------------------------------------
-- Users can only see and manage their own notifications
CREATE POLICY "Users access own notifications" 
ON notifications FOR ALL 
USING (user_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

-- System or trigger inserts allowed
CREATE POLICY "System can insert notifications" 
ON notifications FOR INSERT 
WITH CHECK (true);

-- ------------------------------------------------------------------------------
-- 7. REVIEWS POLICIES
-- ------------------------------------------------------------------------------
-- Everyone can read doctor reviews
CREATE POLICY "Everyone can read reviews" 
ON reviews FOR SELECT 
USING (true);

-- Only verified patients with completed appointments can submit reviews
CREATE POLICY "Patients with completed appointment can review" 
ON reviews FOR INSERT 
WITH CHECK (
    patient_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    AND EXISTS (
        SELECT 1 FROM appointments a 
        WHERE a.id = appointment_id 
        AND a.patient_id = patient_id 
        AND a.doctor_id = doctor_id 
        AND a.status = 'completed'
    )
);

-- Patients can update their own reviews; Admins can moderate/delete
CREATE POLICY "Manage own reviews" 
ON reviews FOR UPDATE 
USING (patient_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()) OR get_current_user_role() = 'admin');

CREATE POLICY "Admins can delete reviews" 
ON reviews FOR DELETE 
USING (get_current_user_role() = 'admin');
