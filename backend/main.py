from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
import tempfile
import os
from pathlib import Path
import logging
import asyncio

from processor import AudioProcessor
from chord_detector_advanced import AdvancedChordDetector
from lyrics_utils import get_lyrics_for_song, clean_lyrics

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

# Initialize processors
audio_processor = AudioProcessor()
chord_detector = AdvancedChordDetector()


@app.get("/api/health")
async def health_check():
    return {"status": "healthy"}


@app.post("/api/separate")
async def separate_audio(
    file: UploadFile = File(...),
    extract_vocals: bool = Form(True),
    extract_accompaniment: bool = Form(True)
):
    """Separate vocals and accompaniment from audio file"""
    try:
        # Save uploaded file
        with tempfile.NamedTemporaryFile(delete=False, suffix=Path(file.filename).suffix) as tmp:
            content = await file.read()
            tmp.write(content)
            input_path = tmp.name
        
        output_dir = tempfile.mkdtemp()
        
        logger.info(f"Processing: {file.filename}")
        
        results = await audio_processor.process_audio(
            input_path,
            output_dir,
            {
                'vocals': extract_vocals,
                'accompaniment': extract_accompaniment
            }
        )
        
        os.unlink(input_path)
        
        return {
            "success": True,
            "vocals_path": results.get('vocals'),
            "accompaniment_path": results.get('accompaniment')
        }
        
    except Exception as e:
        logger.error(f"Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/download/{file_path:path}")
async def download_file(file_path: str):
    """Download processed file"""
    if os.path.exists(file_path):
        return FileResponse(file_path, filename=Path(file_path).name)
    raise HTTPException(status_code=404, detail="File not found")


@app.post("/api/chords")
async def detect_chords(file: UploadFile = File(...)):
    """Detect chords from audio file"""
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=Path(file.filename).suffix) as tmp:
            content = await file.read()
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
        
        return {"success": True, "chords": formatted}
        
    except Exception as e:
        logger.error(f"Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/lyrics")
async def fetch_lyrics(song: str = Form(...), artist: str = Form(...)):
    """Fetch lyrics for a song"""
    try:
        logger.info(f"Fetching lyrics: {song} by {artist}")
        lyrics = get_lyrics_for_song(song, artist)
        
        if lyrics:
            cleaned = clean_lyrics(lyrics)
            return {"success": True, "lyrics": cleaned, "song": song, "artist": artist}
        else:
            return {"success": False, "message": "Lyrics not found"}
            
    except Exception as e:
        logger.error(f"Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
