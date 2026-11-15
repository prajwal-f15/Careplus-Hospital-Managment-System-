-- ==============================================================================
-- CAREPULSE HOSPITAL MANAGEMENT SYSTEM
-- Fix: Allow 'hospital' role in public.profiles and handle_new_user trigger
-- Run this in Supabase SQL Editor if needed
-- ==============================================================================

-- 1. Update profiles_role_check constraint to include 'hospital'
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check CHECK (role IN ('patient', 'doctor', 'admin', 'hospital'));

-- 2. Update handle_new_user trigger function to safely map role
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
    CASE 
      WHEN NEW.raw_user_meta_data->>'role' IN ('doctor', 'admin', 'hospital') THEN NEW.raw_user_meta_data->>'role'
      ELSE 'patient'
    END,
    COALESCE(NEW.raw_user_meta_data->>'gender', 'Other'),
    COALESCE(NEW.raw_user_meta_data->>'address', '')
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    email = EXCLUDED.email;

  RETURN NEW;
END;
$$;

