import os
import tempfile
from pathlib import Path
import shutil
import asyncio
import json
import re
import sys
import subprocess
import logging
import torch
import librosa
import numpy as np
import soundfile as sf
import essentia
import essentia.standard as es
from midiutil import MIDIFile
from typing import Tuple, List

logger = logging.getLogger(__name__)

# Import Modal client for GPU-based vocal separation
try:
    # Try importing from project root
    project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    if os.path.exists(os.path.join(project_root, "modal_functions.py")):
        sys.path.insert(0, project_root)
    from modal_functions import ModalClient
    MODAL_AVAILABLE = True
    logger.info("Modal client loaded successfully")
except ImportError as e:
    logger.warning(f"Modal not available: {e}. Vocal separation will require Modal.")
    MODAL_AVAILABLE = False
    ModalClient = None

class AudioProcessor:
    def __init__(self):
        self.base_dir = str(Path.home() / "Downloads" / "Vocals")
        os.makedirs(self.base_dir, exist_ok=True)
        self.progress_callback = None
        self.vocals_dir = os.path.join(self.base_dir, "vocals")
        self.accompaniment_dir = os.path.join(self.base_dir, "accompaniment")
        self.piano_dir = os.path.join(self.base_dir, "piano")
        self.midi_dir = os.path.join(self.base_dir, "midi")

        # Create directories if they don't exist
        for directory in [self.vocals_dir, self.accompaniment_dir, self.piano_dir, self.midi_dir]:
            if not os.path.exists(directory):
                os.makedirs(directory)

    def set_progress_callback(self, callback):
        self.progress_callback = callback

    async def _send_progress(self, progress: int, message: str = None):
        if self.progress_callback:
            data = {"progress": progress, "message": message or ""}
            try:
                await self.progress_callback(data)
                print(f"Sent progress: {progress}%, Message: {message}")
                await asyncio.sleep(0.1)
            except Exception as e:
                print(f"Error sending progress: {e}")

    async def process_audio(self, input_path, output_dir, output_options, progress_callback=None):
        """
        Process audio using Modal GPU for vocal separation.

        Args:
            input_path: Path to input audio file
            output_dir: Directory to save output files
            output_options: Dict with keys: vocals, accompaniment, piano
            progress_callback: Optional callback for progress updates

        Returns:
            Dict with paths to generated files
        """
        try:
            # Set progress callback if provided
            if progress_callback:
                self.progress_callback = progress_callback

            logger.debug(f"Processing audio:")
            logger.debug(f"Input path: {input_path}")
            logger.debug(f"Output directory: {output_dir}")
            logger.debug(f"Output options: {output_options}")

            # Check Modal availability
            if not MODAL_AVAILABLE or not ModalClient:
                raise Exception(
                    "Modal is required for vocal separation but not available. "
                    "Please set MODALTOKENID and MODALTOKENSECRET environment variables."
                )

            # Check Modal credentials
            modal_token_id = os.getenv("MODALTOKENID")
            modal_token_secret = os.getenv("MODALTOKENSECRET")

            if not modal_token_id or not modal_token_secret:
                raise Exception(
                    "Modal credentials not found. Please set MODALTOKENID and MODALTOKENSECRET "
                    "environment variables to enable vocal separation."
                )

            await self._send_progress(10, "Initializing...")

            # Create the output paths
            vocals_path = None
            accompaniment_path = None
            piano_path = None

            if output_options.get("vocals"):
                vocals_path = os.path.join(output_dir, f"{Path(input_path).stem}_vocals.mp3")

            if output_options.get("accompaniment"):
                accompaniment_path = os.path.join(output_dir, f"{Path(input_path).stem}_accompaniment.mp3")

            if output_options.get("piano"):
                piano_path = os.path.join(output_dir, f"{Path(input_path).stem}_piano.mp3")

            logger.debug(f"Output paths:")
            logger.debug(f"- Vocals: {vocals_path}")
            logger.debug(f"- Accompaniment: {accompaniment_path}")
            logger.debug(f"- Piano: {piano_path}")

            await self._send_progress(20, "Reading audio file...")

            # Read audio file as bytes for Modal
            with open(input_path, 'rb') as f:
                audio_data = f.read()

            logger.info(f"Audio file size: {len(audio_data)} bytes")

            await self._send_progress(30, "Sending to Modal GPU for separation...")

            # Call Modal GPU function for separation
            extract_vocals = output_options.get("vocals") or output_options.get("piano")
            extract_accompaniment = output_options.get("accompaniment")

            logger.info(f"Calling Modal with extract_vocals={extract_vocals}, extract_accompaniment={extract_accompaniment}")

            # Call Modal in a thread to avoid blocking
            loop = asyncio.get_event_loop()
            modal_result = await loop.run_in_executor(
                None,
                ModalClient.separate_audio,
                audio_data,
                extract_vocals,
                extract_accompaniment
            )

            logger.info(f"Modal result success: {modal_result.get('success')}")

            if not modal_result.get("success"):
                error_msg = modal_result.get("error", "Unknown error")
                raise Exception(f"Modal vocal separation failed: {error_msg}")

            await self._send_progress(70, "Processing separated audio...")

            results = {}

            # Save vocals if extracted
            if vocals_path and "vocals_data" in modal_result:
                with open(vocals_path, 'wb') as f:
                    f.write(modal_result["vocals_data"])
                results["vocals"] = str(vocals_path)
                results["vocals_path"] = str(vocals_path)
                logger.debug(f"Saved vocals to: {vocals_path}")
                logger.debug(f"Vocals file size: {Path(vocals_path).stat().st_size}")

            # Save accompaniment if extracted
            if accompaniment_path and "accompaniment_data" in modal_result:
                with open(accompaniment_path, 'wb') as f:
                    f.write(modal_result["accompaniment_data"])
                results["accompaniment"] = str(accompaniment_path)
                results["accompaniment_path"] = str(accompaniment_path)
                logger.debug(f"Saved accompaniment to: {accompaniment_path}")
                logger.debug(f"Accompaniment file size: {Path(accompaniment_path).stat().st_size}")

            # For piano extraction, we need vocals (will be processed separately for piano sound)
            if piano_path and "vocals_data" in modal_result:
                # For now, save vocals as piano (can be enhanced later with piano-specific processing)
                with open(piano_path, 'wb') as f:
                    f.write(modal_result["vocals_data"])
                results["piano"] = str(piano_path)
                results["piano_path"] = str(piano_path)
                logger.debug(f"Saved piano to: {piano_path}")
                logger.debug(f"Piano file size: {Path(piano_path).stat().st_size}")

            await self._send_progress(100, "Complete!")
            logger.debug("Processing completed successfully!")

            return results

        except Exception as e:
            logger.error(f"Error in process_audio: {e}")
            await self._send_progress(0, f"Error: {str(e)}")
            raise

    def convert_to_midi(self, audio_path: str, output_path: str,
                       note_threshold: float = 0.5,
                       polyphony: int = 4,
                       min_duration: float = 0.1) -> str:
        """
        Convert audio to MIDI using Essentia for note detection
        """
        # Load and process audio
        loader = es.MonoLoader(filename=audio_path)
        audio = loader()

        # Initialize algorithms
        w = es.Windowing(type='hann')
        spectrum = es.Spectrum()
        spectral_peaks = es.SpectralPeaks()
        hpcp = es.HPCP()
        key = es.Key()

        # Process frame by frame
        frame_size = 2048
        hop_size = 512
        notes = []

        for frame in es.FrameGenerator(audio, frameSize=frame_size, hopSize=hop_size):
            # Compute spectrum and peaks
            windowed_frame = w(frame)
            spec = spectrum(windowed_frame)
            frequencies, magnitudes = spectral_peaks(spec)

            # Compute HPCP and key
            hpcp_values = hpcp(frequencies, magnitudes)

            # Find dominant frequencies
            if len(frequencies) > 0:
                for freq, mag in zip(frequencies, magnitudes):
                    if mag > note_threshold:
                        # Convert frequency to MIDI note
                        midi_note = int(69 + 12 * np.log2(freq / 440.0))
                        if 21 <= midi_note <= 108:  # Piano range
                            notes.append({
                                'note': midi_note,
                                'velocity': int(min(127, mag * 127)),
                                'time': len(notes) * hop_size / 44100.0
                            })

        # Create MIDI file
        midi = MIDIFile(1)
        midi.addTrackName(0, 0, "Piano")
        midi.addTempo(0, 0, 120)

        # Add notes to MIDI
        for note in notes[:polyphony*100]:  # Limit notes to avoid huge files
            midi.addNote(
                track=0,
                channel=0,
                pitch=note['note'],
                time=note['time'],
                duration=min_duration,
                volume=note['velocity']
            )

        # Write to file
        with open(output_path, 'wb') as f:
            midi.writeFile(f)

        return output_path
