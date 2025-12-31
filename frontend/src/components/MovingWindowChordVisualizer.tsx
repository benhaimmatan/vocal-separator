import React, { useRef, useEffect, useState, useMemo, useCallback, memo } from 'react';
import { ChordNode, Progression, LegacyChordData, ProcessedChord } from '../types/chord';
import { usePlaybackEngine } from '../hooks/usePlaybackEngine';

interface MovingWindowProps {
  audioFile: File | null;
  chordData: LegacyChordData[] | null;
  audioRef: React.RefObject<HTMLAudioElement>;
  bpm?: number;
  onBack: () => void;
}

// Convert legacy chord data to our new format
const convertLegacyToProgression = (
  legacyChords: LegacyChordData[], 
  detectedBpm: number
): Progression | null => {
  if (!legacyChords || legacyChords.length === 0) return null;

  // Process chords with durations
  const processedChords: ProcessedChord[] = legacyChords.map((chord, index) => {
    const nextChord = legacyChords[index + 1];
    const duration = nextChord ? nextChord.time - chord.time : 4;
    const beats = Math.max(1, Math.round((duration / 60) * detectedBpm * 4));
    
    return {
      ...chord,
      duration,
      beats,
      index
    };
  });

  // Convert to ChordNode format
  const nodes: ChordNode[] = processedChords.map((chord, index) => ({
    id: `chord-${index}`,
    chordName: chord.chord || 'N',
    durationBeats: chord.beats,
    startTime: chord.time,
    confidence: chord.confidence
  }));

  const totalBeats = nodes.reduce((sum, node) => sum + node.durationBeats, 0);

  return {
    id: 'main-progression',
    nodes,
    bpm: detectedBpm,
    totalBeats,
    timeSignature: [4, 4] as [number, number]
  };
};

// Individual chord card with enhanced styling and spring animations
const ChordCard: React.FC<{
  chord: ChordNode;
  state: 'previous' | 'current' | 'next';
  beatProgress?: number; // 0-1 for current chord
  onClick?: () => void;
  transitionKey?: string; // For triggering animations on chord changes
}> = memo(({ chord, state, beatProgress = 0, onClick, transitionKey }) => {
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Trigger transition animation when chord changes
  useEffect(() => {
    if (transitionKey) {
      setIsTransitioning(true);
      const timer = setTimeout(() => setIsTransitioning(false), 300);
      return () => clearTimeout(timer);
    }
  }, [transitionKey]);

  const getChordColor = (chordName: string, cardState: string) => {
    // Enhanced spring-based transitions with chord-specific colors
    const baseTransition = 'transition-all duration-300 transform ease-out';
    const springTransition = isTransitioning ? 'animate-pulse' : '';
    
    // Color mapping based on chord types
    const getChordSpecificColor = (name: string) => {
      if (!name || name === 'N') return 'zinc';
      if (!name.includes('m') && !name.includes('#') && !name.includes('b')) return 'yellow'; // Major
      if (name.includes('m')) return 'blue'; // Minor
      return 'purple'; // Altered chords
    };

    const chordColor = getChordSpecificColor(chordName);
    
    if (cardState === 'current') {
      return `${baseTransition} ${springTransition} bg-red-500/30 border-red-500 text-red-200 scale-110 shadow-lg shadow-red-500/25 ring-2 ring-red-500/20`;
    }
    
    if (cardState === 'previous') {
      return `${baseTransition} bg-zinc-600/20 border-zinc-600/40 text-zinc-500 scale-95 opacity-60 translate-x-[-2px]`;
    }
    
    if (cardState === 'next') {
      const colorMap = {
        yellow: 'bg-yellow-500/15 border-yellow-500/30 text-yellow-400',
        blue: 'bg-blue-500/15 border-blue-500/30 text-blue-400', 
        purple: 'bg-purple-500/15 border-purple-500/30 text-purple-400',
        zinc: 'bg-zinc-500/15 border-zinc-500/30 text-zinc-400'
      };
      return `${baseTransition} ${colorMap[chordColor]} scale-95 opacity-80 translate-x-[2px]`;
    }
    
    return `${baseTransition} bg-zinc-700/20 border-zinc-700/40 text-zinc-400`;
  };

  // Enhanced progress animation with easing
  const progressWidth = state === 'current' ? `${beatProgress * 100}%` : '0%';
  const progressOpacity = state === 'current' ? 1 : 0;

  return (
    <div
      onClick={onClick}
      className={`
        relative flex-shrink-0 w-40 h-32 p-4 rounded-xl border-2 cursor-pointer backdrop-blur-sm
        ${getChordColor(chord.chordName, state)}
      `}
    >
      {/* Enhanced progress indicator for current chord */}
      <div 
        className="absolute bottom-0 left-0 right-0 h-1 bg-black/10 rounded-b-xl overflow-hidden transition-opacity duration-300"
        style={{ opacity: progressOpacity }}
      >
        <div 
          className="h-full bg-gradient-to-r from-red-400 to-red-300 transition-all duration-100 ease-out shadow-sm"
          style={{ width: progressWidth }}
        />
        {/* Glow effect */}
        <div 
          className="absolute top-0 h-full bg-red-400/50 blur-sm transition-all duration-100 ease-out"
          style={{ width: progressWidth }}
        />
      </div>
      
      {/* State indicator */}
      <div className="text-xs font-bold text-center mb-2 opacity-60">
        {state === 'previous' && '← PREV'}
        {state === 'current' && '● NOW'}
        {state === 'next' && 'NEXT →'}
      </div>
      
      {/* Chord Name */}
      <div className="text-2xl font-bold text-center mb-2">
        {chord.chordName}
      </div>
      
      {/* Duration */}
      <div className="text-sm text-center opacity-75">
        {chord.durationBeats} beats
      </div>

      {/* Confidence indicator */}
      {chord.confidence && (
        <div className="absolute top-2 right-2 text-xs opacity-50">
          {Math.round(chord.confidence * 100)}%
        </div>
      )}
    </div>
  );
});

// BPM Detection similar to existing ChordAnalyzer
const useBPMDetection = (chordData: LegacyChordData[] | null): number => {
  return useMemo(() => {
    if (!chordData || chordData.length === 0) return 120;

    const intervals = [];
    for (let i = 1; i < chordData.length; i++) {
      intervals.push(chordData[i].time - chordData[i-1].time);
    }
    
    if (intervals.length > 0) {
      const avgInterval = intervals.reduce((a, b) => a + b) / intervals.length;
      const estimatedBPM = Math.round(60 / (avgInterval / 2));
      return Math.max(60, Math.min(180, estimatedBPM));
    }
    
    return 120;
  }, [chordData]);
};

export const MovingWindowChordVisualizer: React.FC<MovingWindowProps> = ({
  audioFile,
  chordData,
  audioRef,
  bpm: propBpm,
  onBack
}) => {
  // Auto-detect BPM from chord data if not provided
  const detectedBpm = useBPMDetection(chordData);
  const finalBpm = propBpm || detectedBpm;

  // Convert legacy data to new format
  const progression = useMemo(() => {
    return chordData ? convertLegacyToProgression(chordData, finalBpm) : null;
  }, [chordData, finalBpm]);

  // Use our playback engine
  const { playbackState, currentWindow, jumpToChord } = usePlaybackEngine(progression, audioRef);
  
  // Calculate beat progress within current chord
  const beatProgress = useMemo(() => {
    if (!currentWindow || !progression) return 0;
    
    // Calculate how far we are into the current chord
    let cumulativeBeats = 0;
    const activeIndex = playbackState.activeChordIndex;
    
    for (let i = 0; i < activeIndex; i++) {
      cumulativeBeats += progression.nodes[i].durationBeats;
    }
    
    const beatsIntoCurrentChord = playbackState.currentBeat - cumulativeBeats;
    const currentChordDuration = progression.nodes[activeIndex]?.durationBeats || 1;
    
    return Math.min(1, Math.max(0, beatsIntoCurrentChord / currentChordDuration));
  }, [currentWindow, progression, playbackState.currentBeat, playbackState.activeChordIndex]);

  // Audio controls
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  
  // Transition tracking for smooth animations
  const [transitionKey, setTransitionKey] = useState('');
  const [prevActiveChordIndex, setPrevActiveChordIndex] = useState(0);

  useEffect(() => {
    setIsPlaying(playbackState.isPlaying);
    setCurrentTime(playbackState.currentTime);
  }, [playbackState.isPlaying, playbackState.currentTime]);

  // Detect chord changes for transition animations
  useEffect(() => {
    if (playbackState.activeChordIndex !== prevActiveChordIndex) {
      setTransitionKey(`chord-${playbackState.activeChordIndex}-${Date.now()}`);
      setPrevActiveChordIndex(playbackState.activeChordIndex);
    }
  }, [playbackState.activeChordIndex, prevActiveChordIndex]);

  const handlePlayPause = useCallback(() => {
    if (!audioRef.current) return;
    
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
  }, [isPlaying]);

  const handleStop = useCallback(() => {
    if (!audioRef.current) return;
    audioRef.current.pause();
    audioRef.current.currentTime = 0;
  }, []);

  const formatTime = useCallback((time: number) => {
    if (!time || isNaN(time)) return '00:00';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }, []);

  // Memoized click handlers for chord navigation
  const handlePreviousChordClick = useCallback(() => {
    jumpToChord(playbackState.activeChordIndex - 1);
  }, [jumpToChord, playbackState.activeChordIndex]);

  const handleCurrentChordClick = useCallback(() => {
    jumpToChord(playbackState.activeChordIndex);
  }, [jumpToChord, playbackState.activeChordIndex]);

  const handleNextChordClick = useCallback(() => {
    jumpToChord(playbackState.activeChordIndex + 1);
  }, [jumpToChord, playbackState.activeChordIndex]);

  const progressPercent = duration ? (currentTime / duration) * 100 : 0;

  // Create audio URL
  const audioUrl = audioFile ? URL.createObjectURL(audioFile) : null;

  if (!progression || !currentWindow) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-zinc-950 to-zinc-900 text-zinc-100 flex items-center justify-center">
        <div className="text-center">
          <div className="text-2xl font-bold mb-4">Loading Chord Data...</div>
          <button
            onClick={onBack}
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm font-medium transition-colors"
          >
            Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-950 to-zinc-900 text-zinc-100">
      {/* Header */}
      <div className="p-6 border-b border-zinc-800/50 backdrop-blur-sm">
        <div className="flex items-center justify-between max-w-6xl mx-auto">
          <div>
            <h1 className="text-2xl font-bold text-zinc-100">Moving Window Chord Visualizer</h1>
            <p className="text-sm text-zinc-400">
              {audioFile?.name} • {progression.nodes.length} chords • {finalBpm} BPM • Beat {Math.floor(playbackState.currentBeat)}
            </p>
          </div>
          <button
            onClick={onBack}
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm font-medium transition-colors"
          >
            Back
          </button>
        </div>
      </div>

      {/* Audio Element */}
      {audioUrl && (
        <audio
          ref={audioRef}
          src={audioUrl}
          onLoadedMetadata={(e) => setDuration(e.target.duration)}
        />
      )}

      {/* Main Content */}
      <div className="p-6 max-w-6xl mx-auto space-y-8">
        {/* Moving Window Display */}
        <div className="bg-zinc-900/50 backdrop-blur-sm rounded-xl p-8 border border-zinc-700/50">
          <h2 className="text-lg font-semibold mb-6 text-zinc-200 text-center">Chord Progression Window</h2>
          
          <div className="flex items-center justify-center gap-6 mb-4">
            {/* Previous Chord */}
            {currentWindow.previous && (
              <ChordCard
                chord={currentWindow.previous}
                state="previous"
                onClick={handlePreviousChordClick}
                transitionKey={transitionKey}
              />
            )}
            
            {/* Current Chord (Active) */}
            <ChordCard
              chord={currentWindow.current}
              state="current"
              beatProgress={beatProgress}
              onClick={handleCurrentChordClick}
              transitionKey={transitionKey}
            />
            
            {/* Next Chord */}
            {currentWindow.next && (
              <ChordCard
                chord={currentWindow.next}
                state="next"
                onClick={handleNextChordClick}
                transitionKey={transitionKey}
              />
            )}
          </div>

          {/* Beat Counter and Measure Info */}
          <div className="text-center text-sm text-zinc-400 space-y-1">
            <div>Beat: {Math.floor(playbackState.currentBeat)} / {progression.totalBeats}</div>
            <div>Measure: {currentWindow.measureIndex + 1}</div>
            <div>Cumulative Beat: {currentWindow.cumulativeBeat}</div>
          </div>
        </div>

        {/* Audio Player Controls */}
        {audioUrl && (
          <div className="bg-zinc-900/80 backdrop-blur-sm rounded-xl p-4 border border-zinc-700/50">
            {/* Main Controls */}
            <div className="flex items-center gap-4 mb-4">
              <button
                onClick={handlePlayPause}
                className="w-14 h-14 bg-red-500 hover:bg-red-400 rounded-full flex items-center justify-center text-white transition-all duration-200 shadow-lg shadow-red-500/25"
              >
                {isPlaying ? (
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>
                  </svg>
                ) : (
                  <svg className="w-5 h-5 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z"/>
                  </svg>
                )}
              </button>
              
              <button
                onClick={handleStop}
                className="w-10 h-10 bg-zinc-700 hover:bg-zinc-600 rounded-lg flex items-center justify-center text-zinc-300 transition-colors"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M6 6h12v12H6z"/>
                </svg>
              </button>

              <div className="flex-1 flex items-center gap-3">
                {/* Progress Bar */}
                <div className="flex-1 h-2 bg-zinc-700 rounded-full overflow-hidden cursor-pointer group">
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
          </div>
        )}

        {/* Chord Timeline Overview */}
        <div className="bg-zinc-900/50 backdrop-blur-sm rounded-xl border border-zinc-700/50 overflow-hidden">
          <div className="p-4 border-b border-zinc-700/50">
            <h3 className="font-semibold text-zinc-200">Complete Progression</h3>
          </div>
          <div className="max-h-64 overflow-y-auto">
            <div className="grid grid-cols-6 gap-2 p-4">
              {progression.nodes.map((chord, index) => (
                <button
                  key={chord.id}
                  onClick={() => jumpToChord(index)}
                  className={`
                    p-2 rounded-lg text-sm font-medium transition-all duration-200
                    ${index === playbackState.activeChordIndex 
                      ? 'bg-red-500/30 border border-red-500/50 text-red-200' 
                      : 'bg-zinc-800/50 hover:bg-zinc-700/50 text-zinc-300 hover:text-zinc-200'
                    }
                  `}
                >
                  <div className="font-bold">{chord.chordName}</div>
                  <div className="text-xs opacity-70">{chord.durationBeats}b</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MovingWindowChordVisualizer;