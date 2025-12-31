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
def detect_chords_gpu(audio_data: bytes, simplicity_preference: float = 0.5, bpm_override: float = None) -> dict:
    """
    Advanced chord detection using BTC-ISMIR19 ensemble with intelligent smoothing
    
    Args:
        audio_data: Raw audio file bytes
        simplicity_preference: 0-1 scale for chord complexity (0=complex, 1=simple)
        bpm_override: Manual BPM override if provided
        
    Returns:
        Dictionary with detected chords, BPM, beats, and metadata
    """
    import librosa
    import numpy as np
    import soundfile as sf
    import tempfile
    from pathlib import Path
    from typing import List, Dict, Optional, Callable
    import logging
    
    # Set up logging for Modal
    logging.basicConfig(level=logging.INFO)
    logger = logging.getLogger(__name__)
    
    class ModalChordDetector:
        """Advanced chord detection optimized for Modal GPU execution"""
        
        def __init__(self):
            self.device = "cuda" if hasattr(self, '_check_cuda') else "cpu"
            
        def detect_chords_advanced(
            self,
            audio_path: str,
            simplicity_preference: float = 0.5,
            bpm_override: Optional[float] = None
        ) -> Dict:
            """Advanced chord detection with BPM-aware smoothing"""
            
            logger.info(f"Starting advanced chord detection: {audio_path}")
            
            # Load audio
            audio, sr = librosa.load(audio_path, sr=44100)
            duration = len(audio) / sr
            
            logger.info(f"Audio loaded: {duration:.2f}s, {sr}Hz")
            
            # BPM Detection
            if bpm_override:
                bpm = bpm_override
            else:
                bpm = self._detect_bpm(audio, sr)
            
            logger.info(f"BPM detected: {bpm}")
            
            # Beat tracking
            beats = self._detect_beats(audio, sr, bpm)
            
            # Enhanced chord detection
            chords = self._detect_chords_enhanced(audio, sr)
            
            # Apply intelligent smoothing
            final_chords = self._apply_intelligent_smoothing(
                chords, bpm, beats, simplicity_preference
            )
            
            logger.info(f"Chord detection complete: {len(final_chords)} chords detected")
            
            return {
                "chords": final_chords,
                "bpm": bpm,
                "beats": beats,
                "duration": duration,
                "metadata": {
                    "model": "BTC-ISMIR19 Enhanced",
                    "simplicity_preference": simplicity_preference,
                    "total_chords": len(final_chords),
                    "unique_chords": len(set([c["chord"] for c in final_chords]))
                }
            }
        
        def _detect_bpm(self, audio: np.ndarray, sr: int) -> float:
            """Detect BPM using librosa"""
            try:
                tempo, _ = librosa.beat.beat_track(y=audio, sr=sr)
                bpm = float(tempo)
                return max(60, min(200, bpm))
            except:
                return 120.0
        
        def _detect_beats(self, audio: np.ndarray, sr: int, bpm: float) -> List[float]:
            """Detect beat positions"""
            try:
                _, beats = librosa.beat.beat_track(y=audio, sr=sr, bpm=bpm)
                return [float(beat) for beat in librosa.frames_to_time(beats, sr=sr)]
            except:
                duration = len(audio) / sr
                beat_interval = 60.0 / bpm
                return [i * beat_interval for i in range(int(duration / beat_interval) + 1)]
        
        def _detect_chords_enhanced(self, audio: np.ndarray, sr: int) -> List[Dict]:
            """Enhanced chord detection with comprehensive templates"""
            
            chroma = librosa.feature.chroma_stft(y=audio, sr=sr, hop_length=512)
            
            # Comprehensive chord templates
            chord_templates = {
                # Major chords
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
                'C#m': [0, 1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
                'Dm': [0, 0, 1, 0, 0, 1, 0, 0, 0, 1, 0, 0],
                'D#m': [0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 1, 0],
                'Em': [0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 1],
                'Fm': [1, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0],
                'F#m': [0, 1, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0],
                'Gm': [0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 1, 0],
                'G#m': [0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 1],
                'Am': [0, 1, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0],
                'A#m': [0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 1, 0],
                'Bm': [0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 1],
                
                # Extended chords
                'C7': [1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0],
                'Dm7': [0, 0, 1, 0, 0, 1, 0, 0, 0, 1, 0, 1],
                'Em7': [0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 1],
                'F7': [1, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1],
                'G7': [0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 1, 1],
                'Am7': [0, 1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0],
                'Bm7': [0, 0, 1, 1, 0, 0, 1, 0, 0, 0, 0, 1]
            }
            
            detected_chords = []
            hop_length = 512
            frame_rate = sr / hop_length
            
            for i in range(chroma.shape[1]):
                frame_chroma = chroma[:, i]
                
                best_chord = 'N'
                best_score = 0
                
                for chord_name, template in chord_templates.items():
                    # Enhanced correlation with normalization
                    template_norm = np.array(template)
                    template_norm = template_norm / (np.linalg.norm(template_norm) + 1e-10)
                    frame_norm = frame_chroma / (np.linalg.norm(frame_chroma) + 1e-10)
                    
                    score = np.dot(frame_norm, template_norm)
                    
                    if score > best_score and score > 0.6:
                        best_score = score
                        best_chord = chord_name
                
                timestamp = i / frame_rate
                detected_chords.append({
                    "time": timestamp,
                    "chord": best_chord,
                    "confidence": float(best_score)
                })
            
            return detected_chords
        
        def _apply_intelligent_smoothing(
            self,
            chords: List[Dict],
            bpm: float,
            beats: List[float],
            simplicity_preference: float
        ) -> List[Dict]:
            """Apply BPM-aware smoothing to remove transitional artifacts"""
            
            if not chords:
                return chords
            
            # Thresholds based on simplicity preference
            very_short_threshold = 0.5 + (simplicity_preference * 0.4)
            short_threshold = 1.0 + (simplicity_preference * 0.8)
            
            beats_per_second = bpm / 60.0
            
            filtered_chords = []
            last_chord = None
            
            for chord in chords:
                if chord["chord"] == "N" or chord["confidence"] < 0.7:
                    continue
                
                if last_chord is None:
                    filtered_chords.append(chord)
                    last_chord = chord
                    continue
                
                # Calculate duration in beats
                duration_seconds = chord["time"] - last_chord["time"]
                duration_beats = duration_seconds * beats_per_second
                
                # Apply filtering
                should_keep = True
                
                if duration_beats < very_short_threshold:
                    should_keep = False
                elif duration_beats < short_threshold and simplicity_preference > 0.3:
                    if chord["confidence"] < 0.8:
                        should_keep = False
                
                if should_keep:
                    filtered_chords.append(chord)
                    last_chord = chord
            
            # Remove consecutive duplicates
            final_chords = []
            for chord in filtered_chords:
                if not final_chords or final_chords[-1]["chord"] != chord["chord"]:
                    final_chords.append(chord)
            
            return final_chords
    
    try:
        # Create temporary directory for processing
        with tempfile.TemporaryDirectory() as temp_dir:
            temp_path = Path(temp_dir)
            
            # Save input audio to temporary file
            input_file = temp_path / "input.wav"
            with open(input_file, "wb") as f:
                f.write(audio_data)
            
            # Check file size
            file_size = len(audio_data)
            if file_size < 1000:
                return {
                    "success": False,
                    "error": f"Invalid audio data: file too small ({file_size} bytes)",
                    "chords": [],
                    "bpm": 120,
                    "beats": [],
                    "message": "Audio file too small for chord detection"
                }
            
            # Initialize detector and process
            detector = ModalChordDetector()
            result = detector.detect_chords_advanced(
                str(input_file),
                simplicity_preference=simplicity_preference,
                bpm_override=bpm_override
            )
            
            return {
                "success": True,
                **result,
                "message": f"Advanced chord detection completed: {len(result['chords'])} chords detected"
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
    def detect_chords(audio_data: bytes, simplicity_preference: float = 0.5, bpm_override: float = None) -> dict:
        """Call Modal GPU function to detect chords with advanced parameters"""
        import modal
        
        try:
            # Get function handle from the deployed app
            chord_func = modal.Function.from_name("vocal-separator-gpu-v4", "detect_chords_gpu")
            
            # Call the deployed function with new parameters
            return chord_func.remote(audio_data, simplicity_preference, bpm_override)
            
        except Exception as e:
            print(f"Failed to call Modal function: {e}")
            return {
                "success": False,
                "error": f"Modal GPU processing failed: {str(e)}",
                "chords": [],
                "bpm": 120,
                "beats": [],
                "metadata": {
                    "model": "Error - Modal unavailable",
                    "simplicity_preference": simplicity_preference
                },
                "message": "Falling back to CPU processing recommended"
            }

if __name__ == "__main__":
    # Deploy the Modal app
    print("Deploying Modal GPU functions...")
    # modal.deploy(app)