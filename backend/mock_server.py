from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
import os
import json
import uuid
from datetime import datetime
from pathlib import Path
import glob
import random

app = Flask(__name__)
CORS(app)

# Define paths
VOCALS_DIR = Path.home() / "Downloads" / "Vocals"
VOCALS_DIR.mkdir(exist_ok=True, parents=True)
DOWNLOADS_DIR = Path.home() / "Downloads"
HISTORY_FILE = Path("processing_history.json")  # Store in the backend directory for easier access

def load_history():
    """Load processing history"""
    if HISTORY_FILE.exists():
        try:
            with open(HISTORY_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            print(f"Error loading history: {e}")
    return {"files": []}

def save_history(history):
    """Save processing history"""
    try:
        with open(HISTORY_FILE, "w", encoding="utf-8") as f:
            json.dump(history, f, ensure_ascii=False, indent=2)
    except Exception as e:
        print(f"Error saving history: {e}")

@app.route('/')
def root():
    return jsonify({"message": "Mock Vocal Separator API", "status": "running"})

@app.route('/api/ping')
def ping():
    return jsonify({"status": "ok", "message": "Backend server is up and running"})

@app.route('/api/library')
def get_library():
    history = load_history()
    return jsonify(history)

@app.route('/api/downloads/midi')
def get_downloads_midi():
    """Get list of MIDI files in the Downloads folder"""
    try:
        # Find all MIDI files in Downloads
        midi_files = []
        for ext in ['.mid', '.midi']:
            midi_files.extend(glob.glob(str(DOWNLOADS_DIR / f"*{ext}")))
        
        # Convert to relative paths and create response
        result = []
        for file_path in midi_files:
            file = Path(file_path)
            result.append({
                "name": file.name,
                "path": f"/downloads/{file.name}",
                "size": file.stat().st_size,
                "modified": datetime.fromtimestamp(file.stat().st_mtime).isoformat()
            })
            
        return jsonify({"files": result})
    except Exception as e:
        print(f"Error listing MIDI files: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/downloads/<path:filepath>')
def serve_downloads(filepath):
    """Serve files from Downloads directory"""
    return send_from_directory(DOWNLOADS_DIR, filepath)

@app.route('/audio/<path:filepath>')
def serve_audio(filepath):
    return send_from_directory(VOCALS_DIR, filepath)

def create_enhanced_midi(midi_path, title="Generated Song"):
    """Create a better MIDI file with structured tracks"""
    from midiutil import MIDIFile
    
    # Create a multi-track MIDI file
    midi = MIDIFile(4)  # 4 tracks: melody, bass, chords, rhythmic elements
    
    # Add metadata
    midi.addTrackName(0, 0, "Melody")
    midi.addTrackName(1, 0, "Bass")
    midi.addTrackName(2, 0, "Chords")
    midi.addTrackName(3, 0, "Rhythm")
    
    # Set tempo and time signature
    midi.addTempo(0, 0, 120)
    
    # Define key and scale (C major for simplicity)
    key_root = 60  # C4
    major_scale = [0, 2, 4, 5, 7, 9, 11]  # Major scale intervals
    
    # Common chord progressions in C major
    chord_progressions = [
        # I-IV-V-I
        [(key_root, key_root+4, key_root+7), (key_root+5, key_root+9, key_root+12), 
         (key_root+7, key_root+11, key_root+14), (key_root, key_root+4, key_root+7)],
        # I-vi-IV-V
        [(key_root, key_root+4, key_root+7), (key_root-3, key_root, key_root+4), 
         (key_root+5, key_root+9, key_root+12), (key_root+7, key_root+11, key_root+14)]
    ]
    
    selected_progression = random.choice(chord_progressions)
    
    # Create a simple melody line (track 0)
    melody_track = 0
    melody_channel = 0
    melody_volume = 100
    
    # Create melody notes based on the chord progression
    melody_notes = []
    for bar in range(8):  # 8 bars of melody
        chord_idx = bar % len(selected_progression)
        chord = selected_progression[chord_idx]
        
        # Create 4 notes per bar that fit with the chord
        for beat in range(4):
            if random.random() < 0.8:  # 20% chance of rest
                note = random.choice(chord) + random.choice([-12, -7, 0, 7, 12])
                # Keep notes in a reasonable range
                while note < 60 or note > 84:
                    note = random.choice(chord) + random.choice([-12, -7, 0, 7, 12])
                
                duration = random.choice([0.25, 0.5, 1.0, 2.0])
                start_time = bar + (beat * 0.25)
                
                if start_time + duration <= 8:  # Ensure we don't go beyond our 8 bars
                    melody_notes.append((note, start_time, duration, melody_volume))
    
    # Add all melody notes
    for note, start, duration, volume in melody_notes:
        midi.addNote(melody_track, melody_channel, note, start, duration, volume)
    
    # Create a bass line (track 1)
    bass_track = 1
    bass_channel = 1
    bass_volume = 90
    
    # Add bass notes (root notes of each chord, one per bar)
    for bar in range(8):
        chord_idx = bar % len(selected_progression)
        root_note = selected_progression[chord_idx][0] - 24  # Go two octaves down for bass
        midi.addNote(bass_track, bass_channel, root_note, bar, 1, bass_volume)
    
    # Create chord track (track 2)
    chord_track = 2
    chord_channel = 2
    chord_volume = 70
    
    # Add chords (one per bar, sustained)
    for bar in range(8):
        chord_idx = bar % len(selected_progression)
        chord = selected_progression[chord_idx]
        
        for note in chord:
            midi.addNote(chord_track, chord_channel, note, bar, 1, chord_volume)
    
    # Create rhythmic elements (track 3) - simple hi-hat pattern
    rhythm_track = 3
    rhythm_channel = 9  # Channel 9 is percussion in GM
    rhythm_volume = 60
    
    # Simple hi-hat pattern (every quarter note)
    for bar in range(8):
        for beat in range(4):
            midi.addNote(rhythm_track, rhythm_channel, 42, bar + (beat * 0.25), 0.25, rhythm_volume)
    
    # Write the MIDI file
    with open(midi_path, "wb") as f:
        midi.writeFile(f)
    
    return midi_path

@app.route('/api/separate', methods=['POST'])
def separate_audio():
    # Simple mock function that creates fake response
    audio_file = request.files.get('audio_file')
    
    if not audio_file:
        return jsonify({"error": "No audio file provided"}), 400
    
    # Parse output options
    options = {}
    if 'output_options' in request.form:
        options = json.loads(request.form['output_options'])
    
    # Generate a unique ID for this processing
    process_id = str(uuid.uuid4())
    
    # Create directory for this file
    file_dir = VOCALS_DIR / process_id
    file_dir.mkdir(exist_ok=True)
    
    # Save original file
    original_name = audio_file.filename
    original_path = file_dir / original_name
    audio_file.save(original_path)
    
    # Paths for output files
    vocals_path = file_dir / f"{Path(original_name).stem}_vocals.mp3"
    piano_path = file_dir / f"{Path(original_name).stem}_piano.mp3"
    accompaniment_path = file_dir / f"{Path(original_name).stem}_accompaniment.mp3"
    midi_path = file_dir / f"{Path(original_name).stem}.mid"
    
    # Copy original file as placeholders for vocals, piano, and accompaniment
    # In a real implementation, these would be processed
    import shutil
    if options.get("piano", False):
        shutil.copy(original_path, piano_path)
    
    if options.get("vocals", False):
        shutil.copy(original_path, vocals_path)
    
    if options.get("accompaniment", False):
        shutil.copy(original_path, accompaniment_path)
    
    # Create a better MIDI file for demo purposes
    if options.get("piano", False):
        create_enhanced_midi(midi_path, title=Path(original_name).stem)
    
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
    
    return jsonify(result)

# Add a new route to process MIDI files for better playback
@app.route('/api/process-midi', methods=['POST'])
def process_midi():
    """Process a MIDI file to enhance its playback quality"""
    data = request.json
    if not data or 'midiPath' not in data:
        return jsonify({"error": "No MIDI path provided"}), 400
    
    midi_path = data['midiPath']
    original_path = DOWNLOADS_DIR / Path(midi_path).name
    
    if not original_path.exists():
        return jsonify({"error": f"MIDI file not found: {original_path}"}), 404
    
    # Generate a unique ID for this processing
    process_id = str(uuid.uuid4())
    
    # Create directory for this file
    file_dir = VOCALS_DIR / process_id
    file_dir.mkdir(exist_ok=True)
    
    # Copy the original MIDI file
    import shutil
    new_midi_path = file_dir / original_path.name
    shutil.copy(original_path, new_midi_path)
    
    # Create result
    result = {
        "id": process_id,
        "originalName": original_path.name,
        "dateProcessed": datetime.now().isoformat(),
        "directory": process_id,
        "files": {
            "midi": f"/audio/{process_id}/{original_path.name}",
            # Add metadata about tracks, instruments, etc.
            "metadata": {
                "tracks": [
                    {"name": "Melody", "channel": 0, "instrument": "Piano"},
                    {"name": "Bass", "channel": 1, "instrument": "Acoustic Bass"},
                    {"name": "Harmony", "channel": 2, "instrument": "String Ensemble"}
                ],
                "duration": 30.0,  # Fake duration in seconds
                "timeSignature": "4/4",
                "tempo": 120
            }
        }
    }
    
    # Update history
    history = load_history()
    history["files"].insert(0, result)
    save_history(history)
    
    return jsonify(result)

@app.route('/api/midi-tracks', methods=['POST'])
def analyze_midi_tracks():
    """Analyze MIDI file and return track information for better playback"""
    data = request.json
    if not data or 'midiPath' not in data:
        return jsonify({"error": "No MIDI path provided"}), 400
    
    try:
        # Parse the MIDI path - it could be a download URL or a full path
        midi_path = data['midiPath']
        
        # Handle both local paths and URLs
        if midi_path.startswith('/downloads/'):
            # It's a download URL
            filename = midi_path.split('/')[-1]
            file_path = DOWNLOADS_DIR / filename
        elif midi_path.startswith('/audio/'):
            # It's from our processed files
            parts = midi_path.split('/')
            if len(parts) >= 3:
                process_id = parts[2]
                filename = parts[3]
                file_path = VOCALS_DIR / process_id / filename
            else:
                return jsonify({"error": "Invalid MIDI path format"}), 400
        else:
            # Assume it's a direct path
            file_path = Path(midi_path)
        
        if not file_path.exists():
            return jsonify({"error": f"MIDI file not found: {file_path}"}), 404
        
        # Parse the MIDI file using mido library if available
        try:
            import mido
            midi_file = mido.MidiFile(file_path)
            
            # Extract track information
            tracks = []
            for i, track in enumerate(midi_file.tracks):
                # Get track name
                track_name = None
                instrument = None
                for msg in track:
                    if msg.type == 'track_name':
                        track_name = msg.name
                    elif msg.type == 'program_change':
                        instrument = msg.program
                
                # Count note events in track
                note_count = sum(1 for msg in track if msg.type == 'note_on' and msg.velocity > 0)
                
                # Guess track type based on name or instrument number
                track_type = None
                if track_name:
                    track_name_lower = track_name.lower()
                    if any(keyword in track_name_lower for keyword in ['melody', 'lead', 'solo']):
                        track_type = 'melody'
                    elif any(keyword in track_name_lower for keyword in ['bass', 'basse']):
                        track_type = 'bass'
                    elif any(keyword in track_name_lower for keyword in ['chord', 'harmony', 'rhythm']):
                        track_type = 'harmony'
                    elif any(keyword in track_name_lower for keyword in ['drum', 'percussion']):
                        track_type = 'percussion'
                
                # Add track info
                tracks.append({
                    "index": i,
                    "name": track_name or f"Track {i+1}",
                    "instrument": instrument,
                    "noteCount": note_count,
                    "type": track_type,
                    "isImportant": True if i == 0 or (track_type in ['melody', 'bass']) else False
                })
            
            return jsonify({
                "tracks": tracks,
                "format": midi_file.type,
                "ticks_per_beat": midi_file.ticks_per_beat
            })
            
        except ImportError:
            # If mido not available, return simple mock track data
            return jsonify({
                "tracks": [
                    {"index": 0, "name": "Melody", "type": "melody", "isImportant": True, "noteCount": 120},
                    {"index": 1, "name": "Bass", "type": "bass", "isImportant": True, "noteCount": 80},
                    {"index": 2, "name": "Harmony", "type": "harmony", "isImportant": True, "noteCount": 60},
                    {"index": 3, "name": "Drums", "type": "percussion", "isImportant": False, "noteCount": 200}
                ],
                "format": 1,
                "ticks_per_beat": 480
            })
            
    except Exception as e:
        print(f"Error analyzing MIDI file: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/ws')
def websocket_mock():
    # This is just a mock endpoint to simulate the websocket endpoint
    return jsonify({"message": "WebSocket endpoint mocked", "progress": 100})

if __name__ == '__main__':
    print("Starting enhanced mock server on port 8001...")
    app.run(host='0.0.0.0', port=8001, debug=True) 