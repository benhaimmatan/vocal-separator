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

try:
    from .processor import AudioProcessor
    from .chord_detector_advanced import AdvancedChordDetector
    from .lyrics_utils import get_lyrics_for_song, clean_lyrics
    from .supabase_client import get_supabase_client, SupabaseClient, init_database_schema
    from .youtube_utils import search_youtube, download_youtube_audio, cleanup_temp_directory
except ImportError:
    from processor import AudioProcessor
    from chord_detector_advanced import AdvancedChordDetector
    from lyrics_utils import get_lyrics_for_song, clean_lyrics
    from supabase_client import get_supabase_client, SupabaseClient, init_database_schema
    from youtube_utils import search_youtube, download_youtube_audio, cleanup_temp_directory

# Import Modal client for GPU processing
try:
    import sys
    import os
    
    # Check for Modal credentials first
    modal_token_id = os.getenv("MODALTOKENID")
    modal_token_secret = os.getenv("MODALTOKENSECRET")

    # Debug logging
    print(f"[DEBUG] MODALTOKENID present: {modal_token_id is not None}", file=sys.stderr)
    print(f"[DEBUG] MODALTOKENSECRET present: {modal_token_secret is not None}", file=sys.stderr)

    if not modal_token_id or not modal_token_secret:
        MODAL_ENABLED = False
        print("Modal credentials not found in environment - falling back to CPU")
    else:
        # Set standard Modal environment variables
        os.environ["MODAL_TOKEN_ID"] = modal_token_id
        os.environ["MODAL_TOKEN_SECRET"] = modal_token_secret
        
        # Try different import paths for modal_functions
        modal_client = None
        
        # Try importing from project root
        project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        if os.path.exists(os.path.join(project_root, "modal_functions.py")):
            sys.path.insert(0, project_root)
            try:
                from modal_functions import ModalClient
                modal_client = ModalClient
            except ImportError as e:
                print(f"Failed to import from project root: {e}")
        
        # Try importing from app root (HuggingFace container)
        if modal_client is None and os.path.exists("/app/modal_functions.py"):
            sys.path.insert(0, "/app")
            try:
                from modal_functions import ModalClient
                modal_client = ModalClient
            except ImportError as e:
                print(f"Failed to import from /app: {e}")
        
        # Try relative import from current working directory
        if modal_client is None and os.path.exists("modal_functions.py"):
            try:
                from modal_functions import ModalClient
                modal_client = ModalClient
            except ImportError as e:
                print(f"Failed to import from current directory: {e}")
        
        if modal_client:
            MODAL_ENABLED = True
            print("Modal GPU processing enabled")
        else:
            MODAL_ENABLED = False
            print("Modal functions module not found - falling back to CPU")
            
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
    # Check yt-dlp availability
    yt_dlp_available = False
    yt_dlp_version = None
    try:
        import yt_dlp
        yt_dlp_available = True
        yt_dlp_version = yt_dlp.version.__version__
    except Exception as e:
        logger.warning(f"yt-dlp not available: {e}")

    # Check youtube_api availability
    youtube_api_available = False
    try:
        from youtube_utils import youtube_api
        youtube_api_available = youtube_api is not None
    except Exception as e:
        logger.warning(f"youtube_api check failed: {e}")

    return {
        "status": "healthy",
        "modal_enabled": MODAL_ENABLED,
        "supabase_enabled": SUPABASE_ENABLED,
        "yt_dlp_available": yt_dlp_available,
        "yt_dlp_version": yt_dlp_version,
        "youtube_api_configured": youtube_api_available
    }

@app.get("/api/youtube/test")
async def test_youtube_download():
    """Test YouTube download functionality with a known working video"""
    try:
        # Use a short Creative Commons test video
        test_video_id = "jNQXAC9IVRw"  # "Me at the zoo" - first YouTube video

        logger.info(f"Testing YouTube download with video: {test_video_id}")
        result = download_youtube_audio(test_video_id)

        # Clean up downloaded file
        if result.get("success") and result.get("temp_dir"):
            cleanup_temp_directory(result.get("temp_dir"))

        return {
            "success": result.get("success", False),
            "message": "YouTube download test completed",
            "test_video_id": test_video_id,
            "error": result.get("error") if not result.get("success") else None,
            "title": result.get("title") if result.get("success") else None
        }
    except Exception as e:
        logger.error(f"YouTube test error: {e}")
        import traceback
        logger.error(f"Traceback: {traceback.format_exc()}")
        return {
            "success": False,
            "message": "YouTube download test failed",
            "error": str(e)
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
        
        # Try Modal GPU processing first, fallback to CPU if needed
        use_cpu_processing = False
        modal_error = None
        
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
                # Modal failed, fall back to CPU processing
                modal_error = result.get('error')
                logger.warning(f"Modal GPU failed: {modal_error} - falling back to CPU processing")
                use_cpu_processing = True
        else:
            logger.info("Modal not enabled - using CPU processing")
            use_cpu_processing = True
        
        # CPU processing (either fallback or primary)
        if use_cpu_processing:
            if modal_error:
                logger.info("Using CPU processing (Modal GPU fallback)")
                if job_id:
                    supabase_client.update_job_status(job_id, "processing", {"fallback": f"CPU processing due to GPU failure: {modal_error}"})
            else:
                logger.info("Using CPU processing")
            
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
            
            processing_time = "5-10 minutes (CPU fallback)" if modal_error else "5-10 minutes (CPU processing)"
            
            return {
                "success": True,
                "job_id": job_id,
                "vocals_path": results.get("vocals"),
                "accompaniment_path": results.get("accompaniment"),
                "processing_time": processing_time
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
async def detect_chords(
    file: UploadFile = File(...), 
    simplicity_preference: float = Form(0.5),
    bpm_override: Optional[float] = Form(None),
    user = Depends(get_current_user)
):
    """Detect chords from audio file using advanced GPU acceleration"""
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
        
        # DISABLED: Modal GPU has old chroma matching code, not real BTC model
        # Using CPU processing with fixed BTC-ISMIR19 implementation instead
        if False and MODAL_ENABLED:
            logger.info(f"Using Modal GPU chord detection (simplicity: {simplicity_preference}, BPM: {bpm_override})")
            result = ModalClient.detect_chords(content, simplicity_preference, bpm_override)

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
            # Use CPU processing with REAL BTC-ISMIR19 model (FIXED)
            logger.info("Using CPU chord detection (fallback)")
            
            with tempfile.NamedTemporaryFile(delete=False, suffix=Path(file.filename).suffix) as tmp:
                tmp.write(content)
                tmp_path = tmp.name
            
            logger.info(f"Detecting chords with advanced CPU processing: {file.filename} (simplicity: {simplicity_preference}, BPM: {bpm_override})")
            
            # Use advanced chord detection with new parameters
            result = chord_detector.detect_chords_advanced(
                tmp_path,
                simplicity_preference=simplicity_preference,
                bpm_override=bpm_override
            )
            
            # Extract chords from result for compatibility
            chords = result.get("chords", [])
            bpm = result.get("bpm", 120)
            beats = result.get("beats", [])
            metadata = result.get("metadata", {})

            os.unlink(tmp_path)

            # Format results
            formatted = []
            for c in chords:
                if isinstance(c, tuple):
                    formatted.append({"time": c[0], "end": c[1], "chord": c[2]})
                else:
                    formatted.append(c)

            # Update job with results (include full data)
            if job_id:
                supabase_client.update_job_status(job_id, "completed", {
                    "chords": formatted,
                    "bpm": bpm,
                    "beats": beats,
                    "metadata": metadata
                })

            return {
                "success": True,
                "job_id": job_id,
                "chords": formatted,
                "bpm": bpm,
                "beats": beats,
                "metadata": metadata
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


@app.post("/api/youtube/search")
async def youtube_search_endpoint(
    query: str = Form(...),
    max_results: int = Form(10),
    user = Depends(get_current_user)
):
    """
    Search YouTube videos

    Parameters:
    - query: Search query string
    - max_results: Number of results to return (default 10, max 50)

    Returns:
    - success: bool
    - results: list of video objects with id, title, thumbnail, etc.
    - error: string (if failed)
    """
    try:
        # Limit max_results
        max_results = min(max_results, 50)

        # Search YouTube
        result = search_youtube(query, max_results)

        if not result["success"]:
            error_msg = result.get("error", "Search failed")
            logger.error(f"YouTube search failed: {error_msg}")
            raise HTTPException(status_code=400, detail=error_msg)

        return {
            "success": True,
            "results": result["results"],
            "query": query
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"YouTube search error: {e}")
        import traceback
        logger.error(f"Traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/youtube/analyze")
async def youtube_analyze_endpoint(
    video_id: str = Form(...),
    analysis_type: str = Form("chords"),  # "chords" or "separate"
    simplicity_preference: float = Form(0.5),
    user = Depends(get_current_user)
):
    """
    Download YouTube video and run analysis

    Parameters:
    - video_id: YouTube video ID
    - analysis_type: "chords" or "separate"
    - simplicity_preference: For chord detection (0-1)

    Returns:
    - success: bool
    - job_id: string (if Supabase enabled)
    - analysis results based on type
    """
    job_id = None
    temp_dir = None

    try:
        # Create job record
        if SUPABASE_ENABLED and user:
            job_result = supabase_client.create_processing_job(
                user_id=user.get("id"),
                job_type=f"youtube_{analysis_type}",
                filename=f"youtube_{video_id}",
                file_size=None,
                metadata={"video_id": video_id, "analysis_type": analysis_type}
            )
            if job_result["success"]:
                job_id = job_result["job"]["id"]

        # Update job status
        if job_id:
            supabase_client.update_job_status(job_id, "processing")

        # Download audio
        logger.info(f"Downloading audio from YouTube video: {video_id}")
        download_result = download_youtube_audio(video_id)

        if not download_result["success"]:
            raise ValueError(download_result.get("error", "Download failed"))

        audio_path = download_result["audio_path"]
        temp_dir = download_result["temp_dir"]
        video_title = download_result.get("title", "YouTube Video")

        # Run analysis based on type
        if analysis_type == "chords":
            # Chord detection
            result = chord_detector.detect_chords_advanced(
                audio_path,
                simplicity_preference=simplicity_preference,
                bpm_override=None
            )

            # Format response
            formatted_chords = [
                {"time": c["time"], "chord": c["chord"], "confidence": c.get("confidence", 1.0)}
                for c in result["chords"]
            ]

            response_data = {
                "success": True,
                "job_id": job_id,
                "chords": formatted_chords,
                "bpm": result.get("bpm", 120),
                "video_title": video_title,
                "video_id": video_id,
                "audio_path": audio_path  # Return audio path for frontend playback
            }

        elif analysis_type == "separate":
            # Vocal separation
            result = await audio_processor.process_audio(
                audio_path,
                extract_vocals=True,
                extract_accompaniment=True
            )

            response_data = {
                "success": True,
                "job_id": job_id,
                "vocals_path": result.get("vocals_path"),
                "accompaniment_path": result.get("accompaniment_path"),
                "video_title": video_title,
                "video_id": video_id
            }
        else:
            raise ValueError(f"Invalid analysis type: {analysis_type}")

        # Update job with results
        if job_id:
            supabase_client.update_job_status(
                job_id,
                "completed",
                output_files=response_data
            )

        return response_data

    except ValueError as e:
        # User-friendly errors (invalid video, geo-blocked, etc.)
        error_detail = str(e)
        logger.error(f"YouTube analyze ValueError: {error_detail}")
        if job_id:
            supabase_client.update_job_status(job_id, "failed", error_message=error_detail)
        raise HTTPException(status_code=400, detail=error_detail)

    except Exception as e:
        error_detail = str(e)
        logger.error(f"YouTube analyze Exception: {error_detail}")
        import traceback
        logger.error(f"Traceback: {traceback.format_exc()}")
        if job_id:
            supabase_client.update_job_status(job_id, "failed", error_message=error_detail)
        raise HTTPException(status_code=500, detail=error_detail)

    finally:
        # Cleanup temp directory only for vocal separation
        # For chord analysis, keep the audio file so frontend can play it
        if temp_dir and analysis_type != "chords":
            cleanup_temp_directory(temp_dir)