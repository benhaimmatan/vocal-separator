import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Square, Download } from 'lucide-react';
import ChordProgressionBar from './ChordProgressionBar';

// Chord Card Component
const ChordCard = ({ chord, bpm, beats, isActive, isNext, onClick }) => {
  const getChordColor = (chordName) => {
    if (!chordName || chordName === 'N') return 'bg-zinc-700';
    
    // Major chords - warmer colors
    if (!chordName.includes('m') && !chordName.includes('#')) {
      return 'bg-yellow-500/20 border-yellow-500/40 text-yellow-400';
    }
    // Minor chords - cooler colors  
    if (chordName.includes('m')) {
      return 'bg-blue-500/20 border-blue-500/40 text-blue-400';
    }
    // Sharp/flat chords - purple/red
    return 'bg-red-500/20 border-red-500/40 text-red-400';
  };

  const cardColor = isActive 
    ? 'bg-red-500/30 border-red-500 text-red-300' 
    : isNext 
      ? 'bg-violet-500/20 border-violet-500/40 text-violet-400'
      : getChordColor(chord.chord);

  return (
    <div
      onClick={onClick}
      className={`
        flex-shrink-0 w-32 h-24 p-3 rounded-xl border-2 cursor-pointer transition-all duration-300
        hover:scale-105 hover:shadow-lg backdrop-blur-sm
        ${cardColor}
      `}
    >
      {/* BPM Display */}
      <div className="text-xs font-bold text-center mb-1">
        {Math.round(bpm || 120)}
      </div>
      
      {/* Chord Name */}
      <div className="text-lg font-bold text-center mb-1">
        {chord.chord || 'N'}
      </div>
      
      {/* Beats Duration */}
      <div className="text-xs text-center opacity-75">
        {beats} beats
      </div>
    </div>
  );
};

// Audio Player Controls
const AudioPlayerControls = ({ 
  audioRef, 
  isPlaying, 
  onPlayPause, 
  onStop, 
  currentTime, 
  duration, 
  onSeek,
  capo,
  onCapoChange 
}) => {
  const formatTime = (time) => {
    if (!time || isNaN(time)) return '00:00';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const progressPercent = duration ? (currentTime / duration) * 100 : 0;

  return (
    <div className="bg-zinc-900/80 backdrop-blur-sm rounded-xl p-4 border border-zinc-700/50">
      {/* Main Controls */}
      <div className="flex items-center gap-4 mb-4">
        <button
          onClick={onPlayPause}
          className="w-14 h-14 bg-red-500 hover:bg-red-400 rounded-full flex items-center justify-center text-white transition-all duration-200 shadow-lg shadow-red-500/25"
        >
          {isPlaying ? <Pause size={20} /> : <Play size={20} />}
        </button>
        
        <button
          onClick={onStop}
          className="w-10 h-10 bg-zinc-700 hover:bg-zinc-600 rounded-lg flex items-center justify-center text-zinc-300 transition-colors"
        >
          <Square size={16} />
        </button>

        <div className="flex-1 flex items-center gap-3">
          {/* Progress Bar */}
          <div 
            className="flex-1 h-2 bg-zinc-700 rounded-full overflow-hidden cursor-pointer group"
            onClick={onSeek}
          >
            <div
              className="h-full bg-gradient-to-r from-red-500 to-red-400 rounded-full transition-all duration-100 group-hover:from-red-400 group-hover:to-red-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          
          {/* Time Display */}
          <div className="text-sm font-mono text-zinc-400 min-w-[45px]">
            {formatTime(currentTime)}
          </div>
        </div>
      </div>

      {/* Capo Control */}
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-zinc-400">Capo:</label>
        <input
          type="range"
          min="-12"
          max="12"
          value={capo}
          onChange={(e) => onCapoChange(parseInt(e.target.value))}
          className="flex-1 h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer slider"
        />
        <span className="text-sm font-mono text-zinc-300 min-w-[20px]">
          {capo}
        </span>
      </div>
    </div>
  );
};

// BPM Detection Component
const BPMDetector = ({ audioData, onBPMDetected }) => {
  useEffect(() => {
    // Simple BPM detection - in real implementation, this would analyze the audio
    // For now, we'll estimate based on chord changes
    if (audioData && audioData.length > 0) {
      // Calculate average time between chord changes
      const intervals = [];
      for (let i = 1; i < audioData.length; i++) {
        intervals.push(audioData[i].time - audioData[i-1].time);
      }
      
      if (intervals.length > 0) {
        const avgInterval = intervals.reduce((a, b) => a + b) / intervals.length;
        // Estimate BPM based on chord changes (assuming 1-4 chords per measure)
        const estimatedBPM = Math.round(60 / (avgInterval / 2)); // Rough estimate
        onBPMDetected(Math.max(60, Math.min(180, estimatedBPM))); // Clamp to reasonable range
      }
    }
  }, [audioData, onBPMDetected]);

  return null;
};

// Main Chord Analyzer Component
const ChordAnalyzer = ({ audioFile, chordData, onBack, onMovingWindow }) => {
  const audioRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentChordIndex, setCurrentChordIndex] = useState(0);
  const [capo, setCapo] = useState(0);
  const [bpm, setBPM] = useState(120);
  const scrollContainerRef = useRef(null);

  // Convert chord data to include beats and BPM info
  const processedChords = React.useMemo(() => {
    if (!chordData || chordData.length === 0) return [];
    
    return chordData.map((chord, index) => {
      const nextChord = chordData[index + 1];
      const duration = nextChord ? nextChord.time - chord.time : 4; // Default 4 seconds
      const beats = Math.max(1, Math.round((duration / 60) * bpm * 4)); // Estimate beats
      
      return {
        ...chord,
        duration,
        beats,
        index,
        startTime: chord.time,
        endTime: nextChord ? nextChord.time : chord.time + duration
      };
    });
  }, [chordData, bpm]);

  // Apply capo transposition
  const transposeChord = (chordName, capoFrets) => {
    if (!chordName || chordName === 'N' || capoFrets === 0) return chordName;
    
    const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const chordRegex = /^([A-G][#b]?)(.*)$/;
    const match = chordName.match(chordRegex);
    
    if (!match) return chordName;
    
    const [, root, suffix] = match;
    const normalizedRoot = root.replace('b', '#');
    const rootIndex = notes.indexOf(normalizedRoot);
    
    if (rootIndex === -1) return chordName;
    
    const newRootIndex = (rootIndex + capoFrets + 12) % 12;
    return notes[newRootIndex] + suffix;
  };

  // Audio event handlers
  const handlePlayPause = async () => {
    if (!audioRef.current) return;
    
    try {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        await audioRef.current.play();
        setIsPlaying(true);
      }
    } catch (error) {
      console.error('Audio play error:', error);
      setIsPlaying(false);
    }
  };

  const handleStop = () => {
    if (!audioRef.current) return;
    audioRef.current.pause();
    audioRef.current.currentTime = 0;
    setIsPlaying(false);
    setCurrentTime(0);
    setCurrentChordIndex(0);
  };

  const handleSeek = (e) => {
    if (!audioRef.current) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    const newTime = percent * duration;
    
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const handleTimeUpdate = () => {
    if (!audioRef.current) return;
    setCurrentTime(audioRef.current.currentTime);
    
    // Update current chord based on time
    const newIndex = processedChords.findIndex((chord, index) => {
      const nextChord = processedChords[index + 1];
      return audioRef.current.currentTime >= chord.time && 
             (!nextChord || audioRef.current.currentTime < nextChord.time);
    });
    
    if (newIndex !== -1 && newIndex !== currentChordIndex) {
      setCurrentChordIndex(newIndex);
      
      // Auto-scroll to current chord
      if (scrollContainerRef.current) {
        const cardWidth = 140; // Card width + margin
        const scrollPosition = newIndex * cardWidth - scrollContainerRef.current.offsetWidth / 2;
        scrollContainerRef.current.scrollTo({
          left: scrollPosition,
          behavior: 'smooth'
        });
      }
    }
  };

  const jumpToChord = (chordIndex) => {
    if (!audioRef.current || !processedChords[chordIndex]) return;
    
    const targetTime = processedChords[chordIndex].time;
    audioRef.current.currentTime = targetTime;
    setCurrentTime(targetTime);
    setCurrentChordIndex(chordIndex);
  };

  // Create audio URL (memoized to prevent recreation on every render)
  const audioUrl = React.useMemo(() => {
    return audioFile ? URL.createObjectURL(audioFile) : null;
  }, [audioFile]);

  // Cleanup blob URL when component unmounts or audioFile changes
  useEffect(() => {
    return () => {
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [audioUrl]);

  // Debug logging
  useEffect(() => {
    console.log('🎵 Audio Player Debug:', {
      hasAudioFile: !!audioFile,
      audioFileName: audioFile?.name,
      audioUrl: audioUrl?.substring(0, 50),
      hasAudioRef: !!audioRef.current,
      isPlaying,
      duration,
      currentTime
    });
  }, [audioFile, audioUrl, isPlaying, duration, currentTime]);

  return (
    <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-gradient-to-br from-zinc-950 to-zinc-900 text-zinc-100">
      {/* Header */}
      <div className="h-14 px-6 border-b border-zinc-800 flex items-center justify-between flex-shrink-0 bg-zinc-900/50">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm font-medium transition-colors"
          >
            ← Back
          </button>
          <div>
            <h1 className="text-lg font-semibold text-zinc-100">Chord Analyzer</h1>
          </div>
        </div>
        <div className="text-sm text-zinc-400">
          {audioFile?.name} • {processedChords.length} chords • BPM {bpm}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        <div className="p-6 max-w-6xl mx-auto space-y-6">
          {/* Audio Element */}
          {audioUrl && (
            <audio
              ref={audioRef}
              src={audioUrl}
              onLoadedMetadata={(e) => setDuration(e.target.duration)}
              onTimeUpdate={handleTimeUpdate}
              onEnded={() => setIsPlaying(false)}
              onError={(e) => {
                console.error('Audio error:', e);
              }}
              preload="metadata"
            />
          )}

          {/* BPM Detection */}
        <BPMDetector audioData={processedChords} onBPMDetected={setBPM} />

        {/* Enhanced Chord Progression Display */}
        <div className="bg-zinc-900/50 backdrop-blur-sm rounded-xl border border-zinc-700/50">
          <ChordProgressionBar
            detectedChords={processedChords.map(chord => ({
              ...chord,
              chord: transposeChord(chord.chord, capo)
            }))}
            detectedBeats={[]}
            currentTime={currentTime}
            duration={duration}
            isPlaying={isPlaying}
            bpm={bpm}
            selectedFile={true}
          />
        </div>

        {/* Audio Player Controls */}
        <AudioPlayerControls
          audioRef={audioRef}
          isPlaying={isPlaying}
          onPlayPause={handlePlayPause}
          onStop={handleStop}
          currentTime={currentTime}
          duration={duration}
          onSeek={handleSeek}
          capo={capo}
          onCapoChange={setCapo}
        />

        {/* Chord Details Table */}
        <div className="bg-zinc-900/50 backdrop-blur-sm rounded-xl border border-zinc-700/50 overflow-hidden">
          <div className="p-4 border-b border-zinc-700/50">
            <h3 className="font-semibold text-zinc-200">Chord Timeline</h3>
          </div>
          <div className="max-h-96 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-zinc-800/50">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">#</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">Time</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">Chord</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">Duration</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">Confidence</th>
                </tr>
              </thead>
              <tbody>
                {processedChords.map((chord, index) => (
                  <tr 
                    key={index} 
                    className={`border-b border-zinc-700/30 last:border-0 hover:bg-zinc-800/30 cursor-pointer transition-colors ${
                      index === currentChordIndex ? 'bg-red-500/10' : ''
                    }`}
                    onClick={() => jumpToChord(index)}
                  >
                    <td className="px-4 py-3 text-zinc-500 font-mono">{index + 1}</td>
                    <td className="px-4 py-3 font-mono text-zinc-400">{chord.time.toFixed(2)}s</td>
                    <td className="px-4 py-3 font-bold text-zinc-100">{transposeChord(chord.chord, capo)}</td>
                    <td className="px-4 py-3 text-zinc-400">{chord.duration.toFixed(1)}s</td>
                    <td className="px-4 py-3 text-zinc-400">{(chord.confidence * 100).toFixed(0)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Custom CSS for slider */}
      <style jsx>{`
        .slider::-webkit-slider-thumb {
          appearance: none;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: #ef4444;
          cursor: pointer;
          border: 2px solid #fff;
          box-shadow: 0 0 0 1px rgba(0,0,0,0.1);
        }
        
        .slider::-moz-range-thumb {
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: #ef4444;
          cursor: pointer;
          border: 2px solid #fff;
          box-shadow: 0 0 0 1px rgba(0,0,0,0.1);
        }
      `}</style>
      </div>
    </div>
  );
};

export default ChordAnalyzer;