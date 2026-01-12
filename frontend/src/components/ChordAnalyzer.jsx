import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Square, Download, LayoutGrid, List } from 'lucide-react';
import ChordProgressionBar from './ChordProgressionBar';
import PianoChordDiagram from './PianoChordDiagram';
import ChordListView from './ChordListView';

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
    <div className="p-5">
      {/* Main Controls */}
      <div className="flex items-center gap-5 mb-4">
        {/* Play/Pause Button */}
        <button
          onClick={onPlayPause}
          className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 rounded-full flex items-center justify-center text-white transition-all duration-200 shadow-2xl shadow-blue-500/40 hover:scale-105 active:scale-95"
        >
          {isPlaying ? <Pause size={24} fill="white" /> : <Play size={24} fill="white" className="ml-1" />}
        </button>

        {/* Stop Button */}
        <button
          onClick={onStop}
          className="w-12 h-12 bg-zinc-700/80 hover:bg-zinc-600 rounded-xl flex items-center justify-center text-zinc-300 transition-all duration-200 border border-zinc-600/50 shadow-lg hover:shadow-xl"
        >
          <Square size={18} fill="currentColor" />
        </button>

        {/* Progress Bar Section */}
        <div className="flex-1 flex items-center gap-4">
          {/* Progress Bar */}
          <div
            className="flex-1 h-3 bg-zinc-700/50 rounded-full overflow-hidden cursor-pointer group border border-zinc-600/30"
            onClick={onSeek}
          >
            <div
              className="h-full bg-gradient-to-r from-blue-500 via-blue-400 to-purple-500 rounded-full transition-all duration-100 shadow-lg shadow-blue-500/30"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          {/* Time Display */}
          <div className="text-base font-mono text-zinc-300 font-medium min-w-[55px] bg-zinc-800/50 px-3 py-1 rounded-lg border border-zinc-700/50">
            {formatTime(currentTime)}
          </div>

          {/* Duration */}
          <div className="text-sm font-mono text-zinc-500 min-w-[55px]">
            / {formatTime(duration)}
          </div>
        </div>
      </div>

      {/* Capo Control */}
      <div className="flex items-center gap-4 bg-zinc-800/30 px-4 py-3 rounded-xl border border-zinc-700/30">
        <label className="text-sm font-semibold text-zinc-300 min-w-[50px]">Capo:</label>
        <input
          type="range"
          min="-12"
          max="12"
          value={capo}
          onChange={(e) => onCapoChange(parseInt(e.target.value))}
          className="flex-1 h-2 bg-zinc-700/50 rounded-lg appearance-none cursor-pointer slider"
        />
        <span className="text-base font-mono font-bold text-zinc-200 min-w-[40px] text-center bg-zinc-700/50 px-3 py-1 rounded-lg border border-zinc-600/50">
          {capo > 0 ? `+${capo}` : capo}
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
const ChordAnalyzer = ({ audioFile, chordData, detectedBPM, onBack, onMovingWindow, youtubeVideoId = null }) => {
  const audioRef = useRef(null);
  const youtubePlayerRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentChordIndex, setCurrentChordIndex] = useState(0);
  const [capo, setCapo] = useState(0);
  const [bpm, setBPM] = useState(detectedBPM || 120);  // Use backend BPM
  const [youtubeReady, setYoutubeReady] = useState(false);
  const [viewMode, setViewMode] = useState('timeline'); // 'timeline' or 'list'
  const scrollContainerRef = useRef(null);

  // Convert chord data to include beats and BPM info
  const processedChords = React.useMemo(() => {
    if (!chordData || chordData.length === 0) return [];
    
    return chordData.map((chord, index) => {
      const nextChord = chordData[index + 1];
      const duration = nextChord ? nextChord.time - chord.time : 4; // Default 4 seconds
      const beats = Math.max(1, Math.round((duration * bpm) / 60)); // Correct beat calculation
      
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

  // Load YouTube IFrame API
  useEffect(() => {
    if (!youtubeVideoId) return;

    // Load YouTube IFrame API script
    if (!window.YT) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

      window.onYouTubeIframeAPIReady = () => {
        setYoutubeReady(true);
      };
    } else {
      setYoutubeReady(true);
    }
  }, [youtubeVideoId]);

  // Initialize YouTube player
  useEffect(() => {
    // Only initialize in timeline mode
    if (!youtubeVideoId || !youtubeReady || viewMode !== 'timeline') return;

    // Check if player div exists (it only exists in timeline view)
    const playerDiv = document.getElementById('youtube-player');
    if (!playerDiv) return;

    // Destroy existing player if any
    if (youtubePlayerRef.current && youtubePlayerRef.current.destroy) {
      try {
        youtubePlayerRef.current.destroy();
      } catch (e) {
        console.warn('Error destroying YouTube player:', e);
      }
    }

    // Create new player instance
    youtubePlayerRef.current = new window.YT.Player('youtube-player', {
      videoId: youtubeVideoId,
      playerVars: {
        autoplay: 0,
        controls: 1,
        modestbranding: 1,
        rel: 0
      },
      events: {
        onReady: (event) => {
          setDuration(event.target.getDuration());
        },
        onStateChange: (event) => {
          // YouTube player state: 1 = playing, 2 = paused
          if (event.data === 1) {
            setIsPlaying(true);
            // Start sync interval
            const interval = setInterval(() => {
              if (youtubePlayerRef.current && youtubePlayerRef.current.getCurrentTime) {
                const time = youtubePlayerRef.current.getCurrentTime();
                setCurrentTime(time);
              }
            }, 100);
            youtubePlayerRef.current.syncInterval = interval;
          } else if (event.data === 2) {
            setIsPlaying(false);
            if (youtubePlayerRef.current.syncInterval) {
              clearInterval(youtubePlayerRef.current.syncInterval);
            }
          }
        }
      }
    });

    return () => {
      if (youtubePlayerRef.current && youtubePlayerRef.current.destroy) {
        try {
          youtubePlayerRef.current.destroy();
        } catch (e) {
          console.warn('Error cleaning up YouTube player:', e);
        }
      }
    };
  }, [youtubeVideoId, youtubeReady, viewMode]);

  // Audio event handlers
  const handlePlayPause = async () => {
    // Use YouTube player if available
    if (youtubeVideoId && youtubePlayerRef.current) {
      if (isPlaying) {
        youtubePlayerRef.current.pauseVideo();
      } else {
        youtubePlayerRef.current.playVideo();
      }
      return;
    }

    // Otherwise use audio element
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
    // Use YouTube player if available
    if (youtubeVideoId && youtubePlayerRef.current) {
      youtubePlayerRef.current.pauseVideo();
      youtubePlayerRef.current.seekTo(0);
      setIsPlaying(false);
      setCurrentTime(0);
      setCurrentChordIndex(0);
      return;
    }

    // Otherwise use audio element
    if (!audioRef.current) return;
    audioRef.current.pause();
    audioRef.current.currentTime = 0;
    setIsPlaying(false);
    setCurrentTime(0);
    setCurrentChordIndex(0);
  };

  const handleSeek = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    const newTime = percent * duration;

    // Use YouTube player if available
    if (youtubeVideoId && youtubePlayerRef.current) {
      youtubePlayerRef.current.seekTo(newTime);
      setCurrentTime(newTime);
      return;
    }

    // Otherwise use audio element
    if (!audioRef.current) return;
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
    if (!processedChords[chordIndex]) return;

    const targetTime = processedChords[chordIndex].time;

    // Use YouTube player if available
    if (youtubeVideoId && youtubePlayerRef.current) {
      youtubePlayerRef.current.seekTo(targetTime);
      setCurrentTime(targetTime);
      setCurrentChordIndex(chordIndex);
      return;
    }

    // Otherwise use audio element
    if (!audioRef.current) return;
    audioRef.current.currentTime = targetTime;
    setCurrentTime(targetTime);
    setCurrentChordIndex(chordIndex);
  };

  // Create audio URL (memoized to prevent recreation on every render)
  const audioUrl = React.useMemo(() => {
    // Only create blob URL for actual File objects, not YouTube videos
    if (!audioFile) return null;
    if (audioFile.youtubeVideoId) return null; // YouTube videos don't need blob URL
    return URL.createObjectURL(audioFile);
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

  // Get current chord info for piano display
  const getCurrentChord = () => {
    const currentIndex = processedChords.findIndex((chord, index) => {
      const nextChord = processedChords[index + 1];
      return currentTime >= chord.time && (!nextChord || currentTime < nextChord.time);
    });

    if (currentIndex >= 0) {
      return transposeChord(processedChords[currentIndex].chord, capo);
    }
    return null;
  };

  const currentChord = getCurrentChord();

  return (
    <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 text-zinc-100">
      {/* Header */}
      <div className="h-14 px-6 border-b border-zinc-800/80 flex items-center justify-between flex-shrink-0 bg-zinc-900/80 backdrop-blur-md shadow-lg">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="px-4 py-2 bg-zinc-800/80 hover:bg-zinc-700 rounded-lg text-sm font-medium transition-all duration-200 border border-zinc-700/50 shadow-sm hover:shadow-md"
          >
            ← Back
          </button>

          {/* View Mode Toggle */}
          <div className="flex items-center gap-1 bg-zinc-800/50 p-1 rounded-lg border border-zinc-700/50">
            <button
              onClick={() => setViewMode('timeline')}
              className={`
                flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-200
                ${viewMode === 'timeline'
                  ? 'bg-blue-500/30 text-blue-300 border border-blue-500/40 shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-300 hover:bg-zinc-700/50'
                }
              `}
            >
              <LayoutGrid size={16} />
              Timeline
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`
                flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-200
                ${viewMode === 'list'
                  ? 'bg-blue-500/30 text-blue-300 border border-blue-500/40 shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-300 hover:bg-zinc-700/50'
                }
              `}
            >
              <List size={16} />
              List
            </button>
          </div>

          <div>
            <h1 className="text-lg font-semibold text-zinc-100 tracking-tight">Chord Analyzer</h1>
          </div>
        </div>
        <div className="text-sm text-zinc-400 flex items-center gap-3">
          <span className="font-medium">{audioFile?.name}</span>
          <span className="text-zinc-500">•</span>
          <span>{processedChords.length} chords</span>
          <span className="text-zinc-500">•</span>
          <span>{Math.round(bpm)} BPM</span>
          <span className="px-2.5 py-1 bg-gradient-to-r from-purple-500/20 to-blue-500/20 text-purple-300 rounded-lg text-xs font-mono border border-purple-500/30">
            v2.3
          </span>
        </div>
      </div>

      {/* Audio Element (hidden, for uploaded files) */}
      {audioUrl && !youtubeVideoId && (
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

      {/* Main Content - Conditional View */}
      {viewMode === 'list' ? (
        /* List View - Printable Chord Progression */
        <ChordListView
          chordData={chordData}
          bpm={bpm}
          fileName={audioFile?.name}
          capo={capo}
          transposeChord={transposeChord}
        />
      ) : (
        /* Timeline View - Interactive Grid Layout */
        <div
          className="flex-1 p-6 overflow-hidden"
          style={{ height: 'calc(100vh - 56px)' }}
        >
          <div className="h-full grid grid-rows-[minmax(0,1fr)_280px_auto] gap-6">

            {/* Top Row - Video + Piano Grid */}
            <div className="grid grid-cols-[1.5fr_1fr] gap-6 min-h-0">

            {/* Left: YouTube Player / Audio Placeholder */}
            <div className="bg-gradient-to-br from-zinc-900/90 to-zinc-800/90 backdrop-blur-sm rounded-2xl border border-zinc-700/50 overflow-hidden shadow-2xl shadow-black/20 flex items-center justify-center">
              {youtubeVideoId ? (
                <div className="w-full h-full">
                  <div id="youtube-player" className="w-full h-full"></div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center p-8 text-center">
                  <div className="w-24 h-24 rounded-full bg-gradient-to-br from-zinc-800 to-zinc-900 border-2 border-zinc-700/50 flex items-center justify-center mb-6 shadow-lg">
                    <Play size={40} className="text-zinc-400 ml-1" />
                  </div>
                  <h3 className="text-xl font-semibold text-zinc-200 mb-2">
                    {audioFile?.name}
                  </h3>
                  <p className="text-sm text-zinc-500">
                    Audio-only playback
                  </p>
                </div>
              )}
            </div>

            {/* Right: Piano Visualization */}
            <div className="bg-gradient-to-br from-zinc-900/90 to-zinc-800/90 backdrop-blur-sm rounded-2xl border border-zinc-700/50 p-6 shadow-2xl shadow-black/20 flex flex-col">
              <h3 className="text-lg font-semibold text-zinc-200 mb-4 text-center tracking-tight">
                Now Playing
              </h3>

              {/* Current Chord Name */}
              <div className="mb-4 text-center">
                {currentChord && currentChord !== 'N' ? (
                  <div className="inline-block px-6 py-3 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-xl border-2 border-blue-500/40 shadow-lg">
                    <span className="text-4xl font-bold bg-gradient-to-r from-blue-300 to-purple-300 bg-clip-text text-transparent">
                      {currentChord}
                    </span>
                  </div>
                ) : (
                  <div className="inline-block px-6 py-3 bg-zinc-800/50 rounded-xl border border-zinc-700/50">
                    <span className="text-4xl font-bold text-zinc-600">—</span>
                  </div>
                )}
              </div>

              {/* Piano Visualization */}
              <div className="flex-1 flex items-center justify-center overflow-auto">
                <PianoChordDiagram chordName={currentChord || ''} />
              </div>
            </div>
          </div>

          {/* Middle Row - Chord Progression Timeline */}
          <div className="bg-gradient-to-br from-zinc-900/90 to-zinc-800/90 backdrop-blur-sm rounded-2xl border border-zinc-700/50 shadow-2xl shadow-black/20">
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

          {/* Bottom Row - Audio Player Controls */}
          <div className="shadow-2xl shadow-black/20">
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
          </div>

          </div>
        </div>
      )}

      {/* Custom CSS for slider */}
      <style>{`
        .slider::-webkit-slider-thumb {
          appearance: none;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: #3b82f6;
          cursor: pointer;
          border: 2px solid #fff;
          box-shadow: 0 0 8px rgba(59, 130, 246, 0.4);
        }

        .slider::-moz-range-thumb {
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: #3b82f6;
          cursor: pointer;
          border: 2px solid #fff;
          box-shadow: 0 0 8px rgba(59, 130, 246, 0.4);
        }

        .slider::-webkit-slider-thumb:hover {
          background: #60a5fa;
          box-shadow: 0 0 12px rgba(96, 165, 250, 0.6);
        }

        .slider::-moz-range-thumb:hover {
          background: #60a5fa;
          box-shadow: 0 0 12px rgba(96, 165, 250, 0.6);
        }
      `}</style>
    </div>
  );
};

export default ChordAnalyzer;