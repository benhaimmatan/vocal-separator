"""
ChordSync: A Conformer-based Audio-to-Chord Synchroniser
Based on the 2024 paper by Andrea Poltronieri, Valentina Presutti, and Martín Rocamora
https://arxiv.org/abs/2408.00674

Note: This implementation uses chroma-based template matching as a fallback
since the actual pre-trained ChordSync model is not publicly available.
"""

import numpy as np
import librosa
import logging
from typing import List, Dict, Tuple, Optional
from scipy.ndimage import median_filter

logger = logging.getLogger(__name__)

class ChordSyncDetector:
    """ChordSync chord detection system using chroma-based template matching"""
    
    def __init__(self, model_path: Optional[str] = None, device: str = 'cpu'):
        self.device = device
        self.sr = 22050
        self.hop_length = 512
        
        # Define chord templates (chroma vectors)
        self.chord_templates = self._create_chord_templates()
        self.chord_names = list(self.chord_templates.keys())
        
        logger.info("Using chroma-based template matching for ChordSync")
        logger.info("ChordSync detector initialized successfully")
    
    def _create_chord_templates(self) -> Dict[str, np.ndarray]:
        """Create chroma templates for major and minor chords"""
        templates = {}
        
        # Improved chord templates with weighted harmonics
        # Major chord intervals: root (1.0), major third (0.8), perfect fifth (0.6)
        major_template = np.array([1.0, 0, 0, 0, 0.8, 0, 0, 0.6, 0, 0, 0, 0])
        
        # Minor chord intervals: root (1.0), minor third (0.8), perfect fifth (0.6)  
        minor_template = np.array([1.0, 0, 0, 0.8, 0, 0, 0, 0.6, 0, 0, 0, 0])
        
        # Create templates for all 12 keys
        note_names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
        
        for i, note in enumerate(note_names):
            # Major chords
            templates[note] = np.roll(major_template, i)
            # Minor chords  
            templates[f"{note}m"] = np.roll(minor_template, i)
        
        # Add no-chord template
        templates['N/C'] = np.zeros(12)
        
        return templates
    
    def _extract_chroma_features(self, audio: np.ndarray) -> np.ndarray:
        """Extract chroma features from audio"""
        # Use constant-Q transform for better harmonic representation
        chroma_cqt = librosa.feature.chroma_cqt(
            y=audio, 
            sr=self.sr,
            hop_length=self.hop_length,
            n_chroma=12,
            norm=2,
            fmin=librosa.note_to_hz('C1'),  # Add explicit frequency range
            n_octaves=7  # Cover more octaves for better harmonic content
        )
        
        # Enhance chroma features with better normalization
        chroma_cqt = librosa.util.normalize(chroma_cqt, axis=0)
        
        # Apply median filtering to reduce noise
        chroma_cqt = median_filter(chroma_cqt, size=(1, 3))
        
        return chroma_cqt
    
    def _match_chord_template(self, chroma_vector: np.ndarray) -> Tuple[str, float]:
        """Match chroma vector to chord template"""
        best_chord = 'N/C'
        best_score = 0.0
        
        # Normalize input chroma vector
        if np.sum(chroma_vector) > 0:
            chroma_vector = chroma_vector / np.sum(chroma_vector)
        else:
            return 'N/C', 0.3  # Return N/C for silent segments with lower confidence
        
        for chord_name, template in self.chord_templates.items():
            if chord_name == 'N/C':
                continue
                
            # Normalize template
            if np.sum(template) > 0:
                template_norm = template / np.sum(template)
            else:
                template_norm = template
            
            # Calculate correlation (higher is better)
            correlation = np.dot(chroma_vector, template_norm)
            
            if correlation > best_score:
                best_score = correlation
                best_chord = chord_name
        
        # Much more permissive threshold - matching modern detector
        if best_score < 0.05:  # Lowered from 0.25 to 0.05 for better chord detection
            best_chord = 'N/C'
            best_score = 0.3  # Fixed confidence for N/C (was incorrectly calculated as 1.0 - best_score)
        
        return best_chord, best_score
    
    def detect_chords(self, audio_path: str, segment_duration: float = 2.0, 
                     progress_callback=None) -> List[Dict]:
        """Detect chords in audio file"""
        logger.info(f"Starting ChordSync chord detection for: {audio_path}")
        
        try:
            # Load audio
            audio, sr = librosa.load(audio_path, sr=self.sr)
            logger.debug(f"Loaded audio: {len(audio)} samples at {sr}Hz")
            
            # Extract chroma features
            chroma = self._extract_chroma_features(audio)
            logger.debug(f"Extracted chroma features: {chroma.shape}")
            
            # Calculate segment parameters
            duration = len(audio) / sr
            num_segments = int(np.ceil(duration / segment_duration))
            frames_per_segment = int(segment_duration * sr / self.hop_length)
            
            logger.info(f"Processing {num_segments} segments")
            
            results = []
            
            for i in range(num_segments):
                start_time = i * segment_duration
                end_time = min((i + 1) * segment_duration, duration)
                
                # Get chroma frames for this segment
                start_frame = i * frames_per_segment
                end_frame = min((i + 1) * frames_per_segment, chroma.shape[1])
                
                if start_frame >= chroma.shape[1]:
                    break
                
                # Average chroma over segment
                segment_chroma = np.mean(chroma[:, start_frame:end_frame], axis=1)
                
                # Debug logging for first few segments
                if i < 5:
                    # Calculate scores for all chords to see what's happening
                    debug_scores = {}
                    normalized_chroma = segment_chroma / np.sum(segment_chroma) if np.sum(segment_chroma) > 0 else segment_chroma
                    
                    for chord_name, template in self.chord_templates.items():
                        if chord_name == 'N/C':
                            continue
                        template_norm = template / np.sum(template) if np.sum(template) > 0 else template
                        correlation = np.dot(normalized_chroma, template_norm)
                        debug_scores[chord_name] = correlation
                    
                    # Show top 5 chord candidates
                    top_5 = sorted(debug_scores.items(), key=lambda x: x[1], reverse=True)[:5]
                    logger.debug(f"Segment {i+1} - Top 5 candidates: {top_5}")
                    logger.debug(f"Segment {i+1} - Chroma energy: {np.sum(segment_chroma):.4f}")
                
                # Match to chord template
                chord, confidence = self._match_chord_template(segment_chroma)
                
                logger.debug(f"Segment {i+1}/{num_segments} - Detected: {chord} (confidence: {confidence:.3f})")
                
                results.append({
                    'startTime': start_time,
                    'endTime': end_time,
                    'chord': chord,
                    'confidence': confidence
                })
                
                # Progress callback
                if progress_callback:
                    progress = (i + 1) / num_segments
                    progress_callback(progress)
            
            logger.info(f"ChordSync detected {len(results)} chord segments")
            return results
            
        except Exception as e:
            logger.error(f"ChordSync detection failed: {e}")
            return []

def create_detector(model_path: Optional[str] = None, device: str = 'cpu') -> ChordSyncDetector:
    """Factory function to create ChordSync detector"""
    return ChordSyncDetector(model_path=model_path, device=device)

def get_chordsync_detector(model_path: Optional[str] = None, device: str = 'cpu') -> ChordSyncDetector:
    """Factory function to create ChordSync detector (alternative name for compatibility)"""
    return ChordSyncDetector(model_path=model_path, device=device) 