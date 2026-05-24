-- Safe schema extension: add coordinate and resolved address fields
-- to incident_reports and drm_sos tables.
-- All statements are idempotent (IF NOT EXISTS / IF NOT EXISTS index).
-- Run directly in the Supabase SQL Editor or via migration tooling.

ALTER TABLE incident_reports
  ADD COLUMN IF NOT EXISTS latitude        NUMERIC(10, 7),
  ADD COLUMN IF NOT EXISTS longitude       NUMERIC(10, 7),
  ADD COLUMN IF NOT EXISTS resolved_address TEXT;

ALTER TABLE drm_sos
  ADD COLUMN IF NOT EXISTS latitude        NUMERIC(10, 7),
  ADD COLUMN IF NOT EXISTS longitude       NUMERIC(10, 7),
  ADD COLUMN IF NOT EXISTS resolved_address TEXT;

-- Performance indexes for geographic coordinate boundary queries
CREATE INDEX IF NOT EXISTS idx_incident_reports_coords
  ON incident_reports (latitude, longitude);

CREATE INDEX IF NOT EXISTS idx_drm_sos_coords
  ON drm_sos (latitude, longitude);
