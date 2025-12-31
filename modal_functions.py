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
            
            # Load and process audio with Demucs using lower-level API
            from demucs.pretrained import get_model
            from demucs.apply import apply_model
            from demucs.separate import load_track
            
            # Load model
            model = get_model("htdemucs")
            device = "cuda" if torch.cuda.is_available() else "cpu"
            model.to(device)
            
            # Load audio
            wav = load_track(str(input_file), model.audio_channels, model.samplerate)
            
            # Apply separation
            ref = wav.mean(0)
            wav = (wav - ref.mean()) / ref.std()
            sources = apply_model(model, wav[None], device=device, overlap=0.25)[0]
            sources = sources * ref.std() + ref.mean()
            
            # Get source names from model
            source_names = model.sources
            result_paths = {}
            
            # Extract vocals if requested
            if extract_vocals and "vocals" in source_names:
                vocals_idx = source_names.index("vocals")
                vocals_audio = sources[vocals_idx].cpu()
                vocals_path = temp_path / "vocals.wav"
                torchaudio.save(str(vocals_path), vocals_audio, model.samplerate)
                
                # Read the vocals file and return as bytes
                with open(vocals_path, "rb") as f:
                    result_paths["vocals_data"] = f.read()
                    
            # Extract accompaniment if requested  
            if extract_accompaniment:
                # Accompaniment is everything except vocals
                accompaniment = wav
                if "vocals" in source_names:
                    vocals_idx = source_names.index("vocals")
                    accompaniment = wav - sources[vocals_idx]
                
                accompaniment_path = temp_path / "accompaniment.wav"
                torchaudio.save(str(accompaniment_path), accompaniment.cpu(), model.samplerate)
                
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
            
            print(f"Processing audio file: {input_file}")
            
            # Check file size
            file_size = len(audio_data)
            if file_size < 1000:  # Less than 1KB is probably not valid audio
                return {
                    "success": False,
                    "error": f"Invalid audio data: file too small ({file_size} bytes)",
                    "chords": [],
                    "message": "Audio file too small for chord detection"
                }
            
            # Load audio with librosa
            try:
                audio, sr = librosa.load(str(input_file), sr=44100)
                print(f"Loaded audio: {len(audio)} samples at {sr}Hz")
            except Exception as e:
                return {
                    "success": False,
                    "error": f"Failed to load audio with librosa: {str(e)}",
                    "chords": [],
                    "message": "Could not load audio file"
                }
            
            # Use simplified chord detection with librosa (more reliable than Essentia)
            # Extract chroma features
            chroma = librosa.feature.chroma_stft(y=audio, sr=sr, hop_length=512)
            
            # Simple chord templates (major and minor triads)
            chord_templates = {
                'C': [1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0],
                'C#': [0, 1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0],
                'D': [0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 0, 0],
                'D#': [0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 0],
                'E': [0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1],
                'F': [1, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0],
                'F#': [0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0],
                'G': [0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 1],
                'G#': [1, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0],
                'A': [0, 1, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0],
                'A#': [0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 1, 0],
                'B': [0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 1],
                # Minor chords
                'Cm': [1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0],
                'Dm': [0, 0, 1, 0, 0, 1, 0, 0, 0, 1, 0, 0],
                'Em': [0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 1],
                'Fm': [1, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0],
                'Gm': [0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 1, 0],
                'Am': [0, 1, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0],
            }
            
            # Detect chords by comparing chroma features to templates
            detected_chords = []
            hop_length = 512
            frame_rate = sr / hop_length
            
            for i in range(chroma.shape[1]):
                frame_chroma = chroma[:, i]
                
                # Find best matching chord template
                best_chord = 'N'  # No chord
                best_score = 0
                
                for chord_name, template in chord_templates.items():
                    # Calculate correlation between frame and template
                    score = np.dot(frame_chroma, template) / (np.linalg.norm(frame_chroma) * np.linalg.norm(template) + 1e-10)
                    if score > best_score and score > 0.5:  # Threshold for chord detection
                        best_score = score
                        best_chord = chord_name
                
                timestamp = i / frame_rate
                detected_chords.append({
                    "time": timestamp,
                    "chord": best_chord,
                    "confidence": float(best_score)
                })
            
            # Remove duplicates and filter by confidence
            filtered_chords = []
            last_chord = None
            for chord_info in detected_chords:
                if chord_info["chord"] != last_chord and chord_info["confidence"] > 0.6 and chord_info["chord"] != 'N':
                    filtered_chords.append(chord_info)
                    last_chord = chord_info["chord"]
            
            return {
                "success": True,
                "chords": filtered_chords,
                "message": f"Detected {len(filtered_chords)} chord changes using GPU-accelerated processing"
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
        import modal
        
        try:
            # Get function handle from the deployed app
            separate_func = modal.Function.from_name("vocal-separator-gpu-v4", "separate_audio_gpu")
            
            # Call the deployed function
            return separate_func.remote(audio_data, extract_vocals, extract_accompaniment)
            
        except Exception as e:
            print(f"Failed to call Modal function: {e}")
            return {
                "success": False,
                "error": f"Modal GPU processing failed: {str(e)}",
                "message": "Falling back to CPU processing recommended"
            }
    
    @staticmethod  
    def detect_chords(audio_data: bytes) -> dict:
        """Call Modal GPU function to detect chords"""
        import modal
        
        try:
            # Get function handle from the deployed app
            chord_func = modal.Function.from_name("vocal-separator-gpu-v4", "detect_chords_gpu")
            
            # Call the deployed function
            return chord_func.remote(audio_data)
            
        except Exception as e:
            print(f"Failed to call Modal function: {e}")
            return {
                "success": False,
                "error": f"Modal GPU processing failed: {str(e)}",
                "chords": [],
                "message": "Falling back to CPU processing recommended"
            }

if __name__ == "__main__":
    # Deploy the Modal app
    print("Deploying Modal GPU functions...")
    # modal.deploy(app)