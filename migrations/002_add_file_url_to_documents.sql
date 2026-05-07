-- Migration: Add file_url column to documents table
-- This migration adds support for storing document file attachments

-- Add file_url column to documents table
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS file_url VARCHAR;

-- Create documents storage bucket if it doesn't exist
-- NOTE: This must be done manually in Supabase dashboard:
-- 1. Go to Storage > Buckets
-- 2. Click "New Bucket"
-- 3. Name it "documents"
-- 4. Make it Private (not public)
-- 5. Click Create

-- After creating the bucket, set up the storage policy:
-- Go to Storage > Policies and create this policy:
-- POLICY NAME: Allow authenticated users to upload documents
-- CONDITION: bucket_id = 'documents' and auth.role() = 'authenticated'
-- OPERATIONS: SELECT, INSERT, UPDATE, DELETE
