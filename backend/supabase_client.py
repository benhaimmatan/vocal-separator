import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

def get_supabase_client() -> Client:
    """Initialize and return Supabase client"""
    url = os.getenv("SUPABASEURL")
    key = os.getenv("SUPABASEANONKEY")
    
    if not url or not key:
        raise ValueError("Missing Supabase credentials. Set SUPABASEURL and SUPABASEANONKEY environment variables.")
    
    return create_client(url, key)

def init_database_schema(client: Client):
    """Initialize database tables if they don't exist"""
    try:
        # Create users table for additional user metadata
        client.table("user_profiles").select("*").limit(1).execute()
    except Exception:
        # Table doesn't exist, create schema
        print("Setting up database schema...")
        # Note: Tables should be created via Supabase dashboard or migrations
        # This is just a placeholder for schema initialization
        pass

# Database schema (create these tables in Supabase dashboard):
"""
-- user_profiles table (extends auth.users)
CREATE TABLE user_profiles (
    id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
    email TEXT,
    full_name TEXT,
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view and edit their own profile
CREATE POLICY "Users can view own profile" ON user_profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON user_profiles
    FOR UPDATE USING (auth.uid() = id);

-- processing_jobs table
CREATE TABLE processing_jobs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    job_type TEXT NOT NULL, -- 'vocal_separation', 'chord_detection', 'lyrics'
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
    input_file_url TEXT,
    output_files JSONB,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE processing_jobs ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own jobs
CREATE POLICY "Users can view own jobs" ON processing_jobs
    FOR ALL USING (auth.uid() = user_id);

-- Create indexes
CREATE INDEX idx_processing_jobs_user_id ON processing_jobs(user_id);
CREATE INDEX idx_processing_jobs_status ON processing_jobs(status);
CREATE INDEX idx_processing_jobs_created_at ON processing_jobs(created_at);
"""