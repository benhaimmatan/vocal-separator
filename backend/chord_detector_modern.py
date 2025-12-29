import librosa
import numpy as np
from typing import List, Dict, Tuple, Optional
import logging
import os
from pathlib import Path
import time

# Set up logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

class ModernChordDetector:
    """
    Modern chord detection using advanced harmonic analysis techniques.
    This replaces the old madmom/librosa fallback system with state-of-the-art methods.
    """
    
    def __init__(self):
        logger.info("Initializing Modern Chord Detector with advanced harmonic analysis")
        
        # Enhanced chord templates with more sophisticated harmonic modeling
        self.chord_templates = self._generate_enhanced_chord_templates()
        
        # Chord quality weights (favor simple chords for popular music)
        self.chord_weights = {
            'major': 1.0,      # Strong preference for major chords
            'minor': 1.0,      # Equal preference for minor chords (was 0.95)
            '7': 0.85,         # Less penalty for 7th chords (was 0.7)
            'maj7': 0.8,       # Less penalty for maj7 (was 0.6)
            'min7': 0.85,      # Less penalty for min7 (was 0.65)
            'dim': 0.6,        # Less penalty for diminished (was 0.4)
            'aug': 0.5,        # Less penalty for augmented (was 0.3)
            'sus2': 0.7,       # Less penalty for sus2 (was 0.5)
            'sus4': 0.75,      # Less penalty for sus4 (was 0.55)
        }
        
        # Note names for chord labeling
        self.note_names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
        
        # Common chord progressions in popular music (for context weighting)
        self.common_progressions = [
            ['C', 'Am', 'F', 'G'],      # vi-IV-I-V in C
            ['G', 'Em', 'C', 'D'],      # vi-IV-I-V in G
            ['F', 'Dm', 'Bb', 'C'],     # vi-IV-I-V in F
            ['D', 'Bm', 'G', 'A'],      # vi-IV-I-V in D
            ['A', 'F#m', 'D', 'E'],     # vi-IV-I-V in A
            ['E', 'C#m', 'A', 'B'],     # vi-IV-I-V in E
            ['Bb', 'Gm', 'Eb', 'F'],    # vi-IV-I-V in Bb
        ]
        
        # Initialize harmonic analysis parameters
        self.sr = 22050  # Sample rate optimized for chord detection
        self.hop_length = 512
        self.n_fft = 4096
        self.n_chroma = 12
        
    def _generate_enhanced_chord_templates(self) -> Dict[str, List[np.ndarray]]:
        """Generate enhanced chord templates with harmonic overtones."""
        templates = {}
        
        # Define chord intervals with harmonic weights
        chord_definitions = {
            'major': [(0, 1.0), (4, 0.8), (7, 0.9)],           # Root, major third, fifth
            'minor': [(0, 1.0), (3, 0.8), (7, 0.9)],           # Root, minor third, fifth
            '7': [(0, 1.0), (4, 0.7), (7, 0.8), (10, 0.6)],    # Dominant 7th
            'maj7': [(0, 1.0), (4, 0.7), (7, 0.8), (11, 0.6)], # Major 7th
            'min7': [(0, 1.0), (3, 0.7), (7, 0.8), (10, 0.6)], # Minor 7th
            'dim': [(0, 1.0), (3, 0.7), (6, 0.8)],             # Diminished
            'aug': [(0, 1.0), (4, 0.7), (8, 0.8)],             # Augmented
            'sus2': [(0, 1.0), (2, 0.7), (7, 0.9)],            # Suspended 2nd
            'sus4': [(0, 1.0), (5, 0.7), (7, 0.9)],            # Suspended 4th
        }
        
        for chord_type, intervals in chord_definitions.items():
            chord_templates = []
            
            # Generate template for each root note
            for root in range(12):
                template = np.zeros(12)
                
                # Add fundamental frequencies
                for interval, weight in intervals:
                    note_idx = (root + interval) % 12
                    template[note_idx] = weight
                
                # Add harmonic overtones (octaves and fifths)
                for interval, weight in intervals:
                    note_idx = (root + interval) % 12
                    # Add octave harmonics (reduced weight)
                    template[note_idx] += weight * 0.3
                    # Add fifth harmonics
                    fifth_idx = (note_idx + 7) % 12
                    template[fifth_idx] += weight * 0.2
                
                # Normalize template
                if np.sum(template) > 0:
                    template = template / np.sum(template)
                
                chord_templates.append(template)
            
            templates[chord_type] = chord_templates
        
        return templates
    
    def detect_chords(self, audio_path: str, segment_duration: float = 2.0, progress_callback=None) -> List[Dict]:
        """
        Detect chords using modern harmonic analysis techniques.
        
        Args:
            audio_path: Path to the audio file
            segment_duration: Duration of each analysis segment in seconds
            progress_callback: Optional callback for progress updates
            
        Returns:
            List of chord detection results with timestamps
        """
        try:
            logger.info(f"Starting modern chord detection for: {audio_path}")
            
            if progress_callback:
                progress_callback(5, "Loading audio with optimized parameters...")
            
            # Load audio with optimal parameters for chord detection
            y, sr = librosa.load(audio_path, sr=self.sr, mono=True)
            total_duration = librosa.get_duration(y=y, sr=sr)
            
            logger.info(f"Audio loaded: {total_duration:.2f}s at {sr}Hz")
            
            if progress_callback:
                progress_callback(15, "Extracting harmonic features...")
            
            # Extract enhanced harmonic features
            chroma_features = self._extract_enhanced_chroma(y, sr)
            
            if progress_callback:
                progress_callback(40, "Analyzing chord progressions...")
            
            # Segment-wise chord detection
            chords = []
            num_segments = max(1, int(np.ceil(total_duration / segment_duration)))
            
            for i, start_time in enumerate(np.arange(0, total_duration, segment_duration)):
                end_time = min(start_time + segment_duration, total_duration)
                
                # Calculate progress
                segment_progress = 40 + int(50 * (i + 1) / num_segments)
                if progress_callback:
                    progress_callback(segment_progress, f"Analyzing segment {i+1}/{num_segments}")
                
                # Extract segment features
                start_frame = librosa.time_to_frames(start_time, sr=sr, hop_length=self.hop_length)
                end_frame = librosa.time_to_frames(end_time, sr=sr, hop_length=self.hop_length)
                
                if start_frame < chroma_features.shape[1] and end_frame > start_frame:
                    end_frame = min(end_frame, chroma_features.shape[1])
                    segment_chroma = chroma_features[:, start_frame:end_frame]
                    
                    # Detect chord for this segment
                    chord = self._detect_chord_advanced(segment_chroma, i, chords)
                    
                    chords.append({
                        'startTime': float(start_time),
                        'endTime': float(end_time),
                        'chord': chord
                    })
            
            if progress_callback:
                progress_callback(95, "Applying harmonic smoothing...")
            
            # Apply temporal smoothing and harmonic context
            chords = self._apply_harmonic_smoothing(chords)
            
            if progress_callback:
                progress_callback(100, "Modern chord detection complete")
            
            logger.info(f"Detected {len(chords)} chord segments using modern analysis")
            return chords
            
        except Exception as e:
            logger.error(f"Error in modern chord detection: {str(e)}", exc_info=True)
            raise
    
    def _extract_enhanced_chroma(self, y: np.ndarray, sr: int) -> np.ndarray:
        """Extract enhanced chroma features with harmonic analysis."""
        
        # DEBUG: Check audio data
        logger.debug(f"Audio data - Length: {len(y)}, Max: {np.max(np.abs(y)):.4f}, RMS: {np.sqrt(np.mean(y**2)):.4f}")
        
        # Use Constant-Q Transform for better frequency resolution
        chroma_cqt = librosa.feature.chroma_cqt(
            y=y, 
            sr=sr,
            hop_length=self.hop_length,
            n_chroma=self.n_chroma,
            bins_per_octave=36,  # High resolution
            norm=2
        )
        
        # DEBUG: Check chroma data
        logger.debug(f"Chroma CQT - Shape: {chroma_cqt.shape}, Max: {np.max(chroma_cqt):.4f}, Mean: {np.mean(chroma_cqt):.4f}")
        
        # Extract harmonic content using harmonic-percussive separation
        y_harmonic, _ = librosa.effects.hpss(y, margin=8)
        
        # Get chroma from harmonic component
        chroma_harmonic = librosa.feature.chroma_cqt(
            y=y_harmonic,
            sr=sr,
            hop_length=self.hop_length,
            n_chroma=self.n_chroma,
            bins_per_octave=36,
            norm=2
        )
        
        # DEBUG: Check harmonic chroma
        logger.debug(f"Chroma Harmonic - Shape: {chroma_harmonic.shape}, Max: {np.max(chroma_harmonic):.4f}, Mean: {np.mean(chroma_harmonic):.4f}")
        
        # Combine both chroma representations
        chroma_combined = 0.7 * chroma_cqt + 0.3 * chroma_harmonic
        
        # Apply median filtering to reduce noise
        from scipy.ndimage import median_filter
        chroma_filtered = median_filter(chroma_combined, size=(1, 3))
        
        # DEBUG: Check final chroma
        logger.debug(f"Chroma Final - Shape: {chroma_filtered.shape}, Max: {np.max(chroma_filtered):.4f}, Mean: {np.mean(chroma_filtered):.4f}")
        
        return chroma_filtered
    
    def _detect_chord_advanced(self, chroma_segment: np.ndarray, segment_idx: int, previous_chords: List[Dict]) -> str:
        """Advanced chord detection with harmonic context and progression analysis."""
        
        if chroma_segment.shape[1] == 0:
            return "N/C"
        
        # Average chroma over time with weighted emphasis on stable regions
        chroma_avg = np.mean(chroma_segment, axis=1)
        
        # Enhance harmonic relationships
        chroma_enhanced = self._enhance_harmonic_relationships(chroma_avg)
        
        # Calculate chord scores
        chord_scores = {}
        
        for chord_type, templates in self.chord_templates.items():
            for root_idx, template in enumerate(templates):
                # Calculate correlation score
                correlation = np.dot(chroma_enhanced, template)
                
                # Apply chord quality weight
                quality_weight = self.chord_weights.get(chord_type, 0.5)
                
                # Calculate final score
                score = correlation * quality_weight
                
                # Format chord name
                root_note = self.note_names[root_idx]
                chord_name = self._format_chord_name(root_note, chord_type)
                
                chord_scores[chord_name] = score
        
        # Apply progression context if we have previous chords
        if previous_chords and len(previous_chords) >= 1:
            chord_scores = self._apply_progression_context(chord_scores, previous_chords)
        
        # Find best chord
        if not chord_scores:
            return "N/C"
        
        best_chord = max(chord_scores.items(), key=lambda x: x[1])[0]
        best_score = chord_scores[best_chord]
        
        # DEBUG: Log top chord scores for first few segments
        if segment_idx < 5:  # Show more segments for debugging
            top_5 = sorted(chord_scores.items(), key=lambda x: x[1], reverse=True)[:5]
            logger.debug(f"Segment {segment_idx} - Top 5 chords: {top_5}")
            logger.debug(f"Segment {segment_idx} - Best: {best_chord} (score: {best_score:.4f})")
            logger.debug(f"Segment {segment_idx} - Chroma avg: {chroma_avg}")
            logger.debug(f"Segment {segment_idx} - Chroma enhanced: {chroma_enhanced}")
        
        # MUCH MORE PERMISSIVE: Lower threshold significantly (was 0.15, now 0.05)
        if best_score < 0.05:  # Very permissive threshold
            logger.debug(f"Segment {segment_idx} - Score {best_score:.4f} below threshold 0.05, returning N/C")
            return "N/C"
        
        logger.debug(f"Segment {segment_idx} - Detected chord: {best_chord} (score: {best_score:.4f})")
        return best_chord
    
    def _enhance_harmonic_relationships(self, chroma: np.ndarray) -> np.ndarray:
        """Enhance harmonic relationships in chroma vector."""
        enhanced = np.copy(chroma)
        
        # Boost notes that have strong harmonic support
        for i in range(12):
            root_strength = chroma[i]
            
            # Check for fifth relationship
            fifth_idx = (i + 7) % 12
            fifth_strength = chroma[fifth_idx]
            
            # Check for major third
            major_third_idx = (i + 4) % 12
            major_third_strength = chroma[major_third_idx]
            
            # Check for minor third
            minor_third_idx = (i + 3) % 12
            minor_third_strength = chroma[minor_third_idx]
            
            # Boost root if it has strong harmonic support
            harmonic_support = fifth_strength + max(major_third_strength, minor_third_strength)
            
            if harmonic_support > 0.3 and root_strength > 0.1:
                enhanced[i] *= (1.0 + harmonic_support * 0.5)
        
        # Normalize
        if np.sum(enhanced) > 0:
            enhanced = enhanced / np.sum(enhanced)
        
        return enhanced
    
    def _apply_progression_context(self, chord_scores: Dict[str, float], previous_chords: List[Dict]) -> Dict[str, float]:
        """Apply harmonic progression context to chord scores."""
        
        if not previous_chords:
            return chord_scores
        
        # Get the last chord
        last_chord = previous_chords[-1]['chord']
        
        # Boost scores for chords that commonly follow the last chord
        progression_boosts = self._get_progression_boosts(last_chord)
        
        enhanced_scores = {}
        for chord, score in chord_scores.items():
            boost = progression_boosts.get(chord, 1.0)
            enhanced_scores[chord] = score * boost
        
        return enhanced_scores
    
    def _get_progression_boosts(self, last_chord: str) -> Dict[str, float]:
        """Get progression boost factors based on common chord progressions."""
        
        # Common chord transitions in popular music
        common_transitions = {
            'C': {'Am': 1.3, 'F': 1.4, 'G': 1.5, 'Dm': 1.2, 'Em': 1.1},
            'Am': {'F': 1.4, 'G': 1.3, 'C': 1.2, 'Dm': 1.3},
            'F': {'G': 1.5, 'C': 1.4, 'Am': 1.2, 'Dm': 1.3},
            'G': {'C': 1.5, 'Am': 1.3, 'Em': 1.2, 'F': 1.1},
            'Dm': {'G': 1.4, 'C': 1.3, 'Am': 1.2, 'F': 1.3},
            'Em': {'Am': 1.3, 'C': 1.2, 'G': 1.2, 'F': 1.1},
            
            # Add more common progressions for other keys
            'Bb': {'Gm': 1.3, 'Eb': 1.4, 'F': 1.5, 'Dm': 1.2, 'Cm': 1.1},
            'Gm': {'Eb': 1.4, 'F': 1.3, 'Bb': 1.2, 'Dm': 1.3},
            'Eb': {'F': 1.5, 'Bb': 1.4, 'Gm': 1.2, 'Cm': 1.3},
            'Cm': {'F': 1.4, 'Bb': 1.3, 'Gm': 1.2, 'Eb': 1.3},
        }
        
        return common_transitions.get(last_chord, {})
    
    def _apply_harmonic_smoothing(self, chords: List[Dict]) -> List[Dict]:
        """Apply temporal smoothing to reduce chord detection noise."""
        
        if len(chords) < 3:
            return chords
        
        smoothed_chords = []
        
        for i, chord_info in enumerate(chords):
            current_chord = chord_info['chord']
            
            # Look at neighboring chords
            prev_chord = chords[i-1]['chord'] if i > 0 else None
            next_chord = chords[i+1]['chord'] if i < len(chords) - 1 else None
            
            # If current chord is different from both neighbors and is very short
            if (prev_chord and next_chord and 
                current_chord != prev_chord and current_chord != next_chord and
                prev_chord == next_chord and
                (chord_info['endTime'] - chord_info['startTime']) < 1.0):
                
                # Replace with the neighboring chord
                smoothed_chord = dict(chord_info)
                smoothed_chord['chord'] = prev_chord
                smoothed_chords.append(smoothed_chord)
            else:
                smoothed_chords.append(chord_info)
        
        return smoothed_chords
    
    def _format_chord_name(self, root_note: str, chord_type: str) -> str:
        """Format chord name based on root note and chord type."""
        if chord_type == 'major':
            return root_note
        elif chord_type == 'minor':
            return f"{root_note}m"
        elif chord_type == 'min7':
            return f"{root_note}m7"
        else:
            return f"{root_note}{chord_type}" 