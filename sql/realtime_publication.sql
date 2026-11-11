-- ============================================================================
-- CarePulse Hospital Management System
-- Unified Supabase Realtime Postgres CDC Publication Migration (Idempotent)
-- ============================================================================
-- Run this script once in the Supabase Dashboard -> SQL Editor to enable
-- instant multi-device WebSocket Postgres Changes across all portals.
-- ============================================================================

DO $$
DECLARE
  tbl TEXT;
  realtime_tables TEXT[] := ARRAY[
    'appointments',
    'notifications',
    'chat_messages',
    'doctors',
    'doctor_availability',
    'doctor_leaves',
    'waiting_list',
    'reviews',
    'departments',
    'opd_rooms',
    'profiles',
    'audit_logs'
  ];
BEGIN
  -- Ensure supabase_realtime publication exists
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;

  FOREACH tbl IN ARRAY realtime_tables LOOP
    IF EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = tbl
    ) THEN
      BEGIN
        EXECUTE format('ALTER TABLE public.%I REPLICA IDENTITY FULL', tbl);
      EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Skipped REPLICA IDENTITY on %: %', tbl, SQLERRM;
      END;

      BEGIN
        EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', tbl);
        RAISE NOTICE 'Added table public.% to supabase_realtime publication', tbl;
      EXCEPTION
        WHEN duplicate_object THEN
          RAISE NOTICE 'Table public.% is already in supabase_realtime', tbl;
        WHEN OTHERS THEN
          RAISE NOTICE 'Could not add table public.% to supabase_realtime: %', tbl, SQLERRM;
      END;
    END IF;
  END LOOP;
END $$;

