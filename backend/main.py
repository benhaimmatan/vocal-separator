from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Depends, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import tempfile
import os
from pathlib import Path
import logging
import asyncio
from typing import Optional
import uuid

from .processor import AudioProcessor
from .chord_detector_advanced import AdvancedChordDetector
from .lyrics_utils import get_lyrics_for_song, clean_lyrics
from .supabase_client import get_supabase_client, SupabaseClient, init_database_schema

# Import Modal client for GPU processing
try:
    import sys
    import os
    # Add the project root to Python path for modal_functions import
    sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    
    # Check for Modal credentials using user's variable names
    modal_token_id = os.getenv("MODALTOKENID")
    modal_token_secret = os.getenv("MODALTOKENSECRET")
    
    if modal_token_id and modal_token_secret:
        # Set standard Modal environment variables
        os.environ["MODAL_TOKEN_ID"] = modal_token_id
        os.environ["MODAL_TOKEN_SECRET"] = modal_token_secret
        
        from modal_functions import ModalClient
        MODAL_ENABLED = True
        print("Modal GPU processing enabled")
    else:
        MODAL_ENABLED = False
        print("Modal credentials not found - falling back to CPU")
except ImportError as e:
    MODAL_ENABLED = False
    print(f"Modal GPU processing disabled - falling back to CPU: {e}")
except Exception as e:
    MODAL_ENABLED = False
    print(f"Modal initialization failed: {e}")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Vocal Separator API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Security
security = HTTPBearer(auto_error=False)

# Initialize processors
audio_processor = AudioProcessor()
chord_detector = AdvancedChordDetector()

# Initialize Supabase
try:
    supabase_client = get_supabase_client()
    init_database_schema(supabase_client)
    SUPABASE_ENABLED = True
    logger.info("Supabase integration enabled")
except Exception as e:
    SUPABASE_ENABLED = False
    logger.warning(f"Supabase disabled: {e}")

# Authentication dependency
async def get_current_user(credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)) -> Optional[dict]:
    """Get current authenticated user from JWT token"""
    if not SUPABASE_ENABLED or not credentials:
        return None
    
    try:
        token = credentials.credentials
        result = supabase_client.verify_token(token)
        if result["success"]:
            return result["user"]
    except Exception as e:
        logger.warning(f"Token verification failed: {e}")
    
    return None

@app.get("/api/health")
async def health_check():
    return {
        "status": "healthy",
        "modal_enabled": MODAL_ENABLED,
        "supabase_enabled": SUPABASE_ENABLED
    }

@app.post("/api/auth/register")
async def register(email: str = Form(...), password: str = Form(...), display_name: str = Form(None)):
    """Register new user"""
    if not SUPABASE_ENABLED:
        raise HTTPException(status_code=503, detail="Authentication not available")
    
    try:
        result = supabase_client.register_user(email, password, display_name)
        if result["success"]:
            return {
                "success": True,
                "user": {
                    "id": result["user"].id,
                    "email": result["user"].email,
                    "display_name": result["user"].user_metadata.get("display_name")
                },
                "access_token": result["session"].access_token
            }
        else:
            raise HTTPException(status_code=400, detail=result["error"])
    except Exception as e:
        logger.error(f"Registration error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/auth/login")
async def login(email: str = Form(...), password: str = Form(...)):
    """Authenticate user"""
    if not SUPABASE_ENABLED:
        raise HTTPException(status_code=503, detail="Authentication not available")
    
    try:
        result = supabase_client.authenticate_user(email, password)
        if result["success"]:
            return {
                "success": True,
                "user": {
                    "id": result["user"].id,
                    "email": result["user"].email,
                    "display_name": result["user"].user_metadata.get("display_name")
                },
                "access_token": result["session"].access_token
            }
        else:
            raise HTTPException(status_code=401, detail="Invalid credentials")
    except Exception as e:
        logger.error(f"Login error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/user/profile")
async def get_profile(user = Depends(get_current_user)):
    """Get user profile"""
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    try:
        result = supabase_client.get_user_profile(user.id)
        if result["success"]:
            return {"success": True, "profile": result["profile"]}
        else:
            raise HTTPException(status_code=404, detail="Profile not found")
    except Exception as e:
        logger.error(f"Profile error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/user/jobs")
async def get_user_jobs(user = Depends(get_current_user), job_type: Optional[str] = None):
    """Get user's processing jobs"""
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    try:
        result = supabase_client.get_user_jobs(user.id, job_type=job_type)
        if result["success"]:
            return {"success": True, "jobs": result["jobs"]}
        else:
            raise HTTPException(status_code=500, detail=result["error"])
    except Exception as e:
        logger.error(f"Jobs error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/separate")
async def separate_audio(
    file: UploadFile = File(...),
    extract_vocals: bool = Form(True),
    extract_accompaniment: bool = Form(True),
    user = Depends(get_current_user)
):
    """Separate vocals and accompaniment from audio file using GPU acceleration"""
    job_id = None
    
    try:
        # Create job record if user is authenticated
        if SUPABASE_ENABLED and user:
            job_result = supabase_client.create_processing_job(
                user.id,
                "vocal_separation", 
                file.filename,
                file.size,
                {"extract_vocals": extract_vocals, "extract_accompaniment": extract_accompaniment}
            )
            if job_result["success"]:
                job_id = job_result["job"]["id"]
                logger.info(f"Created job {job_id} for user {user.id}")
        
        # Read file content
        content = await file.read()
        
        # Update job status to processing
        if job_id:
            supabase_client.update_job_status(job_id, "processing")
        
        # Use Modal GPU processing if available, otherwise fallback to CPU
        if MODAL_ENABLED:
            logger.info("Using Modal GPU processing")
            result = ModalClient.separate_audio(content, extract_vocals, extract_accompaniment)
            
            if result["success"]:
                # Save processed files to temporary storage
                output_dir = tempfile.mkdtemp()
                results = {}
                
                if result.get("vocals_data") and extract_vocals:
                    vocals_path = os.path.join(output_dir, "vocals.wav")
                    with open(vocals_path, "wb") as f:
                        f.write(result["vocals_data"])
                    results["vocals"] = vocals_path
                
                if result.get("accompaniment_data") and extract_accompaniment:
                    accompaniment_path = os.path.join(output_dir, "accompaniment.wav")
                    with open(accompaniment_path, "wb") as f:
                        f.write(result["accompaniment_data"])
                    results["accompaniment"] = accompaniment_path
                
                # Update job with results
                if job_id:
                    supabase_client.update_job_status(job_id, "completed", results)
                
                return {
                    "success": True,
                    "job_id": job_id,
                    "vocals_path": results.get("vocals"),
                    "accompaniment_path": results.get("accompaniment"),
                    "processing_time": "~30 seconds (GPU accelerated)"
                }
            else:
                if job_id:
                    supabase_client.update_job_status(job_id, "failed", error_message=result.get("error"))
                raise HTTPException(status_code=500, detail=result.get("error", "GPU processing failed"))
        
        else:
            # Fallback to CPU processing
            logger.info("Using CPU processing (fallback)")
            
            # Save uploaded file
            with tempfile.NamedTemporaryFile(delete=False, suffix=Path(file.filename).suffix) as tmp:
                tmp.write(content)
                input_path = tmp.name
            
            output_dir = tempfile.mkdtemp()
            
            results = await audio_processor.process_audio(
                input_path,
                output_dir,
                {
                    'vocals': extract_vocals,
                    'accompaniment': extract_accompaniment
                }
            )
            
            os.unlink(input_path)
            
            # Update job with results
            if job_id:
                supabase_client.update_job_status(job_id, "completed", results)
            
            return {
                "success": True,
                "job_id": job_id,
                "vocals_path": results.get("vocals"),
                "accompaniment_path": results.get("accompaniment"),
                "processing_time": "5-10 minutes (CPU fallback)"
            }
        
    except Exception as e:
        logger.error(f"Error: {e}")
        import traceback
        logger.error(traceback.format_exc())
        
        if job_id:
            supabase_client.update_job_status(job_id, "failed", error_message=str(e))
        
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/download/{file_path:path}")
async def download_file(file_path: str):
    """Download processed file"""
    # Handle both /tmp/... and tmp/... paths
    if not file_path.startswith('/'):
        file_path = '/' + file_path
    
    logger.info(f"Download requested: {file_path}")
    
    if os.path.exists(file_path):
        return FileResponse(file_path, filename=Path(file_path).name)
    
    logger.error(f"File not found: {file_path}")
    raise HTTPException(status_code=404, detail=f"File not found: {file_path}")

@app.post("/api/chords")
async def detect_chords(file: UploadFile = File(...), user = Depends(get_current_user)):
    """Detect chords from audio file using GPU acceleration"""
    job_id = None
    
    try:
        # Create job record if user is authenticated
        if SUPABASE_ENABLED and user:
            job_result = supabase_client.create_processing_job(
                user.id,
                "chord_detection",
                file.filename,
                file.size
            )
            if job_result["success"]:
                job_id = job_result["job"]["id"]
        
        # Read file content
        content = await file.read()
        
        # Update job status to processing
        if job_id:
            supabase_client.update_job_status(job_id, "processing")
        
        # Use Modal GPU processing if available
        if MODAL_ENABLED:
            logger.info("Using Modal GPU chord detection")
            result = ModalClient.detect_chords(content)
            
            if result["success"]:
                # Update job with results
                if job_id:
                    supabase_client.update_job_status(job_id, "completed", {"chords": result["chords"]})
                
                return {
                    "success": True,
                    "job_id": job_id,
                    "chords": result["chords"]
                }
            else:
                if job_id:
                    supabase_client.update_job_status(job_id, "failed", error_message=result.get("error"))
                raise HTTPException(status_code=500, detail=result.get("error"))
        
        else:
            # Fallback to CPU processing
            logger.info("Using CPU chord detection (fallback)")
            
            with tempfile.NamedTemporaryFile(delete=False, suffix=Path(file.filename).suffix) as tmp:
                tmp.write(content)
                tmp_path = tmp.name
            
            logger.info(f"Detecting chords: {file.filename}")
            chords = chord_detector.detect_chords(tmp_path)
            
            os.unlink(tmp_path)
            
            # Format results
            formatted = []
            for c in chords:
                if isinstance(c, tuple):
                    formatted.append({"time": c[0], "end": c[1], "chord": c[2]})
                else:
                    formatted.append(c)
            
            # Update job with results
            if job_id:
                supabase_client.update_job_status(job_id, "completed", {"chords": formatted})
            
            return {
                "success": True,
                "job_id": job_id,
                "chords": formatted
            }
        
    except Exception as e:
        logger.error(f"Error: {e}")
        
        if job_id:
            supabase_client.update_job_status(job_id, "failed", error_message=str(e))
        
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/lyrics")
async def fetch_lyrics(song: str = Form(...), artist: str = Form(...), user = Depends(get_current_user)):
    """Fetch lyrics for a song"""
    job_id = None
    
    try:
        # Create job record if user is authenticated
        if SUPABASE_ENABLED and user:
            job_result = supabase_client.create_processing_job(
                user.id,
                "lyrics",
                f"{song} - {artist}",
                None,
                {"song": song, "artist": artist}
            )
            if job_result["success"]:
                job_id = job_result["job"]["id"]
        
        # Update job status to processing
        if job_id:
            supabase_client.update_job_status(job_id, "processing")
        
        logger.info(f"Fetching lyrics: {song} by {artist}")
        lyrics = get_lyrics_for_song(song, artist)
        
        if lyrics:
            cleaned = clean_lyrics(lyrics)
            result_data = {"lyrics": cleaned, "song": song, "artist": artist}
            
            # Update job with results
            if job_id:
                supabase_client.update_job_status(job_id, "completed", result_data)
            
            return {
                "success": True,
                "job_id": job_id,
                **result_data
            }
        else:
            if job_id:
                supabase_client.update_job_status(job_id, "failed", error_message="Lyrics not found")
            return {"success": False, "message": "Lyrics not found"}
            
    except Exception as e:
        logger.error(f"Error: {e}")
        
        if job_id:
            supabase_client.update_job_status(job_id, "failed", error_message=str(e))
        
        raise HTTPException(status_code=500, detail=str(e))