-- ==============================================================================
-- HOSPITAL APPOINTMENT BOOKING SYSTEM - SEED DATA
-- (RFC 4122 Compliant Hexadecimal UUIDs)
-- ==============================================================================

-- 1. INSERT DEPARTMENTS
INSERT INTO departments (id, name, code, description, icon, room_number) VALUES
('d1111111-1111-1111-1111-111111111111', 'Cardiology', 'CARD', 'Comprehensive heart and cardiovascular care with modern diagnostic labs.', 'heart', 'Wing A - Room 101'),
('d2222222-2222-2222-2222-222222222222', 'Neurology', 'NEUR', 'Advanced diagnosis and treatment for brain, spine, and nerve disorders.', 'brain', 'Wing B - Room 204'),
('d3333333-3333-3333-3333-333333333333', 'Orthopedics', 'ORTH', 'Joint replacement, fracture care, and musculoskeletal rehabilitation.', 'bone', 'Wing C - Room 105'),
('d4444444-4444-4444-4444-444444444444', 'Dermatology', 'DERM', 'Clinical skin treatments, acne care, and cosmetic dermatology.', 'sparkles', 'Wing A - Room 302'),
('d5555555-5555-5555-5555-555555555555', 'Pediatrics', 'PED', 'Compassionate pediatric healthcare and developmental wellness for children.', 'baby', 'Wing D - Room 108'),
('d6666666-6666-6666-6666-666666666666', 'General Medicine', 'GEN', 'Primary healthcare, preventive wellness, and infectious disease management.', 'stethoscope', 'Wing B - Room 102'),
('d7777777-7777-7777-7777-777777777777', 'Dentistry', 'DENT', 'Complete oral health, root canals, orthodontics, and smile design.', 'smile', 'Wing C - Room 205'),
('d8888888-8888-8888-8888-888888888888', 'Ophthalmology', 'OPHT', 'Eye care, laser vision correction, cataract surgery, and retinal care.', 'eye', 'Wing A - Room 208')
ON CONFLICT (name) DO NOTHING;

-- 2. INSERT PROFILES
-- Admin Profile
INSERT INTO profiles (id, full_name, email, phone, role, gender, address) VALUES
('a0000000-0000-0000-0000-000000000001', 'Admin Director', 'admin@hospital.com', '+1 (555) 000-1111', 'admin', 'Other', 'CarePulse Central Hospital Management Office')
ON CONFLICT (email) DO NOTHING;

-- Doctor Profiles
INSERT INTO profiles (id, full_name, email, phone, role, gender, address, profile_image) VALUES
('11111111-1111-1111-1111-111111111111', 'Dr. Rahul Sharma', 'rahul.sharma@hospital.com', '+1 (555) 234-5678', 'doctor', 'Male', 'Metro Health Towers, Suite 4B', 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=400&auto=format&fit=crop&q=80'),
('22222222-2222-2222-2222-222222222222', 'Dr. Priya Patel', 'priya.patel@hospital.com', '+1 (555) 345-6789', 'doctor', 'Female', 'Green Valley Medical Plaza', 'https://images.unsplash.com/photo-1594824813629-456cb04c3547?w=400&auto=format&fit=crop&q=80'),
('33333333-3333-3333-3333-333333333333', 'Dr. Vikram Sethi', 'vikram.sethi@hospital.com', '+1 (555) 456-7890', 'doctor', 'Male', 'Sunset Boulevard Medical Center', 'https://images.unsplash.com/photo-1537368910025-700350fe46c7?w=400&auto=format&fit=crop&q=80'),
('44444444-4444-4444-4444-444444444444', 'Dr. Ananya Roy', 'ananya.roy@hospital.com', '+1 (555) 567-8901', 'doctor', 'Female', 'CityCare Specialty Wing', 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=400&auto=format&fit=crop&q=80'),
('55555555-5555-5555-5555-555555555555', 'Dr. Aris Thorne', 'aris.thorne@hospital.com', '+1 (555) 678-9012', 'doctor', 'Male', 'Highland Park Health Complex', 'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=400&auto=format&fit=crop&q=80')
ON CONFLICT (email) DO NOTHING;

-- Patient Profiles
INSERT INTO profiles (id, full_name, email, phone, role, gender, date_of_birth, blood_group, address) VALUES
('99999999-9999-9999-9999-999999999991', 'John Doe', 'patient@hospital.com', '+1 (555) 789-0123', 'patient', 'Male', '1992-05-14', 'O+', '42 Elm Street, Downtown'),
('99999999-9999-9999-9999-999999999992', 'Sarah Jenkins', 'sarah.j@example.com', '+1 (555) 890-1234', 'patient', 'Female', '1988-11-20', 'A+', '88 Pine Ridge Road'),
('99999999-9999-9999-9999-999999999993', 'Michael Chang', 'mchang@example.com', '+1 (555) 901-2345', 'patient', 'Male', '1995-03-08', 'B+', '120 West Lakeview Drive')
ON CONFLICT (email) DO NOTHING;

-- 3. INSERT DOCTORS
INSERT INTO doctors (id, profile_id, department_id, specialization, qualification, experience_years, hospital_name, room_number, consultation_fee, about, rating, total_reviews, is_verified, is_available_today) VALUES
('d0c11111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'd1111111-1111-1111-1111-111111111111', 'Senior Interventional Cardiologist', 'MBBS, MD (Cardiology), FACC (USA)', 14, 'CarePulse Central Hospital', 'Wing A - Room 101', 65.00, 'Dr. Rahul Sharma has over 14 years of experience diagnosing complex cardiac conditions, angioplasty, hypertension management, and preventive heart care.', 4.9, 128, TRUE, TRUE),
('d0c22222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222', 'd2222222-2222-2222-2222-222222222222', 'Consultant Neurologist & Stroke Specialist', 'MBBS, DM (Neurology), Fellowship in Neurophysiology', 11, 'CarePulse Central Hospital', 'Wing B - Room 204', 70.00, 'Dr. Priya Patel specializes in stroke rehabilitation, migraine disorders, epilepsy management, and neurological evaluations with advanced EEG/EMG testing.', 4.8, 94, TRUE, TRUE),
('d0c33333-3333-3333-3333-333333333333', '33333333-3333-3333-3333-333333333333', 'd3333333-3333-3333-3333-333333333333', 'Orthopedic Surgeon & Joint Replacement Specialist', 'MBBS, MS (Ortho), MCh (Orthopedics, UK)', 16, 'CarePulse Central Hospital', 'Wing C - Room 105', 60.00, 'Dr. Vikram Sethi is a distinguished orthopedic surgeon specializing in robotic joint replacements, sports injuries, arthroscopic surgeries, and spine care.', 4.9, 142, TRUE, TRUE),
('d0c44444-4444-4444-4444-444444444444', '44444444-4444-4444-4444-444444444444', 'd4444444-4444-4444-4444-444444444444', 'Consultant Dermatologist & Aesthetician', 'MBBS, MD (Dermatology, Venereology & Leprosy)', 9, 'CarePulse Central Hospital', 'Wing A - Room 302', 50.00, 'Dr. Ananya Roy provides evidence-based treatments for clinical skin conditions, eczema, psoriasis, hair loss therapies, and laser dermatological procedures.', 4.7, 86, TRUE, TRUE),
('d0c55555-5555-5555-5555-555555555555', '55555555-5555-5555-5555-555555555555', 'd5555555-5555-5555-5555-555555555555', 'Lead Pediatrician & Neonatologist', 'MBBS, MD (Pediatrics), DNB (Pediatrics)', 12, 'CarePulse Central Hospital', 'Wing D - Room 108', 45.00, 'Dr. Aris Thorne focuses on child wellness, infant immunization, growth monitoring, developmental milestones, and pediatric respiratory conditions.', 4.9, 110, TRUE, TRUE)
ON CONFLICT (id) DO NOTHING;

-- 4. INSERT DOCTOR AVAILABILITY SCHEDULES
INSERT INTO doctor_availability (doctor_id, day_of_week, start_time, end_time, slot_duration_minutes, is_available) VALUES
-- Dr. Rahul Sharma (Mon - Fri)
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

-- 5. INSERT INITIAL APPOINTMENTS
INSERT INTO appointments (id, patient_id, doctor_id, appointment_date, appointment_time, token_number, token_sequence, reason, status, doctor_notes) VALUES
('a0711111-1111-1111-1111-111111111111', '99999999-9999-9999-9999-999999999991', 'd0c11111-1111-1111-1111-111111111111', CURRENT_DATE, '09:30:00', 'CARD-001', 1, 'Routine blood pressure review and mild chest tightness', 'confirmed', 'Patient advised to bring recent ECG.'),
('a0722222-2222-2222-2222-222222222222', '99999999-9999-9999-9999-999999999992', 'd0c11111-1111-1111-1111-111111111111', CURRENT_DATE, '10:00:00', 'CARD-002', 2, 'Follow up consultation post cholesterol treatment', 'pending', NULL),
('a0733333-3333-3333-3333-333333333333', '99999999-9999-9999-9999-999999999993', 'd0c11111-1111-1111-1111-111111111111', CURRENT_DATE, '10:30:00', 'CARD-003', 3, 'Palpitations after intense exercise', 'confirmed', NULL),
('a0744444-4444-4444-4444-444444444444', '99999999-9999-9999-9999-999999999991', 'd0c22222-2222-2222-2222-222222222222', CURRENT_DATE - INTERVAL '7 days', '11:00:00', 'NEUR-014', 14, 'Frequent tension headaches and sleep disturbance', 'completed', 'Prescribed magnesium supplements and regular hydration. Follow-up in 1 month.'),
('a0755555-5555-5555-5555-555555555555', '99999999-9999-9999-9999-999999999991', 'd0c33333-3333-3333-3333-333333333333', CURRENT_DATE + INTERVAL '2 days', '09:00:00', 'ORTH-005', 5, 'Knee stiffness during morning jog', 'confirmed', NULL)
ON CONFLICT (id) DO NOTHING;

-- 6. INSERT SAMPLE REVIEWS
INSERT INTO reviews (id, patient_id, doctor_id, appointment_id, rating, comment) VALUES
('e0e11111-1111-1111-1111-111111111111', '99999999-9999-9999-9999-999999999991', 'd0c22222-2222-2222-2222-222222222222', 'a0744444-4444-4444-4444-444444444444', 5, 'Dr. Priya is exceptionally thorough and empathetic. She explained the cause of my tension headaches clearly and the recovery plan is working great!')
ON CONFLICT (id) DO NOTHING;

-- 7. INSERT NOTIFICATIONS
INSERT INTO notifications (user_id, title, message, type, link) VALUES
('99999999-9999-9999-9999-999999999991', 'Appointment Confirmed', 'Your appointment with Dr. Rahul Sharma has been confirmed for today at 09:30 AM. Token: CARD-001.', 'appointment', 'patient/queue-status.html'),
('11111111-1111-1111-1111-111111111111', 'New Appointment Request', 'Sarah Jenkins booked an appointment for today at 10:00 AM (Reason: Follow up cholesterol).', 'appointment', 'doctor/appointments.html')
ON CONFLICT DO NOTHING;
