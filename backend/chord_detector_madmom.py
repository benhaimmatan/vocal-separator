"""
Madmom-based Chord Detection
Using the Deep Chroma Extractor and chord recognition from the madmom library
"""

import numpy as np
import librosa
import logging
from typing import List, Dict, Tuple, Optional

logger = logging.getLogger(__name__)

try:
    import madmom
    from madmom.features.chords import DeepChromaProcessor, CRFChordRecognitionProcessor
    from madmom.audio import SignalProcessor, FramedSignalProcessor
    from madmom.audio.stft import ShortTimeFourierTransformProcessor
    from madmom.audio.spectrogram import FilteredSpectrogramProcessor, LogarithmicSpectrogramProcessor
    MADMOM_AVAILABLE = True
    logger.info("Madmom library available for chord detection")
except ImportError as e:
    MADMOM_AVAILABLE = False
    logger.warning(f"Madmom not available: {e}")

class MadmomChordDetector:
    """Madmom-based chord detection using Deep Chroma Extractor"""
    
    def __init__(self):
        if not MADMOM_AVAILABLE:
            raise ImportError("Madmom library is required but not available")
        
        # Initialize processors
        self.sig_proc = SignalProcessor(num_channels=1, sample_rate=44100)
        self.fsig_proc = FramedSignalProcessor(frame_size=8192, hop_size=4410)
        self.stft_proc = ShortTimeFourierTransformProcessor()
        self.filt_proc = FilteredSpectrogramProcessor(
            num_bands=24, fmin=65, fmax=2100, norm_filters=True
        )
        self.log_proc = LogarithmicSpectrogramProcessor(add=1)
        
        # Deep chroma processor
        self.chroma_proc = DeepChromaProcessor()
        
        # CRF chord recognition processor
        self.chord_proc = CRFChordRecognitionProcessor()
        
        # Chord vocabulary (24 major/minor + diminished + augmented + N/C)
        self.chord_vocab = self._build_chord_vocabulary()
        
        logger.info("Madmom chord detector initialized successfully")
    
    def _build_chord_vocabulary(self):
        """Build comprehensive chord vocabulary"""
        chords = ['N/C']  # No chord
        roots = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
        
        for root in roots:
            chords.extend([
                f"{root}",      # Major
                f"{root}m",     # Minor
                f"{root}dim",   # Diminished
                f"{root}aug",   # Augmented
                f"{root}7",     # Dominant 7th
                f"{root}maj7",  # Major 7th
                f"{root}m7",    # Minor 7th
            ])
        
        return chords
    
    def detect_chords(self, audio_path: str, segment_duration: float = 2.0, 
                     progress_callback=None) -> List[Dict]:
        """
        Detect chords using Madmom Deep Chroma Extractor
        
        Args:
            audio_path: Path to audio file
            segment_duration: Duration of each segment in seconds
            progress_callback: Optional callback for progress updates
            
        Returns:
            List of chord segments
        """
        logger.info(f"Starting Madmom chord detection for: {audio_path}")
        
        try:
            # Process audio through the pipeline
            signal = self.sig_proc(audio_path)
            frames = self.fsig_proc(signal)
            stft = self.stft_proc(frames)
            filt = self.filt_proc(stft)
            log_filt = self.log_proc(filt)
            
            # Extract deep chroma features
            chroma = self.chroma_proc(log_filt)
            
            # Recognize chords
            chords = self.chord_proc(chroma)
            
            # Convert to our format
            results = []
            fps = 44100 / 4410  # Frames per second based on hop size
            
            for i, (chord_label, confidence) in enumerate(chords):
                start_time = i / fps
                end_time = (i + 1) / fps
                
                # Map chord label to our vocabulary
                chord_name = self._map_chord_label(chord_label)
                
                # Apply confidence threshold
                if confidence < 0.1:
                    chord_name = 'N/C'
                
                results.append({
                    'startTime': start_time,
                    'endTime': end_time,
                    'chord': chord_name
                })
                
                # Progress callback
                if progress_callback and i % 10 == 0:
                    progress = min(1.0, i / len(chords))
                    progress_callback({
                        'type': 'chord_detection',
                        'status': 'processing',
                        'message': progress,
                        'progress': f'Madmom processing frame {i}/{len(chords)}'
                    })
            
            # Group consecutive identical chords
            grouped_results = self._group_consecutive_chords(results, segment_duration)
            
            logger.info(f"Madmom detected {len(grouped_results)} chord segments")
            return grouped_results
            
        except Exception as e:
            logger.error(f"Madmom detection failed: {e}")
            raise
    
    def _map_chord_label(self, chord_label: str) -> str:
        """Map madmom chord label to our vocabulary"""
        # Madmom uses different chord notation, map to our format
        if chord_label == 'N' or chord_label == 'X':
            return 'N/C'
        
        # Handle basic major/minor chords
        if ':' in chord_label:
            root, quality = chord_label.split(':', 1)
            if quality == 'maj':
                return root
            elif quality == 'min':
                return f"{root}m"
            elif quality == 'dim':
                return f"{root}dim"
            elif quality == 'aug':
                return f"{root}aug"
            elif quality == '7':
                return f"{root}7"
            elif quality == 'maj7':
                return f"{root}maj7"
            elif quality == 'min7':
                return f"{root}m7"
        
        # Default mapping
        return chord_label if chord_label in self.chord_vocab else 'N/C'
    
    def _group_consecutive_chords(self, results: List[Dict], 
                                 min_duration: float = 2.0) -> List[Dict]:
        """Group consecutive identical chords into longer segments"""
        if not results:
            return []
        
        grouped = []
        current_chord = results[0]['chord']
        start_time = results[0]['startTime']
        
        for i in range(1, len(results)):
            if results[i]['chord'] != current_chord:
                # End current group
                end_time = results[i-1]['endTime']
                if end_time - start_time >= min_duration:
                    grouped.append({
                        'startTime': start_time,
                        'endTime': end_time,
                        'chord': current_chord
                    })
                
                # Start new group
                current_chord = results[i]['chord']
                start_time = results[i]['startTime']
        
        # Add final group
        end_time = results[-1]['endTime']
        if end_time - start_time >= min_duration:
            grouped.append({
                'startTime': start_time,
                'endTime': end_time,
                'chord': current_chord
            })
        
        return grouped

class SimpleMadmomDetector:
    """Simplified Madmom detector using basic chroma features"""
    
    def __init__(self):
        # Basic chord templates for major and minor chords
        self.chord_templates = self._create_chord_templates()
        self.chord_names = ['N/C'] + [f"{root}{quality}" 
                                     for root in ['C', 'C#', 'D', 'D#', 'E', 'F', 
                                                 'F#', 'G', 'G#', 'A', 'A#', 'B']
                                     for quality in ['', 'm']]
        
        logger.info("Simple Madmom detector initialized")
    
    def _create_chord_templates(self):
        """Create chord templates for major and minor chords"""
        templates = []
        
        # No chord template
        templates.append(np.zeros(12))
        
        # Major and minor chord templates
        for root in range(12):
            # Major chord (root, major third, perfect fifth)
            major_template = np.zeros(12)
            major_template[root] = 1.0
            major_template[(root + 4) % 12] = 0.8
            major_template[(root + 7) % 12] = 0.6
            templates.append(major_template)
            
            # Minor chord (root, minor third, perfect fifth)
            minor_template = np.zeros(12)
            minor_template[root] = 1.0
            minor_template[(root + 3) % 12] = 0.8
            minor_template[(root + 7) % 12] = 0.6
            templates.append(minor_template)
        
        return np.array(templates)
    
    def detect_chords(self, audio_path: str, segment_duration: float = 2.0, 
                     progress_callback=None) -> List[Dict]:
        """Simple chord detection using chroma features"""
        logger.info(f"Starting simple Madmom chord detection for: {audio_path}")
        
        try:
            # Load audio
            y, sr = librosa.load(audio_path, sr=22050)
            
            # Extract chroma features
            chroma = librosa.feature.chroma_stft(y=y, sr=sr, hop_length=512)
            
            # Calculate segment parameters
            frames_per_segment = int(segment_duration * sr / 512)
            num_segments = max(1, chroma.shape[1] // frames_per_segment)
            
            results = []
            
            for i in range(num_segments):
                start_frame = i * frames_per_segment
                end_frame = min(start_frame + frames_per_segment, chroma.shape[1])
                
                # Average chroma over segment
                segment_chroma = np.mean(chroma[:, start_frame:end_frame], axis=1)
                
                # Normalize
                if np.sum(segment_chroma) > 0:
                    segment_chroma = segment_chroma / np.sum(segment_chroma)
                
                # Find best matching chord template
                correlations = np.dot(self.chord_templates, segment_chroma)
                best_chord_idx = np.argmax(correlations)
                confidence = correlations[best_chord_idx]
                
                # Apply threshold
                if confidence < 0.3:
                    chord_name = 'N/C'
                else:
                    chord_name = self.chord_names[best_chord_idx]
                
                # Calculate timing
                start_time = i * segment_duration
                end_time = min((i + 1) * segment_duration, len(y) / sr)
                
                results.append({
                    'startTime': start_time,
                    'endTime': end_time,
                    'chord': chord_name
                })
                
                logger.debug(f"Segment {i+1}/{num_segments} - Detected: {chord_name} "
                           f"(confidence: {confidence:.3f})")
                
                # Progress callback
                if progress_callback:
                    progress = (i + 1) / num_segments
                    progress_callback({
                        'type': 'chord_detection',
                        'status': 'processing',
                        'message': progress,
                        'progress': f'Simple Madmom processing segment {i+1}/{num_segments}'
                    })
            
            logger.info(f"Simple Madmom detected {len(results)} chord segments")
            return results
            
        except Exception as e:
            logger.error(f"Simple Madmom detection failed: {e}")
            raise

def get_madmom_detector() -> MadmomChordDetector:
    """Factory function to create Madmom detector"""
    if MADMOM_AVAILABLE:
        return MadmomChordDetector()
    else:
        logger.warning("Madmom not available, using simple detector")
        return SimpleMadmomDetector() 