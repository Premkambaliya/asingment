/*
# Add chat sessions

1. New Tables
- `contract_sessions`: Tracks distinct chat conversation threads.

2. Table Modifications
- Add `session_id` to `contract_messages` to link messages to their respective sessions.

3. Security
- Enable RLS on `contract_sessions` with anon/authenticated CRUD access.
*/

CREATE TABLE IF NOT EXISTS public.contract_sessions (
  id text PRIMARY KEY,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Add session_id to existing contract_messages
ALTER TABLE public.contract_messages 
ADD COLUMN IF NOT EXISTS session_id text DEFAULT 'default';

CREATE INDEX IF NOT EXISTS contract_sessions_created_at_idx ON public.contract_sessions (created_at ASC);
CREATE INDEX IF NOT EXISTS contract_messages_session_id_idx ON public.contract_messages (session_id);

ALTER TABLE public.contract_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_read_contract_sessions" ON public.contract_sessions;
CREATE POLICY "anon_read_contract_sessions" ON public.contract_sessions FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_contract_sessions" ON public.contract_sessions;
CREATE POLICY "anon_insert_contract_sessions" ON public.contract_sessions FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_contract_sessions" ON public.contract_sessions;
CREATE POLICY "anon_update_contract_sessions" ON public.contract_sessions FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_contract_sessions" ON public.contract_sessions;
CREATE POLICY "anon_delete_contract_sessions" ON public.contract_sessions FOR DELETE TO anon, authenticated USING (true);
