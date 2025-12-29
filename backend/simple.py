from fastapi import FastAPI, UploadFile, File, HTTPException, WebSocket, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
from pathlib import Path
import json
import os
import logging
import uuid
from datetime import datetime
from typing import Dict, List, Optional

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create the FastAPI app
app = FastAPI()

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:5174"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Define paths
BASE_DIR = Path(__file__).parent
VOCALS_DIR = Path.home() / "Downloads" / "Vocals"
VOCALS_DIR.mkdir(exist_ok=True, parents=True)
HISTORY_FILE = VOCALS_DIR / "processing_history.json"

# Mount static files
app.mount("/audio", StaticFiles(directory=str(VOCALS_DIR)), name="audio")

# Store active WebSocket connections
active_connections: Dict[int, WebSocket] = {}

def load_history():
    """Load processing history"""
    if HISTORY_FILE.exists():
        try:
            with open(HISTORY_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            logger.error(f"Error loading history: {e}")
    return {"files": []}

def save_history(history):
    """Save processing history"""
    try:
        with open(HISTORY_FILE, "w", encoding="utf-8") as f:
            json.dump(history, f, ensure_ascii=False, indent=2)
    except Exception as e:
        logger.error(f"Error saving history: {e}")

@app.get("/")
async def root():
    return {"message": "Welcome to Simplified Vocal Separator API", "status": "running"}

@app.get("/api/ping")
async def ping():
    return {"status": "ok", "message": "Backend server is up and running"}

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

@app.get("/api/library")
async def get_library():
    """Get the processed files library"""
    try:
        history = load_history()
        return history
    except Exception as e:
        logger.error(f"Error getting library: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/separate")
async def separate_audio(
    audio_file: UploadFile = File(...),
    output_options: str = Form(None)
):
    """
    Simplified implementation that just creates placeholder files 
    for demonstration purposes
    """
    try:
        # Parse output options
        options = {}
        if output_options:
            options = json.loads(output_options)
        
        # Generate a unique ID for this processing
        process_id = str(uuid.uuid4())
        
        # Create directory for this file
        file_dir = VOCALS_DIR / process_id
        file_dir.mkdir(exist_ok=True)
        
        # Save original file
        original_name = audio_file.filename
        original_path = file_dir / original_name
        
        with open(original_path, "wb") as f:
            content = await audio_file.read()
            f.write(content)
        
        # Paths for output files
        vocals_path = file_dir / f"{Path(original_name).stem}_vocals.mp3"
        piano_path = file_dir / f"{Path(original_name).stem}_piano.mp3"
        accompaniment_path = file_dir / f"{Path(original_name).stem}_accompaniment.mp3"
        midi_path = file_dir / f"{Path(original_name).stem}.mid"
        
        # Copy original file as placeholders for vocals, piano, and accompaniment
        # In a real implementation, these would be processed
        import shutil
        if options.get("vocals", False):
            shutil.copy(original_path, vocals_path)
        
        if options.get("piano", False):
            shutil.copy(original_path, piano_path)
        
        if options.get("accompaniment", False):
            shutil.copy(original_path, accompaniment_path)
        
        # Create a simple MIDI file for demo purposes
        if options.get("piano", False):
            from midiutil import MIDIFile
            midi = MIDIFile(1)
            midi.addTempo(0, 0, 120)
            
            # Add a few demo notes
            for i in range(10):
                midi.addNote(0, 0, 60 + i, i, 1, 100)
            
            with open(midi_path, "wb") as f:
                midi.writeFile(f)
        
        # Create result paths
        result = {
            "id": process_id,
            "originalName": original_name,
            "dateProcessed": datetime.now().isoformat(),
            "directory": process_id,
            "files": {
                "original": f"/audio/{process_id}/{original_name}",
                "vocals": f"/audio/{process_id}/{Path(original_name).stem}_vocals.mp3" if options.get("vocals", False) else None,
                "piano": f"/audio/{process_id}/{Path(original_name).stem}_piano.mp3" if options.get("piano", False) else None,
                "accompaniment": f"/audio/{process_id}/{Path(original_name).stem}_accompaniment.mp3" if options.get("accompaniment", False) else None,
                "midi": f"/audio/{process_id}/{Path(original_name).stem}.mid" if options.get("piano", False) else None
            }
        }
        
        # Update history
        history = load_history()
        history["files"].insert(0, result)
        save_history(history)
        
        return result
        
    except Exception as e:
        logger.error(f"Error processing file: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/library/{file_id}")
async def delete_file(file_id: str):
    """Delete a file from the library"""
    try:
        history = load_history()
        
        # Find the file to delete
        file_entry = None
        for i, entry in enumerate(history["files"]):
            if entry["id"] == file_id:
                file_entry = entry
                history["files"].pop(i)
                break
        
        if not file_entry:
            raise HTTPException(status_code=404, detail="File not found")
        
        # Delete the file directory
        file_dir = VOCALS_DIR / file_id
        if file_dir.exists():
            import shutil
            shutil.rmtree(file_dir)
        
        # Save updated history
        save_history(history)
        
        return {"message": "File deleted successfully"}
        
    except Exception as e:
        logger.error(f"Error deleting file: {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    logger.info("Starting simplified backend server...")
    uvicorn.run(app, host="0.0.0.0", port=8000) 