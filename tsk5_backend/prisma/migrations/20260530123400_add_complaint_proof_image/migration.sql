-- Add proofImage column to Complaint model for admin-uploaded proof screenshots
ALTER TABLE "Complaint" ADD COLUMN IF NOT EXISTS "proofImage" VARCHAR(512);
