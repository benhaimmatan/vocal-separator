#!/usr/bin/env python3
"""
Test script to analyze beat detection accuracy for the Hebrew song "נאמר כבר הכל"
specifically around seconds 38-40 where timing issues were reported.
"""

import sys
import os
sys.path.append('backend')

import logging
from backend.analysis import detect_beat_structure

# Set up logging to see debug output
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

def analyze_beat_timing(audio_path, target_start=36, target_end=42):
    """Analyze beat timing around a specific time range."""
    print(f"🎵 Analyzing beat detection for: {audio_path}")
    print(f"📍 Focus area: {target_start}-{target_end} seconds")
    print("=" * 60)
    
    # Run enhanced beat detection
    result = detect_beat_structure(audio_path)
    
    bpm = result.get('tempo', 120)
    beats = result.get('beats', [])
    
    print(f"📊 Detection Results:")
    print(f"  • BPM: {bpm}")
    print(f"  • Total beats: {len(beats)}")
    print(f"  • Expected beat interval: {60.0/bpm:.3f}s")
    print()
    
    if not beats:
        print("❌ No beats detected!")
        return
    
    # Find beats in target range
    target_beats = []
    for i, beat in enumerate(beats):
        if target_start <= beat <= target_end:
            target_beats.append((i, beat))
    
    print(f"🎯 Beats in target range ({target_start}-{target_end}s):")
    if not target_beats:
        print("  No beats found in target range!")
        return
    
    expected_interval = 60.0 / bpm
    
    for i, (beat_idx, beat_time) in enumerate(target_beats):
        marker = ""
        if 38 <= beat_time <= 40:
            marker = " <<< PROBLEM AREA"
        print(f"  Beat {beat_idx}: {beat_time:.3f}s{marker}")
    
    print()
    print("📏 Beat interval analysis:")
    
    for i in range(1, len(target_beats)):
        prev_beat = target_beats[i-1][1]
        curr_beat = target_beats[i][1]
        interval = curr_beat - prev_beat
        error = abs(interval - expected_interval)
        error_pct = (error / expected_interval) * 100
        
        status = "✅ Good"
        if error_pct > 15:
            status = "⚠️  Warning"
        if error_pct > 25:
            status = "❌ Poor"
            
        print(f"  {prev_beat:.3f} → {curr_beat:.3f}: {interval:.3f}s (exp: {expected_interval:.3f}s, error: {error:.3f}s / {error_pct:.1f}%) {status}")
    
    print()
    print("🔍 Analysis around B and C#m chord timing (38-40s):")
    
    # Check specific timing around 38-40 seconds
    beats_38_40 = [b for b in beats if 37.5 <= b <= 40.5]
    if beats_38_40:
        print(f"  Beats near 38-40s: {[f'{b:.3f}' for b in beats_38_40]}")
        
        # Check if beats are evenly spaced
        if len(beats_38_40) >= 2:
            intervals = [beats_38_40[i+1] - beats_38_40[i] for i in range(len(beats_38_40)-1)]
            avg_interval = sum(intervals) / len(intervals)
            interval_std = (sum((x - avg_interval)**2 for x in intervals) / len(intervals))**0.5
            consistency = (1.0 - interval_std/avg_interval) * 100
            
            print(f"  Average interval: {avg_interval:.3f}s")
            print(f"  Consistency: {consistency:.1f}%")
            
            if consistency < 80:
                print("  ⚠️  Inconsistent beat spacing detected!")
                print("  This could cause the 'clicking' and visualization issues.")
    else:
        print("  ❌ No beats found in 38-40s range!")

if __name__ == "__main__":
    # Look for the Hebrew song file
    song_paths = [
        "/Users/matanbenhaim/Downloads/Vocals/החברים של נטאשה  - נאמר כבר הכל/החברים של נטאשה  - נאמר כבר הכל.mp3",
        "backend/test_audio.mp3",  # fallback for testing
    ]
    
    audio_path = None
    for path in song_paths:
        if os.path.exists(path):
            audio_path = path
            break
    
    if audio_path:
        analyze_beat_timing(audio_path)
    else:
        print("❌ Could not find the Hebrew song file!")
        print("Available paths checked:")
        for path in song_paths:
            print(f"  • {path}") 