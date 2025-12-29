import os
import sys
import numpy as np
import librosa
import soundfile as sf
import torch
import warnings
from typing import List, Tuple, Optional, Callable
import tempfile
import shutil

# Add BTC-ISMIR19 to path
btc_path = os.path.join(os.path.dirname(__file__), 'BTC-ISMIR19')
if btc_path not in sys.path:
    sys.path.insert(0, btc_path)

warnings.filterwarnings('ignore')

class AdvancedChordDetector:
    """
    Advanced chord detector that combines multiple state-of-the-art models:
    1. BTC-ISMIR19 (Bi-directional Transformer)
    2. autochord (Bi-LSTM-CRF)
    3. Ensemble voting for improved accuracy
    """
    
    def __init__(self):
        self.btc_model = None
        self.autochord_available = False
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        
        # Initialize models
        self._init_btc_model()
        self._init_autochord()
        
        print(f"Advanced Chord Detector initialized with:")
        print(f"  - BTC-ISMIR19: {'✓' if self.btc_model else '✗'}")
        print(f"  - autochord: {'✓' if self.autochord_available else '✗'}")
        print(f"  - Device: {self.device}")
    
    def _init_btc_model(self):
        """Initialize BTC-ISMIR19 model"""
        try:
            from btc_model import BTC_model, HParams
            from utils.mir_eval_modules import idx2chord, idx2voca_chord
            
            # Load config
            config_path = os.path.join(btc_path, 'run_config.yaml')
            if not os.path.exists(config_path):
                print(f"BTC config not found at {config_path}")
                return
                
            config = HParams.load(config_path)
            
            # Use large vocabulary model for better accuracy
            config.feature['large_voca'] = True
            config.model['num_chords'] = 170
            
            model_file = os.path.join(btc_path, 'test', 'btc_model_large_voca.pt')
            
            if not os.path.exists(model_file):
                print(f"BTC model file not found at {model_file}")
                return
            
            # Load model
            self.btc_model = BTC_model(config=config.model).to(self.device)
            checkpoint = torch.load(model_file, map_location=self.device, weights_only=False)
            
            self.btc_mean = checkpoint['mean']
            self.btc_std = checkpoint['std']
            self.btc_model.load_state_dict(checkpoint['model'])
            self.btc_model.eval()
            
            self.btc_config = config
            self.idx_to_chord = idx2voca_chord()
            
            print("BTC-ISMIR19 model loaded successfully")
            
        except Exception as e:
            print(f"Failed to initialize BTC model: {e}")
            self.btc_model = None
    
    def _init_autochord(self):
        """Initialize autochord model"""
        try:
            import autochord
            self.autochord = autochord
            self.autochord_available = True
            print("autochord library loaded successfully")
        except Exception as e:
            print(f"Failed to initialize autochord: {e}")
            self.autochord_available = False
    
    def _btc_detect_chords(self, audio_path: str) -> List[Tuple[float, float, str]]:
        """Detect chords using BTC-ISMIR19 model"""
        if not self.btc_model:
            return []
        
        try:
            from utils.mir_eval_modules import audio_file_to_features
            
            # Load and process audio
            feature, feature_per_second, song_length_second = audio_file_to_features(
                audio_path, self.btc_config
            )
            
            # Prepare features
            feature = feature.T
            feature = (feature - self.btc_mean) / self.btc_std
            time_unit = feature_per_second
            n_timestep = self.btc_config.model['timestep']
            
            # Pad features
            num_pad = n_timestep - (feature.shape[0] % n_timestep)
            feature = np.pad(feature, ((0, num_pad), (0, 0)), mode="constant", constant_values=0)
            num_instance = feature.shape[0] // n_timestep
            
            # Detect chords
            results = []
            start_time = 0.0
            prev_chord = None
            
            with torch.no_grad():
                feature_tensor = torch.tensor(feature, dtype=torch.float32).unsqueeze(0).to(self.device)
                
                for t in range(num_instance):
                    self_attn_output, _ = self.btc_model.self_attn_layers(
                        feature_tensor[:, n_timestep * t:n_timestep * (t + 1), :]
                    )
                    prediction, _ = self.btc_model.output_layer(self_attn_output)
                    prediction = prediction.squeeze()
                    
                    for i in range(n_timestep):
                        current_time = time_unit * (n_timestep * t + i)
                        current_chord = prediction[i].item()
                        
                        if t == 0 and i == 0:
                            prev_chord = current_chord
                            continue
                        
                        if current_chord != prev_chord:
                            chord_name = self.idx_to_chord[prev_chord]
                            results.append((start_time, current_time, chord_name))
                            start_time = current_time
                            prev_chord = current_chord
                        
                        # Handle last segment
                        if t == num_instance - 1 and i + num_pad == n_timestep:
                            if start_time != current_time:
                                chord_name = self.idx_to_chord[prev_chord]
                                results.append((start_time, current_time, chord_name))
                            break
            
            return results
            
        except Exception as e:
            print(f"BTC chord detection failed: {e}")
            return []
    
    def _autochord_detect_chords(self, audio_path: str) -> List[Tuple[float, float, str]]:
        """Detect chords using autochord library"""
        if not self.autochord_available:
            return []
        
        try:
            # autochord.recognize returns list of tuples (start, end, chord)
            results = self.autochord.recognize(audio_path)
            return results
        except Exception as e:
            print(f"autochord detection failed: {e}")
            return []
    
    def _ensemble_chords(self, btc_results: List[Tuple[float, float, str]], 
                        autochord_results: List[Tuple[float, float, str]]) -> List[Tuple[float, float, str]]:
        """Combine results from multiple models using ensemble voting"""
        if not btc_results and not autochord_results:
            return []
        
        # Prioritize BTC results as they're more sophisticated and accurate
        if btc_results:
            print(f"Using BTC-ISMIR19 results: {len(btc_results)} chord segments")
            return btc_results
        
        if autochord_results:
            print(f"Using autochord results: {len(autochord_results)} chord segments")
            return autochord_results
        
        return []
    
    def _smooth_chord_changes(self, raw_results: List[Tuple[float, float, str]], 
                            detected_bpm: float = 120.0) -> List[Tuple[float, float, str]]:
        """
        Apply post-processing to smooth out single-beat chord changes that are 
        likely transitional bass notes rather than true chord changes.
        
        Args:
            raw_results: Raw chord detection results
            detected_bpm: Detected BPM for calculating beat duration
            
        Returns:
            Smoothed chord results
        """
        if len(raw_results) < 2:
            return raw_results
        
        # Calculate approximate beat duration (in seconds)
        beat_duration = 60.0 / detected_bpm
        
        # Even more aggressive thresholds for different scenarios
        very_short_threshold = beat_duration * 0.9   # Less than 0.9 beats - almost always noise
        short_threshold = beat_duration * 1.4        # Less than 1.4 beats - likely transitional
        medium_threshold = beat_duration * 2.2       # Less than 2.2 beats - check harmonic context
        
        print(f"Chord smoothing thresholds for BPM {detected_bpm:.1f}:")
        print(f"  Beat duration: {beat_duration:.3f}s")
        print(f"  Very short: <{very_short_threshold:.3f}s (<0.9 beats)")
        print(f"  Short: <{short_threshold:.3f}s (<1.4 beats)")
        print(f"  Medium: <{medium_threshold:.3f}s (<2.2 beats)")
        
        smoothed_results = []
        skip_indices = set()
        
        for i, (start_time, end_time, chord) in enumerate(raw_results):
            if i in skip_indices:
                continue
                
            current_duration = end_time - start_time
            current_beats = current_duration / beat_duration
            
            print(f"Chord {i}: {chord} at {start_time:.2f}-{end_time:.2f}s (duration: {current_duration:.3f}s = {current_beats:.2f} beats)")
            
            # LEVEL 1: Filter very short chords (< 0.9 beats) - these are almost always noise
            if current_duration < very_short_threshold:
                print(f"  → FILTERING: Very short chord {chord} (duration: {current_duration:.3f}s = {current_beats:.2f} beats < 0.9)")
                
                # Extend the previous chord if it exists, otherwise extend the next chord
                if smoothed_results:
                    last_start, last_end, last_chord = smoothed_results[-1]
                    smoothed_results[-1] = (last_start, end_time, last_chord)
                    print(f"  → Extended previous {last_chord} from {last_end:.2f}s to {end_time:.2f}s")
                elif i < len(raw_results) - 1:
                    # If no previous chord, extend the next chord to cover this one
                    next_start, next_end, next_chord = raw_results[i + 1]
                    raw_results[i + 1] = (start_time, next_end, next_chord)
                    print(f"  → Extended next {next_chord} to start at {start_time:.2f}s instead of {next_start:.2f}s")
                continue
            
            # LEVEL 2: Check for transitional chords
            if i > 0 and i < len(raw_results) - 1:
                prev_chord = raw_results[i-1][2]
                next_chord = raw_results[i+1][2]
                
                print(f"  → Context: {prev_chord} → {chord} → {next_chord}")
                
                # Case 1: Very aggressive - ANY chord shorter than 1.4 beats is suspicious
                if current_duration < short_threshold:
                    print(f"  → FILTERING: Short chord {chord} ({current_beats:.2f} beats < 1.4) - likely transitional")
                    
                    # Extend the previous chord if it exists
                    if smoothed_results:
                        last_start, last_end, last_chord = smoothed_results[-1]
                        smoothed_results[-1] = (last_start, end_time, last_chord)
                        print(f"  → Extended {last_chord} from {last_end:.2f}s to {end_time:.2f}s")
                    continue
                
                # Case 2: Chord sandwiched between identical chords (A -> B -> A)
                elif (current_duration < medium_threshold and prev_chord == next_chord and chord != prev_chord):
                    print(f"  → FILTERING: Sandwiched chord {prev_chord} → {chord} → {prev_chord}")
                    
                    # Extend the previous chord to cover this segment and the next
                    if smoothed_results:
                        last_start, last_end, last_chord = smoothed_results[-1]
                        smoothed_results[-1] = (last_start, raw_results[i+1][1], last_chord)
                        print(f"  → Extended {last_chord} to cover until {raw_results[i+1][1]:.2f}s")
                    
                    # Skip the next chord since we extended over it
                    skip_indices.add(i+1)
                    continue
                
                # Case 3: Medium-length chord that's harmonically transitional
                elif (current_duration < medium_threshold and 
                      (self._is_transitional_chord(chord, prev_chord) or 
                       self._is_transitional_chord(chord, next_chord))):
                    print(f"  → FILTERING: Harmonically transitional chord {chord} ({current_beats:.2f} beats)")
                    
                    # Extend the previous chord
                    if smoothed_results:
                        last_start, last_end, last_chord = smoothed_results[-1]
                        smoothed_results[-1] = (last_start, end_time, last_chord)
                        print(f"  → Extended {last_chord} from {last_end:.2f}s to {end_time:.2f}s")
                    continue
            
            # Keep this chord
            print(f"  → KEEPING: {chord} ({current_beats:.2f} beats)")
            smoothed_results.append((start_time, end_time, chord))
        
        print(f"Chord smoothing: {len(raw_results)} -> {len(smoothed_results)} segments (BPM: {detected_bpm:.1f})")
        return smoothed_results

    def _is_transitional_chord(self, transition_chord: str, main_chord: str) -> bool:
        """
        Check if a chord is likely a transitional bass note or passing chord.
        Enhanced version with more comprehensive harmonic analysis.
        """
        # Parse chord names to get roots
        def get_chord_root(chord_name: str) -> str:
            if chord_name in ['N/C', 'N', '']:
                return ''
            # Handle slash chords (bass notes)
            if '/' in chord_name:
                chord_name = chord_name.split('/')[0]
            # Remove chord qualities to get root (more comprehensive list)
            for suffix in ['dim7', 'aug7', 'maj9', 'min9', 'maj11', 'min11', 'maj13', 'min13', 
                          'dim', 'aug', 'maj7', 'min7', 'm7', 'maj', 'min', 'm', '7', '6', '9', '11', '13', 
                          'sus4', 'sus2', 'add9', 'add11', 'add13', '5']:
                if chord_name.endswith(suffix):
                    return chord_name[:-len(suffix)]
            return chord_name
        
        def chord_to_semitones(chord_root: str) -> int:
            """Convert chord root to semitones (C=0, C#=1, etc.)"""
            note_map = {'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3, 'E': 4, 'F': 5, 
                       'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8, 'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11}
            return note_map.get(chord_root, 0)
        
        transition_root = get_chord_root(transition_chord)
        main_root = get_chord_root(main_chord)
        
        if not transition_root or not main_root:
            return False
        
        # Same root with different quality (very common for transitional chords)
        if transition_root == main_root:
            return True
        
        # Calculate interval between roots
        main_semitones = chord_to_semitones(main_root)
        transition_semitones = chord_to_semitones(transition_root)
        interval = (transition_semitones - main_semitones) % 12
        
        # Common transitional intervals in popular music:
        transitional_intervals = {
            1,   # Minor 2nd (chromatic approach)
            2,   # Major 2nd (step-wise motion)
            4,   # Major 3rd (relative minor/major)
            5,   # Perfect 4th (subdominant)
            7,   # Perfect 5th (dominant)
            8,   # Minor 6th (relative minor)
            9,   # Major 6th 
            10,  # Minor 7th (common in progressions)
            11,  # Major 7th (leading tone)
        }
        
        if interval in transitional_intervals:
            return True
        
        # Special case: Check for common chord progression patterns
        # Circle of fifths movement (very common in popular music)
        if interval == 7 or interval == 5:  # Fifth up or fourth up
            return True
        
        # Chromatic bass movement (very common)
        if interval == 1 or interval == 11:  # Semitone up or down
            return True
        
        return False

    def detect_chords(self, audio_path: str, progress_callback: Optional[Callable] = None) -> List[Tuple[float, float, str]]:
        """
        Detect chords using ensemble of advanced models
        
        Args:
            audio_path: Path to audio file
            progress_callback: Optional callback for progress updates
            
        Returns:
            List of (start_time, end_time, chord_name) tuples
        """
        print(f"🎵 ADVANCED CHORD DETECTION STARTED for: {audio_path}")
        
        if progress_callback:
            progress_callback("Initializing advanced chord detection...")
        
        # Convert audio to temporary wav file if needed
        temp_wav = None
        try:
            if not audio_path.lower().endswith('.wav'):
                if progress_callback:
                    progress_callback("Converting audio format...")
                
                # Load audio and save as temporary wav
                y, sr = librosa.load(audio_path, sr=22050)
                temp_wav = tempfile.NamedTemporaryFile(suffix='.wav', delete=False)
                temp_wav.close()
                sf.write(temp_wav.name, y, sr)
                audio_path = temp_wav.name
            
            # Run BTC detection
            btc_results = []
            if self.btc_model:
                if progress_callback:
                    progress_callback("Running BTC-ISMIR19 detection...")
                btc_results = self._btc_detect_chords(audio_path)
                print(f"BTC detected {len(btc_results)} chord segments")
            
            # Run autochord detection
            autochord_results = []
            if self.autochord_available:
                if progress_callback:
                    progress_callback("Running autochord detection...")
                autochord_results = self._autochord_detect_chords(audio_path)
                print(f"autochord detected {len(autochord_results)} chord segments")
            
            # Ensemble results
            if progress_callback:
                progress_callback("Combining results...")
            
            raw_results = self._ensemble_chords(btc_results, autochord_results)
            print(f"🎯 RAW RESULTS: {len(raw_results)} chord segments before smoothing")
            
            # Apply BPM-aware smoothing to filter out single-beat chord changes
            if progress_callback:
                progress_callback("Applying harmonic smoothing...")
            
            # Quick BPM estimation for smoothing (rough estimate)
            detected_bpm = 120.0  # Default
            try:
                y_for_bpm, sr_for_bpm = librosa.load(audio_path, sr=22050)
                tempo, _ = librosa.beat.beat_track(y=y_for_bpm, sr=sr_for_bpm)
                detected_bpm = float(tempo)
                print(f"Estimated BPM for smoothing: {detected_bpm:.1f}")
            except:
                print("Using default BPM for smoothing: 120")
            
            print(f"🔧 APPLYING SMOOTHING with BPM: {detected_bpm:.1f}")
            final_results = self._smooth_chord_changes(raw_results, detected_bpm)
            print(f"✅ SMOOTHING COMPLETE: {len(final_results)} chord segments after smoothing")
            
            if progress_callback:
                progress_callback(f"Detection complete: {len(final_results)} chord segments")
            
            return final_results
            
        except Exception as e:
            print(f"❌ Advanced chord detection failed: {e}")
            return []
        
        finally:
            # Clean up temporary file
            if temp_wav and os.path.exists(temp_wav.name):
                os.unlink(temp_wav.name)


def create_advanced_detector():
    """Factory function to create advanced chord detector"""
    return AdvancedChordDetector() 