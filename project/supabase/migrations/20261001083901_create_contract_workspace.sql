/*
# Create contract workspace data

1. New Tables
- `contract_documents`: single-user document library entries with filename, type, size, processing status, extracted text, and timestamps.
- `contract_messages`: saved chat questions and streamed answers, optionally linked to several documents, with verified citation metadata.

2. Security
- Row level security is enabled on both tables.
- This assignment intentionally has no sign-in system and assumes one shared browser user, so anon and authenticated roles receive CRUD access.

3. Important Notes
- Extracted text is stored so document chat and citation navigation survive reloads.
- Citation records are JSONB because one answer can contain several verified passages from different documents.
- No file bytes are stored in the database; the app stores the processed text and document metadata needed for the workspace.
*/

CREATE TABLE IF NOT EXISTS public.contract_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  file_type text NOT NULL,
  file_size bigint NOT NULL DEFAULT 0,
  extracted_text text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'ready', 'error')),
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.contract_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question text NOT NULL,
  answer text NOT NULL DEFAULT '',
  document_ids uuid[] NOT NULL DEFAULT '{}',
  citations jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'complete' CHECK (status IN ('streaming', 'complete', 'error')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS contract_documents_created_at_idx ON public.contract_documents (created_at DESC);
CREATE INDEX IF NOT EXISTS contract_messages_created_at_idx ON public.contract_messages (created_at ASC);

ALTER TABLE public.contract_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_read_contract_documents" ON public.contract_documents;
CREATE POLICY "anon_read_contract_documents" ON public.contract_documents FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_contract_documents" ON public.contract_documents;
CREATE POLICY "anon_insert_contract_documents" ON public.contract_documents FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_contract_documents" ON public.contract_documents;
CREATE POLICY "anon_update_contract_documents" ON public.contract_documents FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_contract_documents" ON public.contract_documents;
CREATE POLICY "anon_delete_contract_documents" ON public.contract_documents FOR DELETE TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_read_contract_messages" ON public.contract_messages;
CREATE POLICY "anon_read_contract_messages" ON public.contract_messages FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_contract_messages" ON public.contract_messages;
CREATE POLICY "anon_insert_contract_messages" ON public.contract_messages FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_contract_messages" ON public.contract_messages;
CREATE POLICY "anon_update_contract_messages" ON public.contract_messages FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_contract_messages" ON public.contract_messages;
CREATE POLICY "anon_delete_contract_messages" ON public.contract_messages FOR DELETE TO anon, authenticated USING (true);
