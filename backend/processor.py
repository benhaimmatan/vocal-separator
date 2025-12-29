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
        try:
            # Set progress callback if provided
            if progress_callback:
                self.progress_callback = progress_callback
            
            logger.debug(f"Processing audio:")
            logger.debug(f"Input path: {input_path}")
            logger.debug(f"Output directory: {output_dir}")
            logger.debug(f"Output options: {output_options}")
            
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
            
            with tempfile.TemporaryDirectory() as temp_dir:
                demucs_output_dir = Path(temp_dir) / "output"
                demucs_output_dir.mkdir(exist_ok=True)
                logger.debug(f"Created temporary directory: {demucs_output_dir}")

                # Choose model and stems based on what we're extracting
                if output_options.get("piano"):
                    # Use 6-stem model for piano extraction
                    model = 'htdemucs_6s'
                    cmd = [
                        'demucs',
                        '-n', model,
                        '--mp3',
                        '--mp3-bitrate', '320',
                        '--device', 'cpu',
                        '--segment', '7',
                        '--overlap', '0.1',
                        '--jobs', '2',
                        '--out', str(demucs_output_dir),
                        str(input_path)
                    ]
                else:
                    # Use 2-stem model for vocals only
                    model = 'htdemucs'
                    cmd = [
                        'demucs',
                        '--two-stems=vocals',
                        '-n', model,
                        '--mp3',
                        '--mp3-bitrate', '320',
                        '--device', 'cpu',
                        '--segment', '7',
                        '--overlap', '0.1',
                        '--jobs', '2',
                        '--out', str(demucs_output_dir),
                        str(input_path)
                    ]

                logger.debug(f"Running command: {' '.join(cmd)}")
                
                process = await asyncio.create_subprocess_exec(
                    *cmd,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE
                )

                # Process the output in real-time
                last_progress = 0
                while True:
                    line = await process.stderr.readline()
                    if not line and process.stderr.at_eof():
                        break
                        
                    line = line.decode().strip()
                    logger.debug(f"Demucs output: {line}")

                    if "progress" in line.lower():
                        try:
                            progress = int(re.search(r'(\d+)%', line).group(1))
                            if progress > last_progress:
                                await self._send_progress(progress, "Processing audio...")
                                last_progress = progress
                        except:
                            pass

                stdout, stderr = await process.communicate()
                
                if process.returncode != 0:
                    logger.error(f"Demucs stderr: {stderr.decode()}")
                    logger.error(f"Demucs stdout: {stdout.decode()}")
                    raise Exception(f"Demucs process failed with return code {process.returncode}")

                # Copy the processed files
                model_name = 'htdemucs_6s' if output_options.get("piano") else 'htdemucs'
                demucs_output_path = demucs_output_dir / model_name / Path(input_path).stem
                logger.debug(f"Demucs output path: {demucs_output_path}")
                
                # List contents of output directory
                logger.debug("Output directory contents:")
                for item in demucs_output_path.glob("*"):
                    logger.debug(f"- {item}")

                results = {}
                
                if output_options.get("vocals") and vocals_path:
                    vocals_src = demucs_output_path / "vocals.mp3"
                    if vocals_src.exists():
                        shutil.copy2(vocals_src, vocals_path)
                        results["vocals"] = str(vocals_path)
                        results["vocals_path"] = str(vocals_path)
                        logger.debug(f"Copied vocals to: {vocals_path}")
                        logger.debug(f"Vocals file exists: {Path(vocals_path).exists()}")
                        logger.debug(f"Vocals file size: {Path(vocals_path).stat().st_size}")

                if output_options.get("piano") and piano_path:
                    piano_src = demucs_output_path / "piano.mp3"
                    if piano_src.exists():
                        shutil.copy2(piano_src, piano_path)
                        results["piano"] = str(piano_path)
                        results["piano_path"] = str(piano_path)
                        logger.debug(f"Copied piano to: {piano_path}")
                        logger.debug(f"Piano file exists: {Path(piano_path).exists()}")
                        logger.debug(f"Piano file size: {Path(piano_path).stat().st_size}")

                if output_options.get("accompaniment") and accompaniment_path:
                    no_vocals_src = demucs_output_path / "no_vocals.mp3"
                    if no_vocals_src.exists():
                        shutil.copy2(no_vocals_src, accompaniment_path)
                        results["accompaniment"] = str(accompaniment_path)
                        results["accompaniment_path"] = str(accompaniment_path)
                        logger.debug(f"Copied accompaniment to: {accompaniment_path}")
                        logger.debug(f"Accompaniment file exists: {Path(accompaniment_path).exists()}")
                        logger.debug(f"Accompaniment file size: {Path(accompaniment_path).stat().st_size}")

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
            key_data = key(hpcp_values)
            
            # Extract notes above threshold
            for i, magnitude in enumerate(magnitudes):
                if magnitude > note_threshold:
                    freq = frequencies[i]
                    midi_note = self._freq_to_midi(freq)
                    if midi_note:
                        notes.append((midi_note, frame_size * len(notes) / 44100.0, magnitude))
        
        # Convert notes to MIDI
        midi = MIDIFile(1)
        midi.addTempo(0, 0, 120)
        
        # Group notes by time and apply polyphony limit
        grouped_notes = self._group_notes(notes, polyphony, min_duration)
        
        # Add notes to MIDI file
        for note, start_time, duration, velocity in grouped_notes:
            midi.addNote(0, 0, note, start_time, duration, int(velocity * 127))
        
        # Write MIDI file
        with open(output_path, "wb") as f:
            midi.writeFile(f)
        
        return output_path

    def _freq_to_midi(self, freq: float) -> int:
        """Convert frequency to MIDI note number"""
        if freq <= 0:
            return None
        return int(round(69 + 12 * np.log2(freq / 440.0)))

    def _group_notes(self, notes: List[Tuple[int, float, float]], 
                    polyphony: int, 
                    min_duration: float) -> List[Tuple[int, float, float, float]]:
        """Group notes by time and apply polyphony limit"""
        if not notes:
            return []
        
        # Sort notes by time
        notes = sorted(notes, key=lambda x: x[1])
        
        # Group notes that start at similar times
        grouped = []
        current_group = []
        current_time = notes[0][1]
        
        for note in notes:
            if abs(note[1] - current_time) < min_duration:
                current_group.append(note)
            else:
                # Process current group
                if current_group:
                    # Sort by magnitude and take top N based on polyphony
                    current_group.sort(key=lambda x: x[2], reverse=True)
                    for n in current_group[:polyphony]:
                        # Calculate duration until next note
                        next_time = note[1]
                        duration = max(min_duration, next_time - n[1])
                        grouped.append((n[0], n[1], duration, n[2]))
                
                current_group = [note]
                current_time = note[1]
        
        # Process last group
        if current_group:
            current_group.sort(key=lambda x: x[2], reverse=True)
            for n in current_group[:polyphony]:
                duration = max(min_duration, 0.5)  # Default duration for last notes
                grouped.append((n[0], n[1], duration, n[2]))
        
        return grouped
