import librosa
import numpy as np
from typing import List, Dict, Tuple, Optional
import logging
import os
from pathlib import Path
import time

# Use only the Advanced detector (BTC-ISMIR19 + autochord)
try:
    from chord_detector_advanced import create_advanced_detector
    ADVANCED_AVAILABLE = True
    logger = logging.getLogger(__name__)
    logger.info("🧠 Advanced Chord Detection Engine available (BTC-ISMIR19 + autochord)")
except ImportError as e:
    logger = logging.getLogger(__name__)
    logger.error(f"Advanced detector not available: {e}")
    ADVANCED_AVAILABLE = False

# Set up logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

class ChordDetector:
    def __init__(self):
        """Initialize the chord detection system using only the Advanced (BTC-ISMIR19 + autochord) detector."""
        logger.info("ChordDetector initialization - Using only Advanced (BTC-ISMIR19 + autochord)")
        
        if ADVANCED_AVAILABLE:
            try:
                logger.info("🧠 Initializing Advanced Chord Detection Engine (BTC-ISMIR19 + autochord)...")
                self.detector = create_advanced_detector()
                self.detector_type = "advanced"
                logger.info("✅ Successfully initialized Advanced Chord Detection Engine")
            except Exception as e:
                logger.error(f"Advanced detector initialization failed: {e}")
                raise ImportError(f"Advanced chord detection engine failed to initialize: {e}")
        else:
            raise ImportError("Advanced chord detection engine not available")
    
    def detect_chords(self, audio_path: str, segment_duration: float = 2.0, 
                     simplicity_preference: float = 0.5, progress_callback=None) -> List[Dict]:
        """
        Detect chords in an audio file using the Advanced detector.
        
        Args:
            audio_path: Path to the audio file
            segment_duration: Duration of each analysis segment in seconds (ignored by Advanced detector)
            simplicity_preference: Preference for simpler chords (ignored by Advanced detector)
            progress_callback: Optional callback for progress updates
            
        Returns:
            List of chord segments with start time, end time, and chord name
        """
        logger.info(f"Starting Advanced chord detection for: {audio_path}")
        
        try:
            # Advanced detector returns tuples, convert to dict format
            chord_tuples = self.detector.detect_chords(audio_path, progress_callback)
            results = []
            for start_time, end_time, chord_name in chord_tuples:
                results.append({
                    'startTime': start_time,
                    'endTime': end_time,
                    'chord': chord_name
                })
            
            logger.info(f"Advanced detector completed: {len(results)} chord segments")
            return results
                
        except Exception as e:
            logger.error(f"Advanced detection failed: {e}")
            return [] 