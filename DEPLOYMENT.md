# Deployment Guide

## Architecture Overview

This vocal separator app uses a modern, scalable architecture:

- **Frontend**: Streamlit (deployed on HuggingFace Spaces)
- **Database**: Supabase (PostgreSQL + Auth)
- **GPU Processing**: Modal.com (for heavy Demucs processing)

## Setup Instructions

### 1. Supabase Setup

1. Go to [supabase.com](https://supabase.com) and create a free account
2. Create a new project
3. Go to Settings > API and copy:
   - `Project URL` (SUPABASE_URL)
   - `anon public` key (SUPABASE_ANON_KEY)

#### Database Schema Setup

Run these SQL commands in your Supabase SQL editor:

```sql
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
```

### 2. Modal.com Setup

1. Go to [modal.com](https://modal.com) and create an account
2. Install Modal CLI: `pip install modal`
3. Authenticate: `modal token new`
4. Deploy your functions: `modal deploy backend/modal_gpu.py`

### 3. HuggingFace Spaces Deployment

1. Go to [huggingface.co/spaces](https://huggingface.co/spaces)
2. Create a new Space with:
   - **SDK**: Streamlit
   - **Hardware**: CPU Basic (free)

3. In your Space settings, go to **Variables and secrets** and add:
   ```
   SUPABASE_URL=your_supabase_project_url
   SUPABASE_ANON_KEY=your_supabase_anon_key
   MODAL_TOKEN_ID=your_modal_token_id
   MODAL_TOKEN_SECRET=your_modal_token_secret
   ```

4. Push your code to the Space repository

### 4. Environment Variables

Create a `.env` file for local development:

```env
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
MODAL_TOKEN_ID=your_modal_token_id
MODAL_TOKEN_SECRET=your_modal_token_secret
```

## Key Benefits

### Why This Architecture?

1. **Supabase (Database + Auth)**
   - ✅ Real PostgreSQL database (not just text files)
   - ✅ Built-in authentication (Google login, forgot password, etc.)
   - ✅ Row-level security for data protection
   - ✅ Real-time subscriptions
   - ✅ Free tier: 2 free projects, 500MB database

2. **HuggingFace Spaces (Frontend)**
   - ✅ Free CPU hosting for Streamlit
   - ✅ Automatic deployments from git
   - ✅ Built-in secrets management
   - ✅ Public shareable URLs

3. **Modal.com (GPU Processing)**
   - ✅ $30/month free credits (enough for hobby projects)
   - ✅ True GPU acceleration (30-second processing vs 5-10 minutes)
   - ✅ Auto-scaling (only pay when processing)
   - ✅ A10G GPUs for heavy audio processing

### Cost Breakdown

- **Supabase**: $0/month (free tier)
- **HuggingFace**: $0/month (free CPU hosting)
- **Modal**: $0-30/month (free credits, only charged on usage)

**Total**: $0/month for typical hobby usage!

## Local Development

```bash
# Install dependencies
pip install -r requirements.txt

# Set up environment variables
cp .env.example .env
# Edit .env with your credentials

# Run locally
streamlit run streamlit_app.py
```

## Production Deployment

Simply push to your HuggingFace Space repository:

```bash
git add .
git commit -m "Deploy new version"
git push origin main
```

The Space will automatically rebuild and deploy.

## Monitoring

- **Supabase**: Built-in analytics dashboard
- **Modal**: Usage dashboard shows GPU time and costs
- **HuggingFace**: Basic metrics in Space settings