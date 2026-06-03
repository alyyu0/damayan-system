-- Migration: add verification_job_id to user_profiles
-- Run this once in Supabase SQL Editor before starting the backend.

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS verification_job_id TEXT;
