import librosa
import numpy as np

# Load the actual song
audio_path = '/Users/matanbenhaim/Downloads/Vocals/אריק איינשטיין אגדת דשא Arik Einstein/אריק איינשטיין אגדת דשא Arik Einstein.mp3'
y, sr = librosa.load(audio_path, sr=22050)
duration = librosa.get_duration(y=y, sr=sr)

print(f'Song duration: {duration:.1f} seconds')

# Analyze energy levels to detect intro/vocal sections
hop_length = 512
frame_length = 2048
energy = librosa.feature.rms(y=y, frame_length=frame_length, hop_length=hop_length)[0]
times = librosa.frames_to_time(np.arange(len(energy)), sr=sr, hop_length=hop_length)

# Find vocal onset (where energy significantly increases)
energy_smooth = np.convolve(energy, np.ones(10)/10, mode='same')
energy_threshold = np.mean(energy_smooth) + 0.5 * np.std(energy_smooth)
vocal_start_candidates = times[energy_smooth > energy_threshold]

if len(vocal_start_candidates) > 0:
    vocal_start = vocal_start_candidates[0]
    print(f'Estimated vocal start: {vocal_start:.1f} seconds')
else:
    print('Could not detect vocal start')

# Skip beat tracking due to scipy issue
print(f'Skipping beat analysis due to scipy compatibility issue')

# Analyze spectral features to detect vocal presence
mfccs = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=13)
spectral_centroids = librosa.feature.spectral_centroid(y=y, sr=sr)[0]
spectral_rolloff = librosa.feature.spectral_rolloff(y=y, sr=sr)[0]

# Vocal detection heuristic: higher spectral centroid + energy
vocal_indicator = (spectral_centroids > np.percentile(spectral_centroids, 60)) & (energy > np.percentile(energy, 40))
vocal_times = times[vocal_indicator]

if len(vocal_times) > 0:
    print(f'First vocal activity detected at: {vocal_times[0]:.1f} seconds')
    
    # Find sustained vocal activity (not just brief moments)
    vocal_segments = []
    current_start = vocal_times[0]
    current_end = vocal_times[0]
    
    for t in vocal_times[1:]:
        if t - current_end < 2.0:  # Gap less than 2 seconds
            current_end = t
        else:
            if current_end - current_start > 3.0:  # Segment longer than 3 seconds
                vocal_segments.append((current_start, current_end))
            current_start = t
            current_end = t
    
    # Add the last segment
    if current_end - current_start > 3.0:
        vocal_segments.append((current_start, current_end))
    
    print(f'Sustained vocal segments: {vocal_segments}')
    
    if vocal_segments:
        actual_vocal_start = vocal_segments[0][0]
        print(f'ACTUAL VOCAL START: {actual_vocal_start:.1f} seconds')
else:
    print('No vocal activity detected')

# Analyze the first 30 seconds in detail
print(f'\nFirst 30 seconds analysis:')
for i in range(0, min(30, int(duration)), 5):
    start_idx = int(i * sr / hop_length)
    end_idx = int((i + 5) * sr / hop_length)
    if end_idx < len(energy):
        avg_energy = np.mean(energy[start_idx:end_idx])
        avg_centroid = np.mean(spectral_centroids[start_idx:end_idx])
        print(f'{i:2d}-{i+5:2d}s: Energy={avg_energy:.3f}, Centroid={avg_centroid:.0f}Hz')

# More detailed analysis around the suspected vocal start
print(f'\nDetailed analysis around vocal start:')
for i in range(0, 20):
    start_idx = int(i * sr / hop_length)
    end_idx = int((i + 1) * sr / hop_length)
    if end_idx < len(energy):
        avg_energy = np.mean(energy[start_idx:end_idx])
        avg_centroid = np.mean(spectral_centroids[start_idx:end_idx])
        is_vocal = avg_energy > np.percentile(energy, 40) and avg_centroid > np.percentile(spectral_centroids, 60)
        marker = "🎤" if is_vocal else "🎵"
        print(f'{i:2d}s: {marker} Energy={avg_energy:.3f}, Centroid={avg_centroid:.0f}Hz') 