---
title: Vocal Separator
emoji: 🎵
colorFrom: indigo
colorTo: purple
sdk: docker
pinned: false
license: mit
---

# Vocal Separator & Music Analysis

A modern audio processing tool for separating vocals, detecting chords, and fetching lyrics.

## Features

- **Vocal Separation** - Extract vocals and accompaniment from any audio file
- **Chord Detection** - Detect chord progressions with timestamps
- **Lyrics Search** - Find lyrics for any song
- **YouTube Integration** - Search and analyze YouTube videos directly
- **Combined Analysis** - View lyrics with chord annotations

## Tech Stack

- **Frontend**: React + Vite + TailwindCSS
- **Backend**: FastAPI + Python
- **Audio Processing**: Librosa, Essentia, PyTorch
- **GPU Processing**: Modal (for vocal separation)

## Configuration (YouTube Features)

### YouTube Search (Requires API Key)

To enable YouTube search, you need to set up a YouTube API key:

1. Get your API key from [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Enable the YouTube Data API v3 for your project
3. In HuggingFace Spaces settings, add the environment variable:
   ```
   YOUTUBE_API_KEY=your_api_key_here
   ```

### ⚠️ YouTube Download Limitations

**Important**: HuggingFace Spaces may have network restrictions that block direct YouTube downloads (DNS resolution errors). If you encounter errors when analyzing YouTube videos:

- **Workaround**: Upload your audio file directly using the file upload feature
- **Alternative**: Use the app locally where YouTube downloads work without restrictions

The YouTube search functionality works fine, but video download/analysis may fail due to platform networking policies.

## Modal Configuration (Required for Vocal Separation)

**Important**: Vocal separation requires Modal GPU processing. This is configured to work with Railway and other platforms.

### Setup Modal

1. Create a Modal account at [modal.com](https://modal.com)
2. Get your Modal credentials from the dashboard
3. Deploy the Modal functions:
   ```bash
   modal deploy modal_functions.py
   ```
4. Set environment variables in your deployment platform (Railway/Render/etc):
   ```
   MODALTOKENID=your_modal_token_id
   MODALTOKENSECRET=your_modal_token_secret
   ```

**Why Modal?**
- Vocal separation uses Demucs, which requires significant compute resources (~6GB+ Docker image)
- Modal provides GPU-accelerated processing on-demand
- Reduces deployment image size from 6.2GB to ~3.8GB (fits Railway free tier 4GB limit)
- Only pay for GPU time when actually separating vocals

**Features that use Modal:**
- ✅ Vocal separation (extract vocals/accompaniment)
- ✅ Piano extraction
- ❌ Chord detection (runs locally, no Modal needed)
- ❌ YouTube search (runs locally, no Modal needed)

# Updated Jan 9 2026: Modal-based vocal separation for Railway deployment (v2.4)
# Updated Jan 3 2026: YouTube Integration - Search and analyze YouTube videos directly (v2.3)
# Updated Jan 2 23:30:00 IST 2026: Cleaned UI - removed advanced settings panel and timeline table (v2.2)
