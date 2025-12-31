"""
Supabase client configuration and database utilities for vocal separator app.
"""

import os
from typing import Optional, Dict, Any, List
from datetime import datetime, timezone
import uuid
from supabase import create_client, Client
from postgrest.exceptions import APIError
from dotenv import load_dotenv

load_dotenv()

class SupabaseClient:
    """Supabase client for database operations"""
    
    def __init__(self):
        # Get Supabase credentials from environment
        self.supabase_url = os.getenv("SUPABASEURL")
        self.supabase_key = os.getenv("SUPABASEKEY") or os.getenv("SUPABASEANONKEY")
        
        if not self.supabase_url or not self.supabase_key:
            raise ValueError("Missing Supabase credentials. Set SUPABASEURL and SUPABASEKEY environment variables.")
        
        # Create Supabase client
        self.supabase: Client = create_client(self.supabase_url, self.supabase_key)
    
    # User Management
    def create_user_profile(self, user_id: str, email: str, display_name: Optional[str] = None) -> Dict[str, Any]:
        """Create or update user profile"""
        try:
            profile_data = {
                "id": user_id,  # Use 'id' to match auth.users reference
                "email": email,
                "full_name": display_name or email.split("@")[0],
                "created_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
            
            result = self.supabase.table("user_profiles").upsert(profile_data).execute()
            return {"success": True, "profile": result.data[0] if result.data else None}
            
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    def get_user_profile(self, user_id: str) -> Dict[str, Any]:
        """Get user profile by ID"""
        try:
            result = self.supabase.table("user_profiles").select("*").eq("id", user_id).execute()
            return {"success": True, "profile": result.data[0] if result.data else None}
            
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    # Job Management
    def create_processing_job(
        self,
        user_id: str,
        job_type: str,
        original_filename: str,
        file_size: Optional[int] = None,
        job_parameters: Optional[Dict] = None
    ) -> Dict[str, Any]:
        """Create a new processing job"""
        try:
            job_data = {
                "user_id": user_id,
                "job_type": job_type,  # 'vocal_separation', 'chord_detection', 'lyrics'
                "status": "pending",  # 'pending', 'processing', 'completed', 'failed'
                "metadata": {
                    "original_filename": original_filename,
                    "file_size": file_size,
                    "parameters": job_parameters or {}
                },
                "created_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
            
            result = self.supabase.table("processing_jobs").insert(job_data).execute()
            return {"success": True, "job": result.data[0] if result.data else None}
            
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    def update_job_status(
        self,
        job_id: str,
        status: str,
        result_data: Optional[Dict] = None,
        error_message: Optional[str] = None
    ) -> Dict[str, Any]:
        """Update job status and results"""
        try:
            update_data = {
                "status": status,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
            
            if result_data:
                update_data["output_files"] = result_data
            
            if error_message:
                # Add error to metadata
                update_data["metadata"] = {
                    "error_message": error_message
                }
            
            result = self.supabase.table("processing_jobs").update(update_data).eq("id", job_id).execute()
            return {"success": True, "job": result.data[0] if result.data else None}
            
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    def get_job(self, job_id: str) -> Dict[str, Any]:
        """Get job by ID"""
        try:
            result = self.supabase.table("processing_jobs").select("*").eq("id", job_id).execute()
            return {"success": True, "job": result.data[0] if result.data else None}
            
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    def get_user_jobs(
        self,
        user_id: str,
        limit: int = 50,
        job_type: Optional[str] = None
    ) -> Dict[str, Any]:
        """Get jobs for a user"""
        try:
            query = self.supabase.table("processing_jobs").select("*").eq("user_id", user_id)
            
            if job_type:
                query = query.eq("job_type", job_type)
            
            result = query.order("created_at", desc=True).limit(limit).execute()
            return {"success": True, "jobs": result.data or []}
            
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    # Authentication helpers
    def authenticate_user(self, email: str, password: str) -> Dict[str, Any]:
        """Authenticate user with email/password"""
        try:
            auth_response = self.supabase.auth.sign_in_with_password({
                "email": email,
                "password": password
            })
            
            if auth_response.user:
                # Ensure user profile exists
                profile_result = self.create_user_profile(
                    auth_response.user.id,
                    auth_response.user.email,
                    auth_response.user.user_metadata.get("display_name")
                )
                
                return {
                    "success": True,
                    "user": auth_response.user,
                    "session": auth_response.session,
                    "profile": profile_result.get("profile")
                }
            else:
                return {"success": False, "error": "Authentication failed"}
                
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    def register_user(self, email: str, password: str, display_name: Optional[str] = None) -> Dict[str, Any]:
        """Register new user"""
        try:
            auth_response = self.supabase.auth.sign_up({
                "email": email,
                "password": password,
                "options": {
                    "data": {
                        "display_name": display_name or email.split("@")[0]
                    }
                }
            })
            
            if auth_response.user:
                # Create user profile
                profile_result = self.create_user_profile(
                    auth_response.user.id,
                    auth_response.user.email,
                    display_name
                )
                
                return {
                    "success": True,
                    "user": auth_response.user,
                    "session": auth_response.session,
                    "profile": profile_result.get("profile")
                }
            else:
                return {"success": False, "error": "Registration failed"}
                
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    def verify_token(self, token: str) -> Dict[str, Any]:
        """Verify JWT token and get user"""
        try:
            user = self.supabase.auth.get_user(token)
            if user:
                return {"success": True, "user": user.user}
            else:
                return {"success": False, "error": "Invalid token"}
                
        except Exception as e:
            return {"success": False, "error": str(e)}

# Global client instance
supabase_client = None

def get_supabase_client() -> SupabaseClient:
    """Get or create Supabase client instance"""
    global supabase_client
    if supabase_client is None:
        supabase_client = SupabaseClient()
    return supabase_client

def init_database_schema(client: SupabaseClient):
    """Initialize database tables if they don't exist"""
    try:
        # Test if tables exist
        client.supabase.table("user_profiles").select("*").limit(1).execute()
        client.supabase.table("processing_jobs").select("*").limit(1).execute()
        print("Database schema verified")
    except Exception as e:
        print(f"Database schema setup required: {e}")
        print("Please create the following tables in your Supabase dashboard:")
        print(DATABASE_SCHEMA)

# Database schema (create these tables in Supabase dashboard)
DATABASE_SCHEMA = """
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