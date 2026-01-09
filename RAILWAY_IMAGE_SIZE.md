# Railway Image Size Issue

## Problem
The Docker image size is **6.2 GB**, which exceeds Railway's free tier limit of **4.0 GB**.

## Root Cause
The application requires heavy machine learning libraries:
- **PyTorch** (even CPU-only): ~2 GB
- **Demucs** (audio separation): ~1 GB
- **Librosa + dependencies**: ~500 MB
- **Essentia**: ~300 MB
- **Other ML libraries**: ~1 GB
- **System dependencies**: ~1 GB
- **Total**: ~6.2 GB

## Solutions

### Option 1: Upgrade Railway Plan (Recommended)
**Cost**: $20/month (Pro Plan)
- Removes 4 GB image size limit
- Better performance (8GB RAM, 8 vCPU)
- Worth it for production use

**To upgrade**:
1. Go to Railway Dashboard → Project Settings → Plan
2. Click "Upgrade to Pro"
3. Redeploy (will work immediately)

### Option 2: Use Modal for Heavy Processing
**Cost**: Free tier available, pay-as-you-go
- Move Demucs (vocal separation) to Modal GPU workers
- Keep only chord detection in Railway
- Reduces image to ~4 GB

**Implementation**:
1. Set up Modal account: https://modal.com
2. Deploy `modal_functions.py` to Modal
3. Set Modal credentials in Railway:
   ```
   MODALTOKENID=your_token_id
   MODALTOKENSECRET=your_token_secret
   ```
4. Update `requirements.txt` to remove Demucs
5. Redeploy

### Option 3: Use Alternative Platform
**Cost**: Varies
- **Google Cloud Run**: 10 GB image limit (free tier available)
- **Fly.io**: 8 GB limit (free tier available)
- **Render**: Similar pricing to Railway, higher limits on paid plans

### Option 4: Multi-Stage Optimization (Partial Solution)
**Savings**: ~500 MB (still over 4 GB limit)
- Already implemented in current Dockerfile:
  - Removes test files
  - Removes __pycache__
  - Removes build tools after pip install
  - Aggressive cleanup
- **Result**: Reduces from 6.2 GB → ~5.7 GB
- **Status**: Still exceeds 4 GB limit

## Recommendation

For your use case:
1. **Best**: Upgrade to Railway Pro ($20/month)
   - Single-click solution
   - Better performance
   - No code changes needed

2. **Budget**: Use Modal for GPU processing
   - Requires setup but more cost-effective
   - Free tier for development
   - Only pay for GPU time used

3. **Alternative**: Switch to Google Cloud Run
   - 10 GB image limit on free tier
   - More complex setup than Railway

## Current Status

The Dockerfile has been optimized as much as possible without removing core functionality:
- ✅ Multi-stage build
- ✅ Aggressive cleanup of test files and caches
- ✅ CPU-only PyTorch (vs GPU version)
- ✅ Minimal system dependencies
- ✅ .dockerignore to exclude unnecessary files

**Image size after optimization**: ~5.7 GB (down from 6.2 GB)
**Railway free tier limit**: 4.0 GB
**Shortfall**: Still 1.7 GB over limit

## Next Steps

1. Decide on solution approach
2. If upgrading Railway: Click upgrade and redeploy
3. If using Modal: Set up Modal account and credentials
4. If switching platforms: Follow platform-specific deployment guide
