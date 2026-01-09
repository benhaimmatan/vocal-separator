# Railway Deployment Guide

## Prerequisites

1. **Railway Account**: Sign up at [railway.app](https://railway.app)
2. **Railway CLI**: Install the Railway CLI
3. **GitHub Repository**: Your code should be in a GitHub repo (already done ✅)
4. **Environment Variables**: Have your API keys ready

## Quick Start (5 Minutes)

### Option 1: Deploy via Railway Dashboard (Easiest)

1. **Go to Railway**: https://railway.app
2. **Click "New Project"**
3. **Select "Deploy from GitHub repo"**
4. **Connect your GitHub account** and select `vocal-separator-hf` repository
5. **Railway auto-detects your Dockerfile** and starts building
6. **Add Environment Variables** (Settings → Variables):
   ```
   YOUTUBE_API_KEY=your_key_here
   SUPABASE_URL=your_url (optional)
   SUPABASE_KEY=your_key (optional)
   MODALTOKENID=your_token (optional)
   MODALTOKENSECRET=your_secret (optional)
   ```
7. **Generate Domain** (Settings → Networking → Generate Domain)
8. **Done!** Your app will be live at `your-app.railway.app`

### Option 2: Deploy via CLI (Fast)

```bash
# 1. Install Railway CLI
npm i -g @railway/cli

# 2. Login to Railway
railway login

# 3. Navigate to your project
cd /Users/matanbenhaim/vocal-separator-hf

# 4. Initialize Railway project
railway init

# 5. Link to GitHub (optional, for auto-deploys)
railway link

# 6. Set environment variables
railway variables set YOUTUBE_API_KEY=your_key_here

# Optional variables:
railway variables set SUPABASE_URL=your_url
railway variables set SUPABASE_KEY=your_key
railway variables set MODALTOKENID=your_token
railway variables set MODALTOKENSECRET=your_secret

# 7. Deploy
railway up

# 8. Get your URL
railway domain
```

## Environment Variables Setup

### Required:
- `YOUTUBE_API_KEY` - Get from [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
  1. Create a new project
  2. Enable YouTube Data API v3
  3. Create credentials (API Key)
  4. Copy the API key

### Optional:
- `SUPABASE_URL` - Your Supabase project URL (for user auth)
- `SUPABASE_KEY` - Your Supabase anon key (for user auth)
- `MODALTOKENID` - Modal token ID (for GPU acceleration)
- `MODALTOKENSECRET` - Modal token secret (for GPU acceleration)

## Auto-Deploy on Git Push

Railway automatically deploys when you push to your GitHub repository:

```bash
git add .
git commit -m "Update app"
git push origin main
# Railway automatically builds and deploys!
```

## Monitoring & Logs

1. **View Logs**: Railway Dashboard → Your Project → Deployments → View Logs
2. **Health Check**: Your app has a health endpoint at `/api/health`
3. **Metrics**: Railway Dashboard shows CPU, Memory, Network usage

## Pricing

- **Free Trial**: $5 credit (enough for testing)
- **Hobby Plan**: $5/month (recommended)
  - 512MB RAM, 1 vCPU
  - Enough for small-medium traffic
- **Pro Plan**: $20/month
  - 8GB RAM, 8 vCPU
  - For production with high traffic

### Estimated Costs:
- **Light usage** (< 100 users/day): ~$5-10/month
- **Medium usage** (100-1000 users/day): ~$20-40/month
- **Heavy usage** (> 1000 users/day): ~$50+/month

## Testing Your Deployment

Once deployed, test these endpoints:

1. **Health Check**: `https://your-app.railway.app/api/health`
   - Should return status and configuration info

2. **YouTube Test**: `https://your-app.railway.app/api/youtube/test`
   - Tests YouTube download (should work on Railway!)

3. **Main App**: `https://your-app.railway.app`
   - Your full app UI

## YouTube Integration Status

✅ **YouTube Search** - Works perfectly (uses Google API)
✅ **YouTube Download** - Works on Railway (no DNS restrictions!)
✅ **YouTube Analysis** - Full functionality restored

## Troubleshooting

### Build Fails
- Check Railway logs for errors
- Ensure Dockerfile is valid
- Check that all dependencies are in requirements.txt

### App Won't Start
- Check environment variables are set correctly
- View logs: `railway logs`
- Check health endpoint: `/api/health`

### Port Issues
- Railway automatically detects port 7860 from Dockerfile
- No need to set PORT variable

### Domain Issues
- Generate a domain in Railway Dashboard → Settings → Networking
- Custom domains available on paid plans

## Migration Checklist

- [ ] Create Railway account
- [ ] Connect GitHub repository
- [ ] Set YOUTUBE_API_KEY environment variable
- [ ] Set optional environment variables (Supabase, Modal)
- [ ] Deploy via Dashboard or CLI
- [ ] Generate domain
- [ ] Test /api/health endpoint
- [ ] Test /api/youtube/test endpoint
- [ ] Test full app functionality
- [ ] Update DNS (if using custom domain)
- [ ] Monitor logs for first 24 hours

## Support

- **Railway Docs**: https://docs.railway.app
- **Railway Discord**: https://discord.gg/railway
- **Your Health Endpoint**: `/api/health` - Shows system status

## Next Steps After Deployment

1. **Test YouTube features** - Verify downloads work
2. **Monitor performance** - Check Railway metrics
3. **Set up custom domain** (optional)
4. **Configure auto-scaling** (Pro plan)
5. **Add monitoring** (Sentry, LogRocket, etc.)

---

**Note**: Railway has no DNS restrictions, so your YouTube download functionality will work perfectly! 🎉
