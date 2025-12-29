import logging
from pathlib import Path

# Set up logging
logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

# Constants
VOCALS_DIR = Path.home() / "Downloads" / "Vocals"
VOCALS_DIR.mkdir(exist_ok=True, parents=True)
HISTORY_FILE = VOCALS_DIR / "processing_history.json"
logger.info(f"HISTORY_FILE path: {HISTORY_FILE}")

# Check if advanced analysis libraries are available
try:
    import librosa
    import numpy as np
    ADVANCED_ANALYSIS_AVAILABLE = True
except ImportError:
    logger.warning("Advanced analysis libraries (librosa, numpy) not available. Will use fallback timing.")
    ADVANCED_ANALYSIS_AVAILABLE = False 