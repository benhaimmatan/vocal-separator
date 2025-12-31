import modal
import tempfile
import os
from pathlib import Path

# Create Modal app
app = modal.App("vocal-separator")

# Define the Modal image with all required dependencies
image = modal.Image.debian_slim().pip_install([
    "torch==2.1.0",
    "torchaudio==2.1.0", 
    "demucs==4.0.1",
    "librosa==0.10.1",
    "soundfile==0.12.1",
    "numpy==1.24.3"
]).apt_install("ffmpeg")

@app.function(
    image=image,
    gpu=modal.gpu.A10G(),  # Fast GPU for audio processing
    timeout=600,  # 10 minutes max
    memory=8192,  # 8GB RAM
)
def separate_vocals_gpu(audio_data: bytes, filename: str, model_name: str = "htdemucs") -> dict:
    """
    Separate vocals from audio using GPU acceleration on Modal
    
    Args:
        audio_data: Audio file as bytes
        filename: Original filename for reference
        model_name: Demucs model to use ('htdemucs' or 'htdemucs_6s')
    
    Returns:
        Dict with separated audio files as bytes
    """
    import torch
    import torchaudio
    import tempfile
    import shutil
    from demucs.pretrained import get_model
    from demucs.apply import apply_model
    import soundfile as sf
    import io
    
    print(f"Processing {filename} with {model_name} on GPU...")
    
    # Create temp directories
    with tempfile.TemporaryDirectory() as temp_dir:
        input_path = Path(temp_dir) / "input.wav"
        output_dir = Path(temp_dir) / "output"
        output_dir.mkdir()
        
        # Write input audio to temp file
        with open(input_path, "wb") as f:
            f.write(audio_data)
        
        # Load the model
        print(f"Loading model: {model_name}")
        model = get_model(model_name)
        model.cuda()  # Move to GPU
        
        # Load and process audio
        print("Loading audio...")
        waveform, sample_rate = torchaudio.load(str(input_path))
        waveform = waveform.cuda()  # Move to GPU
        
        print("Separating sources...")
        with torch.no_grad():
            separated = apply_model(model, waveform.unsqueeze(0), device='cuda')[0]
        
        # Move back to CPU for file operations
        separated = separated.cpu()
        
        # Get source names based on model
        if model_name == "htdemucs_6s":
            sources = ["drums", "bass", "other", "vocals", "piano", "guitar"]
        else:
            sources = ["drums", "bass", "other", "vocals"]
        
        # Save separated sources and convert to bytes
        results = {}
        base_name = Path(filename).stem
        
        for i, source in enumerate(sources):
            output_path = output_dir / f"{base_name}_{source}.wav"
            
            # Save as WAV file
            torchaudio.save(str(output_path), separated[i:i+1], sample_rate)
            
            # Read back as bytes
            with open(output_path, "rb") as f:
                results[source] = f.read()
        
        print(f"Successfully separated {len(sources)} sources")
        return results

@app.function(
    image=image,
    gpu=modal.gpu.T4(),  # Lighter GPU for chord detection
    timeout=300,  # 5 minutes max
)
def detect_chords_gpu(audio_data: bytes, filename: str) -> dict:
    """
    Detect chords from audio using GPU acceleration
    
    Args:
        audio_data: Audio file as bytes
        filename: Original filename
    
    Returns:
        Dict with chord detection results
    """
    import librosa
    import numpy as np
    import tempfile
    from pathlib import Path
    
    print(f"Detecting chords in {filename}...")
    
    with tempfile.TemporaryDirectory() as temp_dir:
        input_path = Path(temp_dir) / "input.wav"
        
        # Write input audio
        with open(input_path, "wb") as f:
            f.write(audio_data)
        
        # Load audio
        y, sr = librosa.load(str(input_path))
        
        # Simple chord detection (placeholder - replace with actual model)
        # This is where you'd integrate BTC-ISMIR19 or similar models
        chroma = librosa.feature.chroma_stft(y=y, sr=sr, hop_length=512)
        
        # Basic chord mapping (simplified)
        chord_templates = {
            'C': [1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0],
            'Dm': [0, 0, 1, 0, 0, 1, 0, 0, 0, 1, 0, 0],
            'Em': [0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 1],
            'F': [1, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0],
            'G': [0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 1],
            'Am': [1, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0],
        }
        
        # Simple correlation-based detection
        times = librosa.frames_to_time(np.arange(chroma.shape[1]), sr=sr, hop_length=512)
        chords = []
        
        for i in range(chroma.shape[1]):
            frame_chroma = chroma[:, i]
            best_chord = 'N'
            best_score = 0
            
            for chord, template in chord_templates.items():
                score = np.dot(frame_chroma, template)
                if score > best_score:
                    best_score = score
                    best_chord = chord
            
            chords.append({
                'time': float(times[i]),
                'chord': best_chord,
                'confidence': float(best_score)
            })
        
        return {'chords': chords, 'duration': float(times[-1])}

# Client functions to call Modal from your app
def process_audio_on_modal(audio_data: bytes, filename: str, model_name: str = "htdemucs") -> dict:
    """Call Modal function to separate vocals"""
    return separate_vocals_gpu.remote(audio_data, filename, model_name)

def detect_chords_on_modal(audio_data: bytes, filename: str) -> dict:
    """Call Modal function to detect chords"""
    return detect_chords_gpu.remote(audio_data, filename)