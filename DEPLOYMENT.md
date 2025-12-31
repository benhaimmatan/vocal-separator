# 🚀 Deployment Guide - Modern Vocal Separator

This guide walks you through deploying the complete modern architecture with Modal GPU processing and Supabase authentication.

## 📋 Prerequisites

1. **Modal Account**: Sign up at [modal.com](https://modal.com)
2. **Supabase Project**: Create project at [supabase.com](https://supabase.com)
3. **HuggingFace Spaces**: Your app repository

## 🔧 Step 1: Set Up Modal GPU Functions

### Install Modal CLI
```bash
pip install modal
```

### Get Modal Token
```bash
modal token new
```

### Deploy Functions
```bash
python deploy_modal.py
```

### Get Modal Credentials
After deployment, get your credentials:
- `MODAL_TOKEN_ID`: From your Modal dashboard
- `MODAL_TOKEN_SECRET`: From your Modal dashboard

## 🗄️ Step 2: Set Up Supabase Database

### 1. Create Supabase Project
- Go to [supabase.com](https://supabase.com)
- Create new project
- Wait for setup to complete

### 2. Run Database Setup
- Open Supabase SQL Editor
- Copy contents of `supabase_setup.sql`
- Execute the SQL commands

### 3. Get Supabase Credentials
From your Supabase project settings:
- `SUPABASEURL`: Your project URL
- `SUPABASEKEY`: Your anon/public key (not service key)

### 4. Configure Authentication
In Supabase Dashboard:
- Go to Authentication > Settings
- Configure any additional auth providers if needed
- Set JWT expiry (recommended: 7 days)

## ⚙️ Step 3: Configure HuggingFace Spaces

### Set Environment Variables
In your HuggingFace Spaces settings, add:

```env
# Supabase Configuration
SUPABASEURL=https://your-project.supabase.co
SUPABASEKEY=your-anon-key

# Modal Configuration (optional - enables GPU processing)
MODAL_TOKEN_ID=your-modal-token-id
MODAL_TOKEN_SECRET=your-modal-token-secret
```

### Restart Your Space
- Click "Restart this Space" to apply environment variables
- Monitor logs for successful startup

## ✅ Step 4: Verify Deployment

### Check Health Endpoint
Visit: `https://your-space-url/api/health`

Expected response:
```json
{
  "status": "healthy",
  "modal_enabled": true,
  "supabase_enabled": true
}
```

### Test Features
1. **Authentication**: Try registering a new user
2. **GPU Processing**: Upload audio file for separation
3. **Job History**: Check processing jobs in user menu

## 🎯 Architecture Overview

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   React Frontend │    │  FastAPI Backend │    │   Modal GPU     │
│                 │    │                 │    │                 │
│ • Authentication│────│ • Auth endpoints│────│ • Demucs (30s)  │
│ • Job History   │    │ • Job tracking  │    │ • Chord detect  │
│ • File Upload   │    │ • Orchestration │    │ • Fallback CPU  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                                │
                       ┌─────────────────┐
                       │   Supabase DB   │
                       │                 │
                       │ • User profiles │
                       │ • Job history   │
                       │ • Authentication│
                       └─────────────────┘
```

## 🐛 Troubleshooting

### Modal Not Working
- Check `MODAL_TOKEN_ID` and `MODAL_TOKEN_SECRET` are set
- Verify Modal functions deployed successfully
- App falls back to CPU processing if Modal unavailable

### Supabase Not Working
- Verify `SUPABASEURL` and `SUPABASEKEY` are correct
- Check database tables were created successfully
- Review Supabase logs for errors

### Authentication Issues
- Ensure Supabase RLS policies are enabled
- Check JWT token expiry settings
- Verify user registration is enabled in Supabase

### General Issues
- Check HuggingFace Spaces logs
- Verify all environment variables are set
- Test `/api/health` endpoint

## 📊 Performance Expectations

- **GPU Processing**: ~30 seconds for vocal separation
- **CPU Fallback**: 5-10 minutes for vocal separation
- **User Registration**: Instant
- **Job History**: Real-time updates

## 🔒 Security Features

- ✅ JWT-based authentication
- ✅ Row Level Security (RLS)
- ✅ Secure token storage
- ✅ Input validation
- ✅ CORS protection

## 🎉 Success!

Your modern vocal separator app is now deployed with:
- ⚡ GPU-accelerated processing
- 🔐 User authentication
- 📊 Job tracking
- 🎨 Professional UI
- 🚀 Scalable architecture

Enjoy your 30-second vocal separations! 🎵