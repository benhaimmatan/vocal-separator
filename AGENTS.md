# AGENTS.md

## Project Overview
Vocal Separator - A web application for audio separation, chord detection, and lyrics analysis. Built with FastAPI (Python backend) and React (frontend).

## Setup Commands

### Initial Setup
```bash
# Clone the repository
git clone https://github.com/benhaimmatan/vocal-separator.git
cd vocal-separator

# Install Git LFS (required for model files)
git lfs install
git lfs pull

# Set up Python environment (backend)
pip install -r requirements.txt

# Set up frontend dependencies
cd frontend
npm install
cd ..

# Configure environment variables
cp .env.example .env
# Edit .env and add your API keys:
# - MODAL_TOKEN_ID and MODAL_TOKEN_SECRET (for GPU processing)
# - YOUTUBE_API_KEY (for YouTube integration)
# - SUPABASE credentials (for database)
```

### Development Commands

#### Frontend
```bash
cd frontend
npm run dev          # Start Vite dev server (http://localhost:5173)
npm run build        # Build for production
npm run preview      # Preview production build
```

#### Backend
```bash
# From project root
cd backend
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000

# Or run from project root
uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
```

#### Full Stack (Docker)
```bash
docker build -t vocal-separator .
docker run -p 8080:8080 --env-file .env vocal-separator
```

### Testing
```bash
# Test backend chord detection API
python test_chord_api.py

# Test specific backend components
cd backend
python test_chord_detection.py
python test_simple_chord.py
```

### Deployment
```bash
# Railway deployment (automatic on git push to main)
git push origin main

# Manual Railway CLI
railway up

# Check Railway logs
railway logs
```

## Code Style

### Python (Backend)
- Follow PEP 8 style guide
- Use type hints where possible
- Docstrings for classes and functions
- Import order: standard library, third-party, local imports
- Use f-strings for string formatting
- Prefer Path objects over string paths

**Example:**
```python
from pathlib import Path
from typing import Optional, List, Dict

def detect_chords(
    audio_path: Path,
    simplicity_preference: float = 0.5,
    bpm_override: Optional[float] = None
) -> List[Dict]:
    """Detect chords from audio file.

    Args:
        audio_path: Path to audio file
        simplicity_preference: 0-1, higher = simpler chords
        bpm_override: Optional manual BPM override

    Returns:
        List of chord dictionaries with time, chord, confidence
    """
    pass
```

### JavaScript/React (Frontend)
- Use functional components with hooks
- Prefer const over let, avoid var
- Use arrow functions
- Template literals for strings
- Destructuring where appropriate
- Single quotes for strings
- No semicolons (enforced by prettier if configured)

**Example:**
```javascript
const ChordAnalyzer = ({ audioFile, chordData, detectedBPM }) => {
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)

  const handlePlayPause = async () => {
    if (isPlaying) {
      audioRef.current.pause()
      setIsPlaying(false)
    } else {
      await audioRef.current.play()
      setIsPlaying(true)
    }
  }

  return (
    <div className="chord-analyzer">
      {/* Component JSX */}
    </div>
  )
}
```

### Git Commit Messages
- Use conventional commits format
- Prefix with type: feat, fix, docs, style, refactor, test, chore
- Keep first line under 72 characters
- Use present tense: "Add feature" not "Added feature"

**Examples:**
```
feat: Add BPM detection to chord analyzer
fix: Handle empty bpm_override in API requests
docs: Update AGENTS.md with setup instructions
refactor: Simplify chord detection error handling
```

## Architecture

### Backend Structure
```
backend/
├── main.py                          # FastAPI app entry point
├── processor.py                     # Audio processing
├── chord_detector_advanced.py       # Chord detection (BTC model)
├── enhanced_rhythm_analysis.py      # BPM/beat detection
├── lyrics_utils.py                  # Lyrics fetching
├── youtube_utils.py                 # YouTube integration
├── supabase_client.py              # Database client
└── BTC-ISMIR19/                    # Chord detection model
```

### Frontend Structure
```
frontend/
├── src/
│   ├── App.jsx                     # Main app component
│   ├── components/
│   │   ├── ChordAnalyzer.jsx       # Chord analysis UI
│   │   ├── ChordProgressionBar.jsx # Chord timeline
│   │   ├── PianoChordDiagram.jsx   # Piano visualization
│   │   └── MovingWindowChordVisualizer.tsx
│   └── types/
│       └── chord.ts                # TypeScript types
├── public/                         # Static assets
└── vite.config.js                  # Vite configuration
```

## Key Technologies

### Backend
- **FastAPI** - Web framework
- **PyTorch** - ML model inference
- **librosa** - Audio analysis
- **essentia** - Advanced audio features
- **yt-dlp** - YouTube audio download
- **Modal** - GPU processing (vocal separation)

### Frontend
- **React 18** - UI framework
- **Vite** - Build tool
- **Tailwind CSS** - Styling
- **Lucide React** - Icons

### Infrastructure
- **Railway** - Deployment platform
- **Supabase** - Database (PostgreSQL)
- **GitHub Actions** - CI/CD
- **Git LFS** - Large file storage (ML models)

## Common Tasks

### Adding a New API Endpoint
1. Add route in `backend/main.py`
2. Implement logic in appropriate module
3. Update frontend API calls in `frontend/src/App.jsx`
4. Test with curl or Postman
5. Update AGENTS.md if needed

### Updating ML Models
1. Place model files in `backend/BTC-ISMIR19/test/`
2. Track with Git LFS: `git lfs track "*.pt"`
3. Update model loading in `chord_detector_advanced.py`
4. Test locally before deploying
5. Verify Railway downloads LFS files correctly

### Debugging Railway Deployment
1. Check Railway logs: `railway logs`
2. Verify environment variables are set
3. Check Dockerfile build logs for LFS file downloads
4. Ensure model files are downloaded (look for "✅ Model files downloaded successfully")
5. Check for missing dependencies in requirements.txt

## Environment Variables

Required environment variables (see `.env.example`):

```bash
# Modal GPU Processing
MODAL_TOKEN_ID=your_modal_token_id
MODAL_TOKEN_SECRET=your_modal_token_secret

# YouTube API
YOUTUBE_API_KEY=your_youtube_api_key

# Supabase Database
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_key

# Optional
PORT=8080  # Railway sets this automatically
```

## Troubleshooting

### Chord Detection Returns 0 Chords
- Check if BTC model loaded successfully in logs
- Verify LFS files were downloaded (not pointer files)
- Check for "invalid load key" errors
- Ensure `bpm_override` is not sent as empty string

### Frontend Build Fails
- Clear npm cache: `npm cache clean --force`
- Delete node_modules and reinstall: `rm -rf node_modules && npm install`
- Check Node version (requires Node 18+)

### Railway Deployment Issues
- Verify all environment variables are set in Railway dashboard
- Check if Git LFS files are being downloaded in build logs
- Ensure Dockerfile COPY commands include necessary files
- Monitor build time (Railway has limits)

## Performance Optimization

### Backend
- Use Modal for GPU-intensive operations (vocal separation)
- Cache frequently accessed data in memory
- Use async/await for I/O operations
- Limit concurrent processing jobs

### Frontend
- Lazy load heavy components
- Use React.memo for expensive renders
- Optimize audio player buffering
- Implement virtual scrolling for long chord lists

## Security Notes

- Never commit `.env` file
- Rotate API keys regularly
- Use CORS appropriately (currently allows all origins)
- Validate all user inputs on backend
- Sanitize file uploads (check file types, sizes)
- Use HTTPS in production

## Resources

- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [React Documentation](https://react.dev/)
- [Railway Documentation](https://docs.railway.app/)
- [Modal Documentation](https://modal.com/docs)
- [BTC-ISMIR19 Paper](https://github.com/jayg996/BTC-ISMIR19)
