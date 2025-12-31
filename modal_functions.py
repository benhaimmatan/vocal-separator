"""
Modal GPU functions for fast audio processing in vocal separator app.
These functions run on GPU-accelerated Modal instances to speed up processing.
"""

import os
import tempfile
from pathlib import Path
import modal

# Create Modal app
app = modal.App("vocal-separator-gpu")

# For production deployment, we'll reference the already deployed functions
PRODUCTION_MODE = os.getenv("MODAL_ENVIRONMENT") == "production"

# Define the container image with all audio processing dependencies
image = (
    modal.Image.debian_slim(python_version="3.10")
    .apt_install(["ffmpeg", "libsndfile1"])
    .pip_install([
        "torch==2.1.0",
        "torchaudio==2.1.0", 
        "demucs==4.0.1",
        "librosa==0.10.1",
        "soundfile==0.12.1",
        "numpy==1.24.3",
        "scipy==1.11.4",
        "essentia==2.1b6.dev1110",
        "scikit-learn==1.3.2",
        "matplotlib==3.8.2",
        "midiutil==1.2.1"
    ])
)

@app.function(
    image=image,
    gpu="any",
    timeout=600,
    memory=8192
)
def separate_audio_gpu(audio_data: bytes, extract_vocals: bool = True, extract_accompaniment: bool = True) -> dict:
    """
    Separate audio into vocals and accompaniment using Demucs on GPU.
    
    Args:
        audio_data: Raw audio file bytes
        extract_vocals: Whether to extract vocals track
        extract_accompaniment: Whether to extract accompaniment track
        
    Returns:
        Dictionary with success status and paths to separated audio files
    """
    import torch
    import torchaudio
    import demucs.api
    import soundfile as sf
    import tempfile
    import os
    from pathlib import Path
    
    try:
        # Create temporary directory for processing
        with tempfile.TemporaryDirectory() as temp_dir:
            temp_path = Path(temp_dir)
            
            # Save input audio to temporary file
            input_file = temp_path / "input.wav"
            with open(input_file, "wb") as f:
                f.write(audio_data)
            
            # Load and process audio with Demucs
            separator = demucs.api.Separator(model="htdemucs")
            origin, separated = separator.separate_audio_file(str(input_file))
            
            result_paths = {}
            
            # Extract vocals if requested
            if extract_vocals and "vocals" in separated:
                vocals_path = temp_path / "vocals.wav"
                vocals_audio = separated["vocals"].cpu()
                torchaudio.save(str(vocals_path), vocals_audio, separator.samplerate)
                
                # Read the vocals file and return as bytes
                with open(vocals_path, "rb") as f:
                    result_paths["vocals_data"] = f.read()
                    
            # Extract accompaniment if requested  
            if extract_accompaniment:
                # Accompaniment is everything except vocals
                accompaniment = origin
                for stem_name, stem_audio in separated.items():
                    if stem_name != "vocals":
                        continue
                    accompaniment = accompaniment - stem_audio
                
                accompaniment_path = temp_path / "accompaniment.wav"
                torchaudio.save(str(accompaniment_path), accompaniment.cpu(), separator.samplerate)
                
                # Read the accompaniment file and return as bytes
                with open(accompaniment_path, "rb") as f:
                    result_paths["accompaniment_data"] = f.read()
            
            return {
                "success": True,
                "message": "Audio separated successfully",
                **result_paths
            }
            
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "message": f"Failed to separate audio: {str(e)}"
        }

@app.function(
    image=image,
    gpu="any",  
    timeout=300,
    memory=4096
)
def detect_chords_gpu(audio_data: bytes) -> dict:
    """
    Detect chord progressions from audio using GPU-accelerated processing.
    
    Args:
        audio_data: Raw audio file bytes
        
    Returns:
        Dictionary with detected chords and timestamps
    """
    import librosa
    import numpy as np
    import soundfile as sf
    import tempfile
    from pathlib import Path
    import essentia.standard as es
    
    try:
        # Create temporary directory for processing
        with tempfile.TemporaryDirectory() as temp_dir:
            temp_path = Path(temp_dir)
            
            # Save input audio to temporary file
            input_file = temp_path / "input.wav"
            with open(input_file, "wb") as f:
                f.write(audio_data)
            
            # Load audio
            audio, sr = librosa.load(str(input_file), sr=44100)
            
            # Use Essentia for chord detection
            loader = es.MonoLoader(filename=str(input_file))
            audio_essentia = loader()
            
            # Chord detection using Essentia's chord detector
            chord_detector = es.ChordsDetection()
            chords, strength = chord_detector(audio_essentia)
            
            # Create chord progression with timestamps
            hop_length = 512
            frame_rate = sr / hop_length
            
            chord_progression = []
            for i, chord in enumerate(chords):
                if strength[i] > 0.1:  # Filter weak detections
                    timestamp = i / frame_rate
                    chord_progression.append({
                        "time": timestamp,
                        "chord": chord,
                        "confidence": float(strength[i])
                    })
            
            # Remove duplicates and filter by confidence
            filtered_chords = []
            last_chord = None
            for chord_info in chord_progression:
                if chord_info["chord"] != last_chord and chord_info["confidence"] > 0.3:
                    filtered_chords.append(chord_info)
                    last_chord = chord_info["chord"]
            
            return {
                "success": True,
                "chords": filtered_chords,
                "message": f"Detected {len(filtered_chords)} chord changes"
            }
            
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "chords": [],
            "message": f"Failed to detect chords: {str(e)}"
        }

# Client functions to call Modal functions
class ModalClient:
    """Client to interact with Modal GPU functions"""
    
    @staticmethod
    def separate_audio(audio_data: bytes, extract_vocals: bool = True, extract_accompaniment: bool = True) -> dict:
        """Call Modal GPU function to separate audio"""
        try:
            # Try to use the deployed app's function
            deployed_app = modal.App.lookup("vocal-separator-gpu")
            separate_func = deployed_app.function_definitions.get("separate_audio_gpu")
            if separate_func:
                return separate_func.remote(audio_data, extract_vocals, extract_accompaniment)
        except Exception as e:
            print(f"Failed to use deployed function: {e}")
        
        # Fallback to direct function call
        return separate_audio_gpu.remote(audio_data, extract_vocals, extract_accompaniment)
    
    @staticmethod  
    def detect_chords(audio_data: bytes) -> dict:
        """Call Modal GPU function to detect chords"""
        try:
            # Try to use the deployed app's function
            deployed_app = modal.App.lookup("vocal-separator-gpu")
            chord_func = deployed_app.function_definitions.get("detect_chords_gpu")
            if chord_func:
                return chord_func.remote(audio_data)
        except Exception as e:
            print(f"Failed to use deployed function: {e}")
            
        # Fallback to direct function call
        return detect_chords_gpu.remote(audio_data)

if __name__ == "__main__":
    # Deploy the Modal app
    print("Deploying Modal GPU functions...")
    # modal.deploy(app)