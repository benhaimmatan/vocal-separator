from lyrics_utils import clean_lyrics, get_lyrics_for_song
import sys
import os
# Add the backend directory to sys.path to ensure local modules are found
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi import FastAPI, File, UploadFile, HTTPException, WebSocket, Form, Body, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles
from pathlib import Path
from processor import AudioProcessor
from chord_detector import ChordDetector  # Import the chord detector
import json
from typing import Dict, Optional, List
import os
import uuid
from datetime import datetime
import logging
from urllib.parse import quote, unquote
from starlette.responses import FileResponse
import unicodedata
from starlette.types import Scope
import shutil
import asyncio
import subprocess
import sys
import time
from pydantic import BaseModel
import requests
from bs4 import BeautifulSoup
import re
from lyrics_endpoints import router as lyrics_router
from config import VOCALS_DIR, HISTORY_FILE, logger, ADVANCED_ANALYSIS_AVAILABLE
from analysis import SongSection, analyze_musical_structure, detect_beat_structure, create_lyric_to_chord_mapping
import librosa

# Set up logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

# Advanced music analysis imports
try:
    import numpy as np
    from scipy import signal
    from scipy.ndimage import maximum_filter
    from sklearn.cluster import KMeans
    from sklearn.metrics.pairwise import cosine_similarity
    ADVANCED_ANALYSIS_AVAILABLE = True
    logger.info("Advanced music analysis libraries loaded successfully")
except ImportError as e:
    ADVANCED_ANALYSIS_AVAILABLE = False
    logger.warning(f"Advanced analysis libraries not available: {e}. Using fallback methods.")

app = FastAPI()

# Include the lyrics router
app.include_router(lyrics_router)
logger.info("Lyrics endpoints router included!")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:5174", "http://localhost:5175"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Define paths
BASE_DIR = Path(__file__).parent
VOCALS_DIR = Path.home() / "Downloads" / "Vocals"
VOCALS_DIR.mkdir(exist_ok=True, parents=True)
HISTORY_FILE = VOCALS_DIR / "processing_history.json"

logger.debug(f"Base directory: {BASE_DIR}")
logger.debug(f"Vocals directory: {VOCALS_DIR}")
logger.debug(f"History file path: {HISTORY_FILE}")

# Add a ping endpoint for backend availability check
@app.get("/api/ping")
async def ping():
    return {"status": "ok", "message": "Backend server is up and running"}

# Mount the static directory with custom handling for Unicode filenames
class UnicodeStaticFiles(StaticFiles):
    async def get_response(self, path: str, scope: Scope):
        try:
            # Decode the URL-encoded path
            decoded_path = unquote(path)
            # Normalize Unicode characters
            normalized_path = unicodedata.normalize('NFC', decoded_path)
            
            # Log the paths for debugging
            logger.debug(f"Static file request:")
            logger.debug(f"Original path: {path}")
            logger.debug(f"Decoded path: {decoded_path}")
            logger.debug(f"Normalized path: {normalized_path}")
            
            # Check if file exists
            full_path = Path(self.directory) / normalized_path
            logger.debug(f"Full path: {full_path}")
            logger.debug(f"File exists: {full_path.exists()}")
            
            # If the file doesn't exist, try to find it using glob pattern
            if not full_path.exists():
                dir_path = Path(self.directory) / Path(normalized_path).parent
                filename = Path(normalized_path).name
                
                logger.debug(f"File not found, searching in directory: {dir_path}")
                logger.debug(f"Looking for filename: {filename}")
                
                # Check if the filename has non-ASCII characters
                has_non_ascii = any(ord(c) > 127 for c in filename)
                if has_non_ascii:
                    logger.debug(f"Filename contains non-ASCII characters: {filename}")
                    
                    # Try to list all files in the directory
                    if dir_path.exists():
                        files_in_dir = list(dir_path.glob("*"))
                        logger.debug(f"Files in directory: {files_in_dir}")
                        
                        # Try prefix matching for Hebrew characters
                        # Get the first few characters as a prefix
                        filename_stem = Path(filename).stem
                        prefix_length = min(3, len(filename_stem))
                        if prefix_length > 0:
                            prefix = filename_stem[:prefix_length]
                            logger.debug(f"Searching for files with prefix: {prefix}")
                            
                            matching_files = list(dir_path.glob(f"{prefix}*"))
                            logger.debug(f"Files matching prefix: {matching_files}")
                            
                            if matching_files:
                                # Filter to keep only files (not directories)
                                matching_files = [f for f in matching_files if f.is_file()]
                                
                                if matching_files:
                                    # Use the first match
                                    found_path = matching_files[0]
                                    logger.debug(f"Using first match: {found_path}")
                                    
                                    # Get the relative path from the static directory
                                    rel_path = found_path.relative_to(self.directory)
                                    logger.debug(f"Relative path: {rel_path}")
                                    
                                    # Try to serve this file instead
                                    response = await super().get_response(str(rel_path), scope)
                                    if response is not None:
                                        logger.debug(f"Successfully served alternative file: {found_path}")
                                        return response
                
                # If we get here, we couldn't find a match by prefix
                # Try extension-based search
                ext = Path(filename).suffix
                if ext:
                    logger.debug(f"Searching for files with extension: {ext}")
                    
                    matching_files = list(dir_path.glob(f"*{ext}"))
                    logger.debug(f"Files matching extension: {matching_files}")
                    
                    if matching_files:
                        # Use the first match
                        found_path = matching_files[0]
                        logger.debug(f"Using first match by extension: {found_path}")
                        
                        # Get the relative path from the static directory
                        rel_path = found_path.relative_to(self.directory)
                        logger.debug(f"Relative path: {rel_path}")
                        
                        # Try to serve this file instead
                        response = await super().get_response(str(rel_path), scope)
                        if response is not None:
                            logger.debug(f"Successfully served alternative file by extension: {found_path}")
                            return response
                
                logger.error(f"File not found after all attempts: {full_path}")
                raise HTTPException(status_code=404, detail=f"File not found: {normalized_path}")
            
            # If we got here, the file exists, so try to serve it
            try:
                response = await super().get_response(normalized_path, scope)
                if response is None:
                    logger.error(f"No response for file: {full_path}")
                    raise HTTPException(status_code=404, detail=f"File not found: {normalized_path}")
                return response
            except Exception as e:
                logger.error(f"Error serving file {full_path}: {e}")
                # Try one more time with the raw path
                try:
                    response = await super().get_response(path, scope)
                    if response is not None:
                        logger.debug(f"Successfully served file with original path: {path}")
                        return response
                except Exception as e2:
                    logger.error(f"Error serving file with original path: {e2}")
                raise
        except Exception as e:
            logger.error(f"Error serving static file: {str(e)}")
            if isinstance(e, HTTPException):
                raise e
            raise HTTPException(status_code=500, detail=str(e))

app.mount("/audio", UnicodeStaticFiles(directory=str(VOCALS_DIR)), name="audio")
logger.debug(f"Mounted static files from: {VOCALS_DIR}")

# Store active WebSocket connections
active_connections: Dict[str, WebSocket] = {}

# Initialize the chord detector
chord_detector = ChordDetector()

def load_history():
    try:
        if HISTORY_FILE.exists():
            logger.debug(f"Loading history from: {HISTORY_FILE}")
            with open(HISTORY_FILE, "r", encoding='utf-8') as f:
                history = json.load(f)
                logger.debug(f"Loaded history: {history}")
                return history
        else:
            logger.debug("No history file found")
            return {"files": []}
    except Exception as e:
        logger.error(f"Error loading history: {e}")
        return {"files": []}

def save_history(history_entry):
    try:
        logger.debug(f"Saving history entry: {history_entry}")
        
        # Load existing history
        if HISTORY_FILE.exists():
            with open(HISTORY_FILE, "r", encoding='utf-8') as f:
                history = json.load(f)
                logger.debug(f"Loaded existing history: {history}")
        else:
            history = {"files": []}
            logger.debug("No existing history, creating new")

        # Add new entry
        history["files"].insert(0, history_entry)
        logger.debug(f"Updated history: {history}")

        # Save updated history
        with open(HISTORY_FILE, "w", encoding='utf-8') as f:
            json.dump(history, f, ensure_ascii=False, indent=2)
            logger.debug(f"History saved to: {HISTORY_FILE}")
            
    except Exception as e:
        logger.error(f"Error saving history: {e}", exc_info=True)

@app.get("/")
async def root():
    return {"message": "Welcome to Vocal Separator API", "status": "running"}

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    client_id = id(websocket)
    active_connections[client_id] = websocket
    
    try:
        while True:
            # Keep the connection alive
            await websocket.receive_text()
    except:
        pass
    finally:
        if client_id in active_connections:
            del active_connections[client_id]

async def broadcast_progress(data):
    """
    Send progress updates to all connected clients
    data can be a dictionary with progress and message
    """
    # Send progress to all connected clients
    disconnected = []
    for client_id, connection in active_connections.items():
        try:
            await connection.send_json(data)
        except Exception as e:
            logger.error(f"Error sending to client {client_id}: {str(e)}")
            disconnected.append(client_id)
    
    # Clean up disconnected clients
    for client_id in disconnected:
        if client_id in active_connections:
            del active_connections[client_id]

@app.get("/api/library")
async def get_library():
    try:
        logger.debug(f"VOCALS_DIR path: {VOCALS_DIR}")
        logger.debug(f"VOCALS_DIR exists: {VOCALS_DIR.exists()}")
        logger.debug(f"VOCALS_DIR contents: {list(VOCALS_DIR.glob('*'))}")
        logger.debug(f"HISTORY_FILE path: {HISTORY_FILE}")
        logger.debug(f"HISTORY_FILE exists: {HISTORY_FILE.exists()}")
        if HISTORY_FILE.exists():
            with open(HISTORY_FILE, "r", encoding='utf-8') as f:
                history = json.load(f)
        else:
            history = {"files": []}
        logger.debug(f"Loaded history: {history}")
        validated_files = []
        existing_ids = set(entry["id"] for entry in history.get("files", []))
        # --- AUTO-IMPORT LOGIC ---
        import uuid
        from datetime import datetime
        for folder in VOCALS_DIR.iterdir():
            if folder.is_dir():
                mp3_files = list(folder.glob("*.mp3"))
                if not mp3_files:
                    continue
                # Check if already in history by directory name and originalName
                already_in_history = any(
                    entry.get("directory") == folder.name for entry in history.get("files", [])
                )
                if already_in_history:
                    continue
                # Create a new entry
                file_paths = {}
                for f in mp3_files:
                    fname = f.name
                    if fname.endswith('_vocals.mp3'):
                        file_paths["vocals"] = f"/audio/{folder.name}/{fname}"
                    elif fname.endswith('_accompaniment.mp3'):
                        file_paths["accompaniment"] = f"/audio/{folder.name}/{fname}"
                    elif fname.endswith('_piano.mp3'):
                        file_paths["piano"] = f"/audio/{folder.name}/{fname}"
                    else:
                        file_paths["original"] = f"/audio/{folder.name}/{fname}"
                if file_paths:
                    entry = {
                        "id": str(uuid.uuid4()),
                        "originalName": mp3_files[0].name,
                        "dateProcessed": datetime.now().isoformat(),
                        "directory": folder.name,
                        "files": file_paths
                    }
                    logger.info(f"Auto-importing new folder: {folder.name}")
                    history["files"].append(entry)
        # Save updated history if new entries were added
        with open(HISTORY_FILE, "w", encoding='utf-8') as f:
            json.dump(history, f, ensure_ascii=False, indent=2)
        # --- END AUTO-IMPORT LOGIC ---
        for file in history.get("files", []):
            logger.debug(f"Processing file entry: {file}")
            dir_path = VOCALS_DIR / file.get("directory", "")
            logger.debug(f"Checking directory: {dir_path}")
            logger.debug(f"Directory exists: {dir_path.exists()}")
            if dir_path.exists():
                dir_contents = list(dir_path.glob('*.mp3'))
                logger.debug(f"Directory contents: {dir_contents}")
                files_dict = {"original": None, "vocals": None, "accompaniment": None, "piano": None}
                for f in dir_contents:
                    fname = f.name
                    if fname.endswith('_vocals.mp3'):
                        files_dict["vocals"] = f"/audio/{file['directory']}/{fname}"
                    elif fname.endswith('_accompaniment.mp3'):
                        files_dict["accompaniment"] = f"/audio/{file['directory']}/{fname}"
                    elif fname.endswith('_piano.mp3'):
                        files_dict["piano"] = f"/audio/{file['directory']}/{fname}"
                    else:
                        files_dict["original"] = f"/audio/{file['directory']}/{fname}"
                        file["originalName"] = fname
                if any(files_dict.values()):
                    entry = {
                        "id": file["id"],
                        "originalName": file["originalName"],
                        "dateProcessed": file["dateProcessed"],
                        "directory": str(file["directory"]),
                        "files": files_dict
                    }
                    logger.debug(f"Adding valid entry: {entry}")
                    validated_files.append(entry)
                else:
                    logger.debug("No valid files found for this entry")
            else:
                logger.debug(f"Directory does not exist: {dir_path}")
        logger.debug(f"Final validated files: {validated_files}")
        return {"files": validated_files}
    except Exception as e:
        logger.error(f"Error in get_library: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/separate")
async def separate_audio(
    audio_file: UploadFile = File(...),
    output_options: str = Form("{}")
):
    try:
        # Generate a unique ID for this processing
        process_id = str(uuid.uuid4())
        
        # Create file paths
        file_extension = os.path.splitext(audio_file.filename)[1]
        original_path = os.path.join(VOCALS_DIR, f"original_{process_id}{file_extension}")
        
        # Save original file
        with open(original_path, "wb") as f:
            f.write(await audio_file.read())
        
        # Process the audio file
        processor = AudioProcessor()
        
        # Set up WebSocket callback
        async def progress_callback(data):
            # Broadcast progress to all connected clients
            await broadcast_progress(data)
        
        processor.set_progress_callback(progress_callback)
        
        # Parse output_options from form data if it's a string
        if isinstance(output_options, str):
            try:
                output_options = json.loads(output_options)
            except:
                output_options = {}
        
        # Ensure output_options is a dictionary
        if output_options is None:
            output_options = {}
            
        logger.debug(f"Output options: {output_options}")
        
        # Create directory for storing processed files
        process_dir = VOCALS_DIR / process_id
        process_dir.mkdir(exist_ok=True)
        
        # Perform separation
        result = await processor.process_audio(
            original_path,
            str(process_dir),
            output_options,
            progress_callback
        )
        
        # Move processed files to the directory
        file_paths = {}
        
        # Move the original file
        new_original_path = process_dir / Path(audio_file.filename).name
        shutil.copy2(original_path, new_original_path)
        file_paths["original"] = f"/audio/{quote(str(process_id))}/{quote(Path(audio_file.filename).name)}"
        
        # Move the processed files based on which options were selected
        if output_options.get("vocals") and "vocals" in result:
            new_vocals_path = process_dir / f"{Path(audio_file.filename).stem}_vocals.mp3"
            shutil.copy2(result["vocals"], new_vocals_path)
            file_paths["vocals"] = f"/audio/{quote(str(process_id))}/{quote(f'{Path(audio_file.filename).stem}_vocals.mp3')}"
        
        if output_options.get("accompaniment") and "accompaniment" in result:
            new_accompaniment_path = process_dir / f"{Path(audio_file.filename).stem}_accompaniment.mp3"
            shutil.copy2(result["accompaniment"], new_accompaniment_path)
            file_paths["accompaniment"] = f"/audio/{quote(str(process_id))}/{quote(f'{Path(audio_file.filename).stem}_accompaniment.mp3')}"
        
        if output_options.get("piano") and "piano" in result:
            new_piano_path = process_dir / f"{Path(audio_file.filename).stem}_piano.mp3"
            shutil.copy2(result["piano"], new_piano_path)
            file_paths["piano"] = f"/audio/{quote(str(process_id))}/{quote(f'{Path(audio_file.filename).stem}_piano.mp3')}"
            
            # Convert piano track to MIDI
            try:
                new_midi_path = process_dir / f"{Path(audio_file.filename).stem}.mid"
                processor.convert_to_midi(
                    result["piano"],
                    str(new_midi_path),
                    note_threshold=0.5,
                    polyphony=4,
                    min_duration=0.1
                )
                if new_midi_path.exists():
                    file_paths["midi"] = f"/audio/{quote(str(process_id))}/{quote(f'{Path(audio_file.filename).stem}.mid')}"
            except Exception as e:
                logger.error(f"Error converting to MIDI: {e}")
                # Continue without MIDI conversion - it's optional
        
        # Update processing history
        history_entry = {
            "id": process_id,
            "originalName": audio_file.filename,
            "dateProcessed": datetime.now().isoformat(),
            "directory": str(process_id),
            "files": file_paths
        }
        
        save_history(history_entry)
        
        return history_entry
        
    except Exception as e:
        logger.error(f"Error processing file: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/convert-to-midi")
async def convert_to_midi(
    file_id: str,
    note_threshold: float = 0.5,
    polyphony: int = 4,
    min_duration: float = 0.1
):
    try:
        # Load processing history
        history = load_history()
        
        # Find the file entry
        file_entry = None
        for entry in history["files"]:
            if entry["id"] == file_id:
                file_entry = entry
                break
        if not file_entry:
            raise HTTPException(status_code=404, detail="File not found")
        
        # Get piano file path
        piano_file = file_entry["files"].get("piano")
        if not piano_file:
            raise HTTPException(status_code=400, detail="No piano track available for this file")
        
        # Convert relative path to absolute
        piano_path = os.path.join(VOCALS_DIR, os.path.basename(piano_file))
        midi_path = os.path.join(VOCALS_DIR, f"piano_{file_id}.mid")
        
        # Convert to MIDI
        processor = AudioProcessor(VOCALS_DIR)
        processor.convert_to_midi(
            piano_path,
            midi_path,
            note_threshold=note_threshold,
            polyphony=polyphony,
            min_duration=min_duration
        )
        
        # Update file entry with MIDI path
        file_entry["files"]["midi"] = f"/audio/{quote(str(VOCALS_DIR))}/{quote(os.path.basename(midi_path))}"
        save_history(history)
        
        return {"message": "MIDI conversion complete", "midi_path": f"/audio/{quote(str(VOCALS_DIR))}/{quote(os.path.basename(midi_path))}"}
        
    except Exception as e:
        logger.error(f"Error converting to MIDI: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/library/{file_id}")
async def delete_file(file_id: str):
    try:
        # Load current history
        history = load_history()
        
        # Find the entry to delete
        entry = next((item for item in history["files"] if item["id"] == file_id), None)
        if not entry:
            raise HTTPException(status_code=404, detail="File not found")
            
        # Get the directory path
        dir_path = VOCALS_DIR / entry["directory"]
        
        # Remove the files and directory
        if dir_path.exists():
            shutil.rmtree(dir_path)
            
        # Remove from history
        history["files"] = [item for item in history["files"] if item["id"] != file_id]
        
        # Save updated history
        with open(HISTORY_FILE, "w", encoding='utf-8') as f:
            json.dump(history, f, ensure_ascii=False, indent=2)
            
        return {"message": "File deleted successfully"}
        
    except Exception as e:
        logger.error(f"Error deleting file: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/download-youtube")
async def download_youtube(url: str = Form(...), output_options: str = Form(...)):
    try:
        # Send initial progress update
        await broadcast_progress({"progress": 5, "message": "Starting YouTube download process..."})
        
        # Parse the output options
        options = json.loads(output_options)
        logging.debug(f"Received output options: {options}")
        
        # Generate a UUID for the processing job
        process_id = str(uuid.uuid4())
        
        # Create a temporary directory for the download using the UUID
        temp_directory_path = os.path.join(VOCALS_DIR, process_id)
        os.makedirs(temp_directory_path, exist_ok=True)
        
        # Set up the filename for the downloaded audio - no extension yet
        output_filename = os.path.join(temp_directory_path, f"{process_id}")
        
        # Send progress update
        await broadcast_progress({"progress": 10, "message": "Preparing to download from YouTube..."})
        
        # Try importing yt-dlp
        try:
            import yt_dlp
            logging.debug("Successfully imported yt_dlp module")
        except ImportError as e:
            logging.error(f"Error importing yt_dlp: {e}")
            # Try installing it on the fly
            try:
                await broadcast_progress({"progress": 15, "message": "Installing YouTube download tools..."})
                logging.info("Attempting to install yt-dlp package...")
                subprocess.check_call([sys.executable, "-m", "pip", "install", "yt-dlp"])
                import yt_dlp
                logging.info("Successfully installed and imported yt_dlp")
            except Exception as install_error:
                logging.error(f"Failed to install yt-dlp: {install_error}")
                raise HTTPException(
                    status_code=500, 
                    detail="YouTube download functionality requires yt-dlp package. Please install it with: pip install yt-dlp"
                )
        
        # Configure yt-dlp options with progress hooks
        class ProgressHook:
            def __init__(self):
                self.downloaded_bytes = 0
                self.total_bytes = 0
                self.start_time = 0
                self.download_started = False
            
            async def progress_hook(self, d):
                if d['status'] == 'downloading':
                    if not self.download_started:
                        self.download_started = True
                        self.start_time = time.time()
                        await broadcast_progress({"progress": 20, "message": "Downloading audio from YouTube..."})
                    
                    if d.get('total_bytes'):
                        self.total_bytes = d['total_bytes']
                        self.downloaded_bytes = d['downloaded_bytes']
                        progress = min(40, 20 + int(self.downloaded_bytes / self.total_bytes * 20))
                        elapsed = time.time() - self.start_time
                        speed = self.downloaded_bytes / elapsed if elapsed > 0 else 0
                        eta = (self.total_bytes - self.downloaded_bytes) / speed if speed > 0 else 0
                        
                        await broadcast_progress({
                            "progress": progress, 
                            "message": f"Downloading: {d.get('_percent_str', '0%')} at {d.get('_speed_str', '0 B/s')}, ETA: {d.get('_eta_str', 'N/A')}"
                        })
                
                elif d['status'] == 'finished':
                    await broadcast_progress({"progress": 40, "message": "Download complete, processing audio..."})
                
                elif d['status'] == 'error':
                    await broadcast_progress({"progress": 0, "message": f"Error: {d.get('error', 'Unknown error')}"})
        
        progress_hook = ProgressHook()
        
        ydl_opts = {
            'format': 'bestaudio/best',
            'postprocessors': [{
                'key': 'FFmpegExtractAudio',
                'preferredcodec': 'mp3',
                'preferredquality': '320',
            }],
            'outtmpl': output_filename,
            'quiet': False,
            'no_warnings': False,
            'progress_hooks': [progress_hook.progress_hook]
        }
        
        try:
            # Download the video
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(url, download=True)
                video_title = info.get('title', f"YouTube Video {process_id}")
                
                # Log the full info for debugging
                video_info = {
                    'title': info.get('title'),
                    'id': info.get('id'),
                    'uploader': info.get('uploader')
                }
                logging.debug(f"YouTube video info: {json.dumps(video_info)}")
                
            await broadcast_progress({"progress": 45, "message": f"Downloaded '{video_title}', preparing files..."})
        except Exception as youtube_error:
            logging.error(f"YouTube download error: {youtube_error}")
            raise HTTPException(status_code=500, detail=f"Failed to download from YouTube: {str(youtube_error)}")
        
        # List the directory contents to see what files were created
        logging.debug(f"Directory contents after download: {os.listdir(temp_directory_path)}")
        
        # Find the actual downloaded file
        actual_output_file = None
        expected_extensions = ['.mp3', '.mp3.mp3']  # Account for possible double extension
        
        for ext in expected_extensions:
            possible_file = f"{output_filename}{ext}"
            if os.path.exists(possible_file):
                actual_output_file = possible_file
                logging.debug(f"Found downloaded file at: {actual_output_file}")
                break
        
        if not actual_output_file:
            logging.error(f"Downloaded file not found. Checked paths: {[f'{output_filename}{ext}' for ext in expected_extensions]}")
            # Let's look for any mp3 file in the directory
            mp3_files = [f for f in os.listdir(temp_directory_path) if f.endswith('.mp3')]
            if mp3_files:
                actual_output_file = os.path.join(temp_directory_path, mp3_files[0])
                logging.debug(f"Found mp3 file by directory scan: {actual_output_file}")
            else:
                logging.error(f"No mp3 files found in {temp_directory_path}")
                # Create a record with just the directory info
                history_entry = {
                    "id": process_id,
                    "originalName": video_title,
                    "dateProcessed": datetime.now().isoformat(),
                    "directory": process_id,
                    "files": {
                        "original": None,
                        "vocals": None,
                        "accompaniment": None
                    }
                }
                save_history(history_entry)
                raise HTTPException(status_code=500, detail="Downloaded file not found")
        
        await broadcast_progress({"progress": 50, "message": "Creating file structure..."})
        
        # Create a directory with the video title as the name
        # Keep the original title with all characters - including Hebrew
        final_directory_name = video_title
        # If the directory already exists, append part of the UUID to make it unique
        final_directory_path = os.path.join(VOCALS_DIR, final_directory_name)
        if os.path.exists(final_directory_path):
            final_directory_name = f"{video_title}_{process_id[:8]}"
            final_directory_path = os.path.join(VOCALS_DIR, final_directory_name)
            
        # Create the directory with the video title
        try:
            os.makedirs(final_directory_path, exist_ok=True)
            logging.debug(f"Created directory with video title: {final_directory_path}")
        except Exception as e:
            logging.error(f"Error creating directory with video title: {e}")
            # Fall back to using the temp directory
            final_directory_path = temp_directory_path
            final_directory_name = process_id
        
        # Create a file with the video title as the name
        final_filename = f"{video_title}.mp3"
        new_file_path = os.path.join(final_directory_path, final_filename)
        
        try:
            # Copy the file to the new directory with the full video title
            await broadcast_progress({"progress": 55, "message": "Organizing files..."})
            shutil.copy2(actual_output_file, new_file_path)
            logging.debug(f"Copied file to: {new_file_path}")
            
            # Remove the original file and temp directory if successful
            if os.path.exists(actual_output_file) and actual_output_file != new_file_path:
                os.remove(actual_output_file)
                logging.debug(f"Removed original file: {actual_output_file}")
                
            # Remove the temporary directory if it's different from the final one
            if temp_directory_path != final_directory_path and os.path.exists(temp_directory_path):
                try:
                    shutil.rmtree(temp_directory_path)
                    logging.debug(f"Removed temporary directory: {temp_directory_path}")
                except Exception as e:
                    logging.error(f"Error removing temporary directory: {e}")
            
            # Use the new file path
            original_file_path = new_file_path
        except Exception as e:
            logging.error(f"Error copying file to final location: {str(e)}")
            # If copying fails, use the original path
            original_file_path = actual_output_file
            final_directory_path = temp_directory_path
            final_directory_name = process_id
            final_filename = os.path.basename(original_file_path)
        
        # Verify the file exists
        if not os.path.exists(original_file_path):
            logging.error(f"Final file does not exist at: {original_file_path}")
            raise HTTPException(status_code=500, detail="File created but could not be found at the expected location")
        
        # Process the downloaded audio file if requested
        if options["vocals"] or options.get("accompaniment", False):
            processor = AudioProcessor()
            
            # Create a progress callback that adjusts the progress range
            async def progress_callback(data):
                if isinstance(data, dict):
                    # Scale the progress to be between 60-100%
                    if "progress" in data:
                        scaled_progress = 60 + (data["progress"] * 0.4)  # Map 0-100 to 60-100
                        data["progress"] = min(100, scaled_progress)
                    
                    # Add note about library availability
                    if data.get("progress", 0) > 95:
                        data["message"] = f"{data.get('message', '')} (File will be available in library when complete)"
                
                await broadcast_progress(data)
            
            processor.set_progress_callback(progress_callback)
            
            # Send initial separation progress
            await broadcast_progress({"progress": 60, "message": "Beginning audio separation... (This may take some time)"})
            
            # Generate output paths for vocals and accompaniment
            vocals_filename = f"{os.path.splitext(final_filename)[0]}_vocals.mp3"
            accompaniment_filename = f"{os.path.splitext(final_filename)[0]}_accompaniment.mp3"
            
            # Process the audio file
            result = await processor.process_audio(
                original_file_path,
                final_directory_path,
                options
            )
            
            # Save to history - with all the correct paths
            history_entry = {
                "id": process_id,
                "originalName": video_title,
                "dateProcessed": datetime.now().isoformat(),
                "directory": final_directory_name,
                "files": {
                    "original": f"/audio/{quote(final_directory_name)}/{quote(final_filename)}",
                    "vocals": f"/audio/{quote(final_directory_name)}/{quote(vocals_filename)}" if result.get("vocals") else None,
                    "accompaniment": f"/audio/{quote(final_directory_name)}/{quote(accompaniment_filename)}" if result.get("accompaniment") else None
                }
            }
            save_history(history_entry)
            
            # Log the history entry for debugging
            logging.debug(f"Created history entry: {history_entry}")
            
            # Final progress update
            await broadcast_progress({"progress": 100, "message": "Processing complete! File is now available in your library."})
            
            # Prepare the response
            response = {
                "id": process_id,
                "title": video_title,
                "original": f"/audio/{quote(final_directory_name)}/{quote(final_filename)}",
                "vocals": f"/audio/{quote(final_directory_name)}/{quote(vocals_filename)}" if result.get("vocals") else None,
                "accompaniment": f"/audio/{quote(final_directory_name)}/{quote(accompaniment_filename)}" if result.get("accompaniment") else None
            }
            
            # Log the response for debugging
            logging.debug(f"Response: {response}")
            
            return response
        else:
            # No separation requested, just download
            await broadcast_progress({"progress": 90, "message": "Finalizing download..."})
            
            # Save to history even if not processing
            history_entry = {
                "id": process_id,
                "originalName": video_title,
                "dateProcessed": datetime.now().isoformat(),
                "directory": final_directory_name,
                "files": {
                    "original": f"/audio/{quote(final_directory_name)}/{quote(final_filename)}",
                    "vocals": None,
                    "accompaniment": None
                }
            }
            save_history(history_entry)
            
            # Log the history entry for debugging
            logging.debug(f"Created history entry: {history_entry}")
            
            # Final update
            await broadcast_progress({"progress": 100, "message": "Download complete! File is now available in your library."})
            
            # Prepare the response for download only
            response = {
                "id": process_id,
                "title": video_title,
                "original": f"/audio/{quote(final_directory_name)}/{quote(final_filename)}",
                "vocals": None,
                "accompaniment": None
            }
            
            # Log the response for debugging
            logging.debug(f"Response: {response}")
            
            return response
            
    except Exception as e:
        logging.error(f"Error in download_youtube: {str(e)}")
        logging.exception(e)
        # Send error message to client
        await broadcast_progress({"progress": 0, "message": f"Error: {str(e)}"})
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/check-chords-cache")
async def check_chords_cache(file_id: str, simplicity_preference: float = 0.5):
    """
    Lightweight endpoint to check if chords exist in cache for a file.
    Returns immediately without any heavy processing.
    """
    try:
        logger.debug(f"Checking chord cache for file ID: {file_id}, simplicity preference: {simplicity_preference}")
        history = load_history()
        
        # Find file entry
        file_entry = None
        for entry in history["files"]:
            if entry.get("id") == file_id:
                file_entry = entry
                break
                
        if not file_entry:
            logger.debug(f"File ID not found: {file_id}")
            return {
                "fileId": file_id,
                "hasChords": False,
                "cached": False
            }
        
        # Check if chords exist with matching simplicity preference
        pref_str = f"{simplicity_preference:.1f}"
        has_chords = (
            file_entry.get("chords") and 
            file_entry.get("simplicity_preference") == pref_str and
            len(file_entry.get("chords", [])) > 0
        )
        
        if has_chords:
            logger.debug(f"Found cached chords for file ID: {file_id} with preference {pref_str}")
            return {
                "fileId": file_id,
                "fileName": file_entry.get("originalName", ""),
                "hasChords": True,
                "cached": True,
                "chordsCount": len(file_entry.get("chords", [])),
                "detected_bpm": file_entry.get("detected_bpm", 120),
                "beats": file_entry.get("beats", []),
                "downbeats": file_entry.get("downbeats", [])
            }
        else:
            logger.debug(f"No cached chords found for file ID: {file_id} with preference {pref_str}")
            return {
                "fileId": file_id,
                "fileName": file_entry.get("originalName", ""),
                "hasChords": False,
                "cached": False
            }
            
    except Exception as e:
        logger.error(f"Error checking chord cache: {str(e)}")
        return {
            "fileId": file_id,
            "hasChords": False,
            "cached": False,
            "error": str(e)
        }

@app.post("/api/detect-chords")
async def detect_chords(file_id: str, segment_duration: float = 2.0, simplicity_preference: float = 0.0, force: bool = Query(False)):
    """
    Detect chords in an audio file using the ChordDetector, fetch lyrics, and sync chords to lyrics.
    Note: segment_duration is ignored by the Advanced detector but kept for API compatibility.
    """
    try:
        logger.debug(f"Detecting chords for file ID: {file_id}, simplicity preference: {simplicity_preference}")
        history = load_history()
        file_entry = None
        for entry in history["files"]:
            if entry.get("id") == file_id:
                file_entry = entry
                break
        if not file_entry:
            logger.error(f"File ID not found: {file_id}")
            raise HTTPException(status_code=404, detail=f"File ID not found: {file_id}")
        pref_str = f"{simplicity_preference:.1f}"
        logger.debug(f"Looking for cached chords with simplicity preference: {pref_str}")
        if file_entry.get("chords") and file_entry.get("simplicity_preference") == pref_str and not force:
            logger.debug(f"Found existing chord data for file ID: {file_id} with matching preference")
            logger.debug(f"File entry has lyrics: {'lyrics' in file_entry}")
            logger.debug(f"Lyrics count: {len(file_entry.get('lyrics', []))}")
            logger.debug(f"File entry has mapping: {'lyric_to_chord_mapping' in file_entry}")
            return {
                "fileId": file_id,
                "fileName": file_entry.get("originalName", ""),
                "chords": file_entry.get("chords"),
                "lyrics": file_entry.get("lyrics", []),
                "lyric_to_chord_mapping": file_entry.get("lyric_to_chord_mapping", {}),
                "detected_bpm": file_entry.get("detected_bpm", 120),
                "beats": file_entry.get("beats", []),
                "downbeats": file_entry.get("downbeats", []),
                "cached": True
            }
        # Get audio path (existing logic)
        directory = file_entry.get("directory", "")
        original_name = file_entry.get("originalName", "")
        audio_path = None
        if file_entry.get("files", {}).get("original"):
            original_rel_path = file_entry["files"]["original"]
            rel_path = original_rel_path[7:] if original_rel_path.startswith("/audio/") else original_rel_path.lstrip('/')
            audio_path = VOCALS_DIR / rel_path
        if not audio_path or not audio_path.exists():
            try:
                direct_path = VOCALS_DIR / directory / original_name
                if direct_path.exists():
                    audio_path = direct_path
            except Exception as e:
                logger.error(f"Error constructing alternative path: {e}")
        if not audio_path or not audio_path.exists():
            dir_path = VOCALS_DIR / directory
            if dir_path.exists():
                all_mp3_files = list(dir_path.glob("*.mp3"))
                potential_originals = [
                    f for f in all_mp3_files 
                    if not (f.name.endswith("_vocals.mp3") or f.name.endswith("_accompaniment.mp3") or f.name.endswith("_piano.mp3"))
                ]
                if potential_originals:
                    audio_path = potential_originals[0]
        if not audio_path or not audio_path.exists():
            error_message = f"Audio file not found. Original track is required for chord detection."
            logger.error(error_message)
            raise HTTPException(status_code=404, detail=error_message)
        # Always set chord bias
        chord_detector.chord_bias = {
            'major': 0.0,
            'minor': 0.0,
            '7': -0.15 * simplicity_preference,
            'maj7': -0.2 * simplicity_preference,
            'min7': -0.15 * simplicity_preference,
        }
        logger.debug(f"Using custom chord bias: {chord_detector.chord_bias}")
        # Async progress callback wrapper for Advanced detector
        def sync_progress_callback(message):
            # Advanced detector only sends message, we'll estimate progress based on message content
            progress = 50  # Default progress
            if "Initializing" in message:
                progress = 10
            elif "Converting" in message:
                progress = 20
            elif "BTC-ISMIR19" in message:
                progress = 40
            elif "autochord" in message:
                progress = 60
            elif "Combining" in message:
                progress = 80
            elif "complete" in message:
                progress = 100
            
            coro = broadcast_progress({
                "type": "chord_detection",
                "status": "processing",
                "message": message,
                "fileId": file_id,
                "progress": progress
            })
            try:
                loop = asyncio.get_event_loop()
                if loop.is_running():
                    asyncio.ensure_future(coro)
                else:
                    loop.run_until_complete(coro)
            except Exception as e:
                logger.error(f"Error in progress callback: {e}")
        # Detect chords
        logger.debug(f"Starting chord detection with audio path: {audio_path}")
        detected_chords = chord_detector.detect_chords(
            audio_path=str(audio_path),
            segment_duration=segment_duration,
            progress_callback=sync_progress_callback
        )
        logger.debug(f"Chord detection complete: {detected_chords}")
        
        # Detect BPM/tempo
        logger.debug(f"Starting BPM detection with audio path: {audio_path}")
        beat_structure = detect_beat_structure(str(audio_path))
        detected_bpm = beat_structure.get("tempo", 120)
        logger.debug(f"BPM detection complete: {detected_bpm} BPM")
        logger.debug(f"Beat structure result: {beat_structure}")
        
        await broadcast_progress({
            "type": "chord_detection",
            "status": "complete",
            "message": "Chord detection complete",
            "fileId": file_id,
            "progress": 100
        })
        # Lyrics and chord mapping logic (simplified)
        try:
            lyric_lines = file_entry.get("lyrics")
            if lyric_lines and isinstance(lyric_lines, list) and any(l.strip() for l in lyric_lines):
                lyrics = "\n".join(lyric_lines)
                logger.debug("Using cached lyrics from file entry.")
            else:
                import re
                name = re.sub(r'\.[^/.]+$', '', original_name)
                artist = ""
                title = name
                logger.debug(f"Parsing filename: {original_name} -> {name}")
                if "-" in name:
                    parts = name.split("-", 1)
                    artist = parts[0].strip()
                    title = parts[1].strip()
                    logger.debug(f"Split into artist: '{artist}', title: '{title}'")
                    
                    # Clean up common suffixes that prevent lyrics matching
                    title = re.sub(r'\s*\((Audio|Official Video|Official Music Video|Lyric Video|Live|Acoustic|Remastered|HD|4K)\)\s*$', '', title, flags=re.IGNORECASE)
                    title = re.sub(r'\s*\[(Audio|Official Video|Official Music Video|Lyric Video|Live|Acoustic|Remastered|HD|4K)\]\s*$', '', title, flags=re.IGNORECASE)
                    title = title.strip()
                    logger.debug(f"Cleaned title: '{title}'")
                
                lyrics = None
                if artist and title:
                    logger.debug(f"Fetching lyrics for artist: '{artist}', title: '{title}'")
                    lyrics = get_lyrics_for_song(artist, title)
                    if lyrics:
                        logger.debug(f"Successfully fetched lyrics, length: {len(lyrics)} characters")
                    else:
                        logger.info(f"No lyrics found for {artist}/{title} from any source")
                else:
                    logger.info(f"Skipping lyrics fetch for invalid artist/title: {artist}/{title}")
        except Exception as e:
            logger.error(f"Error during lyrics fetch: {e}", exc_info=True)
            lyrics = None
        
        lyric_lines = [l for l in (lyrics or '').split('\n') if l.strip() or l.startswith('[') and l.endswith(']')]
        
        # Create chord-to-lyrics mapping for display above lyrics
        lyric_to_chord_mapping = {}
        if lyric_lines and detected_chords:
            lyric_to_chord_mapping = create_lyric_to_chord_mapping(lyric_lines, detected_chords)
        
        # Update file entry with results
        for entry in history["files"]:
            if entry.get("id") == file_id:
                entry["chords"] = detected_chords
                entry["simplicity_preference"] = pref_str
                entry["lyrics"] = lyric_lines
                entry["lyric_to_chord_mapping"] = lyric_to_chord_mapping
                entry["detected_bpm"] = detected_bpm
                entry["beats"] = beat_structure.get("beats", [])
                entry["downbeats"] = beat_structure.get("downbeats", [])
                entry["enhanced_chords"] = beat_structure.get("enhanced_chords")
                entry["time_signature"] = beat_structure.get("time_signature")
                entry["tempo_stability"] = beat_structure.get("tempo_stability")
                entry["rhythmic_complexity"] = beat_structure.get("rhythmic_complexity")
                break
        try:
            with open(HISTORY_FILE, "w", encoding='utf-8') as f:
                json_data = json.dumps(history, ensure_ascii=False, indent=2)
                f.write(json_data)
        except Exception as save_error:
            logger.error(f"Error saving chord/lyrics data to history: {save_error}", exc_info=True)
        
        logger.debug(f"About to return response with detected_bpm: {detected_bpm}")
        return {
            "fileId": file_id,
            "fileName": file_entry.get("originalName", ""),
            "chords": detected_chords,
            "lyrics": lyric_lines,
            "lyric_to_chord_mapping": lyric_to_chord_mapping,
            "detected_bpm": detected_bpm,
            "beats": beat_structure.get("beats", []),
            "downbeats": beat_structure.get("downbeats", []),
            "enhanced_chords": beat_structure.get("enhanced_chords"),
            "time_signature": beat_structure.get("time_signature"),
            "tempo_stability": beat_structure.get("tempo_stability"),
            "rhythmic_complexity": beat_structure.get("rhythmic_complexity"),
            "cached": False
        }
    except Exception as e:
        logger.error(f"Error in chord detection: {str(e)}", exc_info=True)
        await broadcast_progress({
            "type": "chord_detection",
            "status": "error",
            "message": str(e),
            "fileId": file_id,
            "progress": 0
        })
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/analyze-live-audio")
async def analyze_live_audio(
    audio_file: UploadFile = File(...), 
    simplicity_preference: float = 0.5,
    save_to_library: str = Form("false")
):
    """
    Analyze live captured audio for chord detection and optionally save to library
    """
    try:
        logger.info(f"[live-audio] Starting live audio analysis, save_to_library: {save_to_library}")
        
        # Create temporary file for the uploaded audio
        temp_file_id = str(uuid.uuid4())
        temp_dir = VOCALS_DIR / "temp" / temp_file_id
        temp_dir.mkdir(parents=True, exist_ok=True)
        
        # Save the uploaded file
        audio_content = await audio_file.read()
        temp_audio_path = temp_dir / "live_capture.webm"
        
        with open(temp_audio_path, "wb") as f:
            f.write(audio_content)
        
        logger.info(f"[live-audio] Saved audio to: {temp_audio_path}")
        
        # Convert webm to wav if needed
        wav_path = temp_dir / "live_capture.wav"
        try:
            # Use ffmpeg to convert webm to wav with better parameters
            result = subprocess.run([
                "ffmpeg", "-i", str(temp_audio_path), 
                "-acodec", "pcm_s16le",  # Ensure PCM 16-bit encoding
                "-ar", "44100", "-ac", "1", 
                "-f", "wav",  # Force WAV format
                str(wav_path), "-y"
            ], check=True, capture_output=True, text=True)
            logger.info(f"[live-audio] Converted to WAV: {wav_path}")
            logger.info(f"[live-audio] FFmpeg stdout: {result.stdout}")
            
            # Check if conversion was successful
            if wav_path.exists() and wav_path.stat().st_size > 0:
                logger.info(f"[live-audio] WAV file created successfully, size: {wav_path.stat().st_size} bytes")
            else:
                logger.warning(f"[live-audio] WAV file not created or empty, using original file")
                wav_path = temp_audio_path
                
        except subprocess.CalledProcessError as e:
            logger.error(f"[live-audio] FFmpeg conversion failed: {e}")
            logger.error(f"[live-audio] FFmpeg stderr: {e.stderr}")
            # Try to use the original file if conversion fails
            wav_path = temp_audio_path
        
        logger.info(f"[live-audio] Analyzing chords with simplicity preference: {simplicity_preference}")
        
        # Check audio file before chord detection
        logger.info(f"[live-audio] Audio file to analyze: {wav_path}")
        logger.info(f"[live-audio] File exists: {wav_path.exists()}")
        if wav_path.exists():
            logger.info(f"[live-audio] File size: {wav_path.stat().st_size} bytes")
            
            # Try to get audio info using librosa
            try:
                import librosa
                import numpy as np
                y, sr = librosa.load(str(wav_path), sr=None)
                duration = len(y) / sr
                logger.info(f"[live-audio] Audio duration: {duration:.2f} seconds")
                logger.info(f"[live-audio] Sample rate: {sr} Hz")
                logger.info(f"[live-audio] Audio samples: {len(y)}")
                logger.info(f"[live-audio] Audio max amplitude: {np.max(np.abs(y)):.6f}")
                
                if duration < 0.5:
                    logger.warning(f"[live-audio] Audio too short for chord detection: {duration:.2f}s")
                if np.max(np.abs(y)) < 0.001:
                    logger.warning(f"[live-audio] Audio amplitude very low: {np.max(np.abs(y)):.6f}")
                    
            except Exception as audio_info_error:
                logger.error(f"[live-audio] Could not analyze audio file: {audio_info_error}")
        
        # Detect chords from the live audio
        detected_chords = chord_detector.detect_chords(
            str(wav_path),
            segment_duration=1.0,  # Shorter segments for live analysis
            simplicity_preference=simplicity_preference
        )
        
        logger.info(f"[live-audio] Detected {len(detected_chords)} chord sections")
        
        # Prepare response
        response = {
            "success": True,
            "chords": detected_chords,
            "duration": detected_chords[-1]["endTime"] if detected_chords else 0,
            "chord_count": len(detected_chords),
            "message": f"Successfully analyzed {len(detected_chords)} chord sections from live audio"
        }
        
        # Save to library if requested
        logger.info(f"[live-audio] save_to_library parameter: '{save_to_library}' (type: {type(save_to_library)})")
        logger.info(f"[live-audio] save_to_library.lower() == 'true': {save_to_library.lower() == 'true'}")
        
        # FORCE SAVE FOR DEBUGGING - Always save to library regardless of parameter
        logger.info(f"[live-audio] FORCING SAVE TO LIBRARY FOR DEBUGGING")
        try:
            logger.info(f"[live-audio] ENTERING SAVE LOGIC")
            # Create Live Captures subdirectory for better organization
            live_captures_dir = VOCALS_DIR / "Live Captures"
            live_captures_dir.mkdir(exist_ok=True)
            
            # Generate unique ID and create individual directory
            process_id = str(uuid.uuid4())
            library_dir = live_captures_dir / process_id
            library_dir.mkdir(exist_ok=True)
            
            # Copy original file to library with proper name
            original_filename = audio_file.filename or f"Live Recording {datetime.now().strftime('%Y-%m-%d %H-%M-%S')}.webm"
            library_audio_path = library_dir / original_filename
            shutil.copy2(temp_audio_path, library_audio_path)
            
            # Create history entry with Live Captures path
            history_entry = {
                "id": process_id,
                "originalName": original_filename,
                "dateProcessed": datetime.now().isoformat(),
                "directory": f"Live Captures/{process_id}",
                "source": "live_recording",  # Mark as live recording
                "files": {
                    "original": f"/audio/{quote('Live Captures')}/{quote(str(process_id))}/{quote(original_filename)}",
                    "vocals": None,
                    "accompaniment": None,
                    "piano": None
                },
                "chords": detected_chords,
                "simplicity_preference": f"{simplicity_preference:.1f}",
                "detected_bpm": 120,  # Default BPM for live recordings
                "beats": [],
                "downbeats": []
            }
            
            save_history(history_entry)
            
            response["saved_to_library"] = True
            response["library_entry"] = {
                "id": process_id,
                "name": original_filename,
                "path": f"/audio/{quote('Live Captures')}/{quote(str(process_id))}/{quote(original_filename)}"
            }
            
            logger.info(f"[live-audio] Saved recording to library: {library_audio_path}")
            
        except Exception as save_error:
            logger.error(f"[live-audio] Failed to save to library: {save_error}")
            response["saved_to_library"] = False
            response["save_error"] = str(save_error)
        
        # Clean up temporary files
        try:
            shutil.rmtree(temp_dir)
            logger.info(f"[live-audio] Cleaned up temporary directory: {temp_dir}")
        except Exception as cleanup_error:
            logger.warning(f"[live-audio] Failed to clean up temp files: {cleanup_error}")
        
        return response
        
    except Exception as e:
        logger.error(f"[live-audio] Error analyzing live audio: {str(e)}", exc_info=True)
        
        # Clean up on error
        try:
            if 'temp_dir' in locals() and temp_dir.exists():
                shutil.rmtree(temp_dir)
        except:
            pass
            
        raise HTTPException(status_code=500, detail=f"Failed to analyze live audio: {str(e)}")

class RenameRequest(BaseModel):
    file_id: str
    new_name: str

@app.post("/api/rename-file")
def rename_file(req: RenameRequest):
    history = load_history()
    files = history.get("files", [])
    entry = next((item for item in files if item.get("id") == req.file_id), None)
    if not entry:
        raise HTTPException(status_code=404, detail="File not found in history")
    old_name = entry.get("originalName")
    if not old_name:
        raise HTTPException(status_code=400, detail="No original name in entry")
    ext = os.path.splitext(old_name)[1]
    new_name = req.new_name.strip() + ext
    # Check for name conflict
    for f in files:
        if f.get("originalName") == new_name and f.get("id") != req.file_id:
            raise HTTPException(status_code=400, detail="A file with this name already exists")
    old_dir = VOCALS_DIR / entry["directory"]
    new_dir_name = entry["directory"]
    old_base = os.path.splitext(old_name)[0]
    new_base = os.path.splitext(new_name)[0]
    # If directory name is exactly the old_base, rename it
    if entry["directory"] == old_base:
        new_dir_name = new_base
        new_dir = VOCALS_DIR / new_dir_name
        if new_dir.exists():
            raise HTTPException(status_code=400, detail="A folder with the new name already exists")
        try:
            shutil.move(str(old_dir), str(new_dir))
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to rename folder: {e}")
        entry["directory"] = new_dir_name
    else:
        new_dir = old_dir
    # Robustly rename all files in the directory that start with the old base name
    for f in new_dir.iterdir():
        if f.is_file():
            fname = f.name
            # If the file starts with the old base name, rename it
            if fname.startswith(old_base):
                new_fname = fname.replace(old_base, new_base, 1)
                new_fpath = new_dir / new_fname
                if not new_fpath.exists():
                    f.rename(new_fpath)

    # After renaming, rescan the directory for all expected tracks
    expected_files = {
        "original": f"{new_base}{ext}",
        "vocals": f"{new_base}_vocals.mp3",
        "accompaniment": f"{new_base}_accompaniment.mp3",
        "piano": f"{new_base}_piano.mp3",
        "midi": f"{new_base}.mid"
    }
    files_mapping = {}
    for key, fname in expected_files.items():
        fpath = new_dir / fname
        if fpath.exists():
            files_mapping[key] = f"/audio/{quote(str(new_dir_name))}/{quote(fname)}"
        else:
            files_mapping[key] = None
    entry["files"] = files_mapping

    save_path = HISTORY_FILE
    with open(save_path, "w", encoding="utf-8") as f:
        json.dump(history, f, ensure_ascii=False, indent=2)
    return {"status": "ok", "new_name": new_name}

class LyricsRequest(BaseModel):
    artist: str
    title: str

@app.post("/api/lyrics")
async def get_lyrics(request: LyricsRequest):
    """
    Fetch lyrics for a song by trying multiple sources.
    Returns the lyrics and any available metadata.
    """
    try:
        logger.info(f"API: Attempting to fetch lyrics for '{request.title}' by '{request.artist}'")
        lyrics = get_lyrics_for_song(request.artist, request.title)
        logger.info(f"API: get_lyrics_for_song returned: {type(lyrics)}, length: {len(lyrics) if lyrics else 0}")
        if not lyrics:
            logger.error(f"API: No lyrics found for '{request.title}' by '{request.artist}'")
            raise HTTPException(
                status_code=404,
                detail=f"Could not find lyrics for {request.title} by {request.artist}"
            )
        
        # Clean the lyrics to remove metadata
        lyrics = clean_lyrics(lyrics)
        logger.info(f"API: Cleaned lyrics length: {len(lyrics)}")
        
        logger.info(f"API: Successfully found lyrics for '{request.title}' by '{request.artist}'")
        return {
            "title": request.title,
            "artist": request.artist,
            "lyrics": lyrics,
            "source": "genius" if any(ord(c) > 127 for c in request.artist + request.title) else "azlyrics"
        }
    except Exception as e:
        logger.error(f"API: Error fetching lyrics: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Error fetching lyrics: {str(e)}"
        )

class FileLyricsRequest(BaseModel):
    file_id: str

@app.post("/api/file-lyrics")
async def get_file_lyrics(request: FileLyricsRequest):
    """
    Fetch lyrics for a specific file by trying multiple sources.
    Returns the lyrics and chord-to-lyrics mapping for display.
    """
    try:
        # Load the file history to get the file info
        history = load_history()
        file_entry = None
        
        for entry in history["files"]:
            if entry.get("id") == request.file_id:
                file_entry = entry
                break

        if not file_entry:
            raise HTTPException(status_code=404, detail=f"File ID not found: {request.file_id}")

        # Check if lyrics already exist in the file entry
        existing_lyrics = file_entry.get("lyrics")
        logger.debug(f"[file-lyrics] File entry keys: {list(file_entry.keys())}")
        logger.debug(f"[file-lyrics] Existing lyrics type: {type(existing_lyrics)}, length: {len(existing_lyrics) if existing_lyrics else 0}")
        if existing_lyrics and isinstance(existing_lyrics, list):
            logger.debug(f"[file-lyrics] First few lyrics lines: {existing_lyrics[:3] if len(existing_lyrics) > 0 else 'empty'}")
        
        if existing_lyrics and isinstance(existing_lyrics, list) and any(l.strip() for l in existing_lyrics):
            logger.info(f"[file-lyrics] Using existing lyrics from file entry: {len(existing_lyrics)} lines")
            lyrics = "\n".join(existing_lyrics)
            lyric_lines = existing_lyrics
            
            # Get stored artist/title or parse from filename
            artist = file_entry.get("lyrics_artist", "")
            title = file_entry.get("lyrics_title", "")
            
            if not artist or not title:
                # Parse from filename as fallback
                directory_name = file_entry.get("directory", "")
                original_name = file_entry.get("originalName", "")
                name = directory_name if directory_name else re.sub(r'\.[^/.]+$', '', original_name)
                
                if "-" in name:
                    parts = name.split("-", 1)
                    artist = parts[0].strip()
                    title = parts[1].strip()
                    
                    # Clean up common suffixes
                    title = re.sub(r'\s*\((Audio|Official Video|Official Music Video|Lyric Video|Live|Acoustic|Remastered|HD|4K)\)\s*$', '', title, flags=re.IGNORECASE)
                    title = re.sub(r'\s*\[(Audio|Official Video|Official Music Video|Lyric Video|Live|Acoustic|Remastered|HD|4K)\]\s*$', '', title, flags=re.IGNORECASE)
                    title = title.strip()
            
            detected_chords = file_entry.get("chords")
            logger.info(f"[file-lyrics] Using existing data - artist: '{artist}', title: '{title}', chords: {len(detected_chords) if detected_chords else 0}")

            # Create chord-to-lyrics mapping for display above lyrics
            lyric_to_chord_mapping = {}
            if lyric_lines and detected_chords:
                lyric_to_chord_mapping = create_lyric_to_chord_mapping(lyric_lines, detected_chords)
                file_entry["lyric_to_chord_mapping"] = lyric_to_chord_mapping

            return {
                "fileId": request.file_id,
                "title": title,
                "artist": artist,
                "lyrics": lyrics,
                "chords": detected_chords or [],
                "lyric_to_chord_mapping": lyric_to_chord_mapping,
                "source": "cached",
                "detected_bpm": file_entry.get("detected_bpm", 120)
            }

        # If no existing lyrics, proceed with fetching new ones
        logger.info(f"[file-lyrics] No existing lyrics found, fetching new ones")
        
        # Parse artist/title from filename
        directory_name = file_entry.get("directory", "")
        original_name = file_entry.get("originalName", "")
        name = directory_name if directory_name else re.sub(r'\.[^/.]+$', '', original_name)
        
        if "-" in name:
            parts = name.split("-", 1)
            artist = parts[0].strip()
            title = parts[1].strip()
            
            # Clean up common suffixes that prevent lyrics matching
            title = re.sub(r'\s*\((Audio|Official Video|Official Music Video|Lyric Video|Live|Acoustic|Remastered|HD|4K)\)\s*$', '', title, flags=re.IGNORECASE)
            title = re.sub(r'\s*\[(Audio|Official Video|Official Music Video|Lyric Video|Live|Acoustic|Remastered|HD|4K)\]\s*$', '', title, flags=re.IGNORECASE)
            title = title.strip()
        else:
            raise HTTPException(status_code=400, detail="Could not parse artist and title from filename")

        # Try to fetch lyrics
        lyrics = get_lyrics_for_song(artist, title)
        if not lyrics:
            raise HTTPException(status_code=404, detail=f"Could not find lyrics for {title} by {artist}")

        lyrics = clean_lyrics(lyrics)
        lyric_lines = lyrics.split('\n')

        # Update the file entry with the lyrics
        file_entry["lyrics"] = lyric_lines
        file_entry["lyrics_artist"] = artist
        file_entry["lyrics_title"] = title

        detected_chords = file_entry.get("chords")

        # Create chord-to-lyrics mapping for display above lyrics
        lyric_to_chord_mapping = {}
        if lyric_lines and detected_chords:
            lyric_to_chord_mapping = create_lyric_to_chord_mapping(lyric_lines, detected_chords)
            file_entry["lyric_to_chord_mapping"] = lyric_to_chord_mapping

        # Save the updated history
        try:
            with open(HISTORY_FILE, "w", encoding='utf-8') as f:
                json.dump(history, f, ensure_ascii=False, indent=2)
        except Exception as save_error:
            logger.error(f"Error saving lyrics to history: {save_error}")

        return {
            "fileId": request.file_id,
            "title": title,
            "artist": artist,
            "lyrics": lyrics,
            "chords": detected_chords or [],
            "lyric_to_chord_mapping": lyric_to_chord_mapping,
            "source": "genius" if any(ord(c) > 127 for c in artist + title) else "azlyrics",
            "detected_bpm": file_entry.get("detected_bpm", 120)
        }

    except Exception as e:
        logger.error(f"Error fetching lyrics: {str(e)}")
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=str(e))

# Add a test endpoint for audio file accessibility
@app.get("/api/test-audio/{file_id}")
async def test_audio_file(file_id: str):
    """Test endpoint to check if audio files are accessible"""
    try:
        # Get library data using the same method as get_library
        history = load_history()
        valid_files = []
        
        for entry in history.get("files", []):
            # Check if directory exists
            entry_dir = VOCALS_DIR / entry["directory"]
            if entry_dir.exists():
                files_dict = {}
                
                # Check each track type
                for track_type in ["original", "vocals", "accompaniment", "piano"]:
                    track_path = None
                    
                    if track_type == "original":
                        # For original, look for the main file
                        original_path = entry_dir / entry["originalName"]
                        if original_path.exists():
                            track_path = f"/audio/{entry['directory']}/{entry['originalName']}"
                    else:
                        # For other tracks, look for processed files
                        base_name = Path(entry["originalName"]).stem
                        track_filename = f"{base_name}_{track_type}.mp3"
                        track_file_path = entry_dir / track_filename
                        if track_file_path.exists():
                            track_path = f"/audio/{entry['directory']}/{track_filename}"
                    
                    files_dict[track_type] = track_path

                entry_copy = entry.copy()
                entry_copy["files"] = files_dict
                valid_files.append(entry_copy)
        
        # Find the specific file
        file_entry = None
        for entry in valid_files:
            if entry.get('id') == file_id:
                file_entry = entry
                break
        
        if not file_entry:
            raise HTTPException(status_code=404, detail=f"File with ID {file_id} not found")
        
        # Check all file paths
        files_info = {}
        for track_type in ['original', 'vocals', 'accompaniment', 'piano']:
            file_path = file_entry.get('files', {}).get(track_type)
            if file_path:
                # Convert to full file system path
                full_path = VOCALS_DIR / file_path.lstrip('/audio/')
                files_info[track_type] = {
                    'url': f"http://localhost:8000{file_path}",
                    'path': str(full_path),
                    'exists': full_path.exists(),
                    'size': full_path.stat().st_size if full_path.exists() else None
                }
        
        return {
            "file_id": file_id,
            "original_name": file_entry.get('originalName'),
            "files": files_info
        }
        
    except Exception as e:
        logger.error(f"Error testing audio file {file_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Add this at the end of the file
if __name__ == "__main__":
       import uvicorn
       import os
       
       # Use Railway's PORT environment variable, fallback to 8000 for local dev
       port = int(os.environ.get("PORT", 8000))
       
       uvicorn.run(app, host="0.0.0.0", port=port)
