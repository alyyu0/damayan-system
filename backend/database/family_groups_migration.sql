-- Migration: family_groups and family_group_members tables
-- Run this in the Supabase SQL editor.
--
-- Purpose:
--   A citizen (head_user_id) scans their family members' individual QR codes,
--   groups them under a single shared family QR code (family_qr_code_id).
--   During check-in, the site manager scans the shared QR once and all
--   members are checked in together.

CREATE TABLE IF NOT EXISTS public.family_groups (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  family_qr_code_id text UNIQUE NOT NULL,
  head_user_id uuid NOT NULL,
  family_name text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT family_groups_pkey PRIMARY KEY (id),
  CONSTRAINT family_groups_head_user_id_fkey FOREIGN KEY (head_user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.family_group_members (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  family_group_id uuid NOT NULL,
  citizen_qr_code_id text NOT NULL,
  member_user_id uuid,
  member_full_name text,
  relationship text,
  added_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT family_group_members_pkey PRIMARY KEY (id),
  CONSTRAINT family_group_members_family_group_id_fkey FOREIGN KEY (family_group_id) REFERENCES public.family_groups(id) ON DELETE CASCADE,
  CONSTRAINT family_group_members_member_user_id_fkey FOREIGN KEY (member_user_id) REFERENCES auth.users(id),
  CONSTRAINT family_group_members_unique_member UNIQUE (family_group_id, citizen_qr_code_id)
);

-- Enable row-level security (same pattern as other tables in the project)
ALTER TABLE public.family_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_group_members ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read/write their own family groups
CREATE POLICY "Citizens manage own family groups"
  ON public.family_groups
  FOR ALL
  USING (auth.uid() = head_user_id)
  WITH CHECK (auth.uid() = head_user_id);

-- Allow the service role (backend) full access
CREATE POLICY "Service role full access family_groups"
  ON public.family_groups
  FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role full access family_group_members"
  ON public.family_group_members
  FOR ALL
  USING (true)
  WITH CHECK (true);
