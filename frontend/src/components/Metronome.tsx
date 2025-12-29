import React, { useState, useEffect, useRef, useCallback } from 'react';
import './Metronome.css';

interface MetronomeProps {
  bpm: number;
  isPlaying: boolean;
  currentTime: number;
  detectedBeats: number[];
  detectedChords: Array<{
    startTime: number;
    endTime: number;
    chord: string;
  }>;
  isEnabled: boolean;
  onToggle: (enabled: boolean) => void;
  onBpmChange?: (newBpm: number) => void;
}

const Metronome: React.FC<MetronomeProps> = ({
  bpm,
  isPlaying,
  currentTime,
  detectedBeats,
  detectedChords,
  isEnabled,
  onToggle,
  onBpmChange
}) => {
  const [currentBeat, setCurrentBeat] = useState(0);
  const [currentChord, setCurrentChord] = useState('');
  const [nextChordTime, setNextChordTime] = useState<number | null>(null);
  const [isOnBeat, setIsOnBeat] = useState(false);
  const [useDetectedBeats, setUseDetectedBeats] = useState(true);
  const [manualBpm, setManualBpm] = useState(bpm);
  const [showBpmAdjust, setShowBpmAdjust] = useState(false);
  const [originalBpm, setOriginalBpm] = useState(bpm);
  const [soundEnabled, setSoundEnabled] = useState(true);
  
  const animationFrameRef = useRef<number | undefined>(undefined);
  const lastBeatTimeRef = useRef<number>(0);
  const audioContextRef = useRef<AudioContext | undefined>(undefined);
  const isPlaying15Ref = useRef(false);

  // Update manual BPM when prop changes
  useEffect(() => {
    if (!showBpmAdjust) {
      setManualBpm(bpm);
      setOriginalBpm(bpm);
    }
  }, [bpm, showBpmAdjust]);

  // Initialize audio context for click sounds
  useEffect(() => {
    if (isEnabled && !audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return () => {
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
      }
    };
  }, [isEnabled]);

  const playClick = useCallback((isDownbeat: boolean = false) => {
    if (!audioContextRef.current || !soundEnabled) return;
    
    const oscillator = audioContextRef.current.createOscillator();
    const gainNode = audioContextRef.current.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContextRef.current.destination);
    
    // Different frequencies for downbeat vs regular beat
    oscillator.frequency.setValueAtTime(
      isDownbeat ? 800 : 400, 
      audioContextRef.current.currentTime
    );
    oscillator.type = 'sine';
    
    // Much louder click sound - increased from 0.1/0.01 to 0.5/0.05
    gainNode.gain.setValueAtTime(0.5, audioContextRef.current.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.05, audioContextRef.current.currentTime + 0.1);
    
    oscillator.start(audioContextRef.current.currentTime);
    oscillator.stop(audioContextRef.current.currentTime + 0.1);
  }, [soundEnabled]);

  const getBeatInterval = useCallback(() => {
    const activeBpm = showBpmAdjust ? manualBpm : bpm;
    return 60.0 / activeBpm;
  }, [bpm, manualBpm, showBpmAdjust]);

  // Find current chord
  useEffect(() => {
    if (detectedChords.length === 0) {
      setCurrentChord('');
      setNextChordTime(null);
      return;
    }

    const activeChord = detectedChords.find(chord => 
      currentTime >= chord.startTime && currentTime < chord.endTime
    );

    if (activeChord) {
      setCurrentChord(activeChord.chord);
      
      // Find next chord
      const nextChord = detectedChords.find(chord => chord.startTime > currentTime);
      setNextChordTime(nextChord ? nextChord.startTime : null);
    } else {
      setCurrentChord('');
      setNextChordTime(null);
    }
  }, [currentTime, detectedChords]);

  // Beat detection and metronome logic
  useEffect(() => {
    if (!isEnabled || !isPlaying) {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      return;
    }

    const updateBeat = () => {
      if (useDetectedBeats && detectedBeats.length > 0) {
        // Use detected beats for accuracy
        const tolerance = 0.1; // 100ms tolerance
        const nearestBeat = detectedBeats.find(beatTime => 
          Math.abs(beatTime - currentTime) < tolerance
        );
        
        if (nearestBeat && nearestBeat !== lastBeatTimeRef.current) {
          const beatIndex = detectedBeats.indexOf(nearestBeat);
          setCurrentBeat(beatIndex % 4 + 1); // 1-4 beat pattern
          setIsOnBeat(true);
          lastBeatTimeRef.current = nearestBeat;
          
          // Play click sound
          playClick(beatIndex % 4 === 0);
          
          // Reset beat indicator after short delay
          setTimeout(() => setIsOnBeat(false), 150);
        }
      } else {
        // Use calculated BPM timing
        const beatInterval = getBeatInterval();
        const currentBeatFloat = currentTime / beatInterval;
        const beatNumber = Math.floor(currentBeatFloat) % 4 + 1;
        
        if (beatNumber !== currentBeat) {
          setCurrentBeat(beatNumber);
          setIsOnBeat(true);
          playClick(beatNumber === 1);
          setTimeout(() => setIsOnBeat(false), 150);
        }
      }

      if (isPlaying) {
        animationFrameRef.current = requestAnimationFrame(updateBeat);
      }
    };

    animationFrameRef.current = requestAnimationFrame(updateBeat);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isEnabled, isPlaying, currentTime, detectedBeats, useDetectedBeats, bpm, manualBpm, showBpmAdjust, currentBeat, getBeatInterval, playClick]);

  // Time until next chord change
  const getTimeToNextChord = () => {
    if (!nextChordTime) return null;
    const timeLeft = nextChordTime - currentTime;
    return timeLeft > 0 ? timeLeft : null;
  };

  const timeToNextChord = getTimeToNextChord();

  const handleBpmChange = (newBpm: number) => {
    setManualBpm(newBpm);
    if (onBpmChange) {
      onBpmChange(newBpm);
    }
  };

  const resetToOriginal = () => {
    setManualBpm(originalBpm);
    if (onBpmChange) {
      onBpmChange(originalBpm);
    }
  };

  const applyCommonCorrections = (factor: number) => {
    const correctedBpm = Math.round(originalBpm * factor);
    setManualBpm(correctedBpm);
    if (onBpmChange) {
      onBpmChange(correctedBpm);
    }
  };

  return (
    <div className="metronome-container">
      {/* Clean Header with Controls */}
      <div className="metronome-header">
        <h4>🎵 Metronome</h4>
        
        {/* Enhanced On/Off Toggle - Better Visibility */}
        <label className="metronome-toggle">
          <input
            type="checkbox"
            checked={isEnabled}
            onChange={(e) => onToggle(e.target.checked)}
          />
          <span className="toggle-slider"></span>
          <span className="toggle-label">{isEnabled ? 'ON' : 'OFF'}</span>
        </label>
      </div>

      {isEnabled && (
        <>
          {/* Compact BPM Controls - All Visible, No Popups */}
          <div className="bpm-controls-section">
            {/* Current BPM Display */}
            <div className="bpm-display-compact">
              <div className="bpm-number-compact">
                {showBpmAdjust ? manualBpm : bpm}
                <span className="bpm-label">BPM</span>
              </div>
              {showBpmAdjust && manualBpm !== originalBpm && (
                <div className="bpm-status">Adjusted from {originalBpm}</div>
              )}
            </div>

            {/* BPM Adjustment Controls - Always Visible When Enabled */}
            <div className="bpm-adjustment-inline">
              <div className="bpm-controls-row">
                <label className="bpm-control-label">Adjust:</label>
                
                {/* Manual BPM Input */}
                <input
                  type="number"
                  min="30"
                  max="200"
                  value={showBpmAdjust ? manualBpm : bpm}
                  onChange={(e) => {
                    setShowBpmAdjust(true);
                    handleBpmChange(parseInt(e.target.value) || manualBpm);
                  }}
                  className="bpm-input-compact"
                  placeholder="BPM"
                />
                
                {/* Quick Correction Buttons */}
                <div className="correction-buttons-inline">
                  <button 
                    onClick={() => {
                      setShowBpmAdjust(true);
                      applyCommonCorrections(0.5);
                    }}
                    className="correction-button-compact"
                    title="Half tempo (ballads)"
                  >
                    ÷2
                  </button>
                  <button 
                    onClick={() => {
                      setShowBpmAdjust(true);
                      applyCommonCorrections(2.0);
                    }}
                    className="correction-button-compact"
                    title="Double tempo"
                  >
                    ×2
                  </button>
                  <button 
                    onClick={() => {
                      setShowBpmAdjust(false);
                      resetToOriginal();
                    }}
                    className="correction-button-compact reset"
                    title="Reset to detected BPM"
                  >
                    Reset
                  </button>
                </div>
              </div>
              
              {/* Original BPM Reference - Contained in Box */}
              <div className="original-bpm-display">
                <span className="original-bpm-label">Original BPM:</span>
                <span className="original-bpm-value">{originalBpm}</span>
              </div>
            </div>
          </div>

          {/* Sound Options - Always Visible */}
          <div className="sound-options-section">
            {/* Sound On/Off Toggle */}
            <div className="sound-control-row">
              <label className="sound-toggle">
                <input
                  type="checkbox"
                  checked={soundEnabled}
                  onChange={(e) => setSoundEnabled(e.target.checked)}
                />
                <span className="sound-toggle-slider"></span>
                <span className="sound-toggle-label">
                  🔊 Sound {soundEnabled ? 'ON' : 'OFF'}
                </span>
              </label>
            </div>

            {/* Beat Source Option */}
            <div className="beat-source-row">
              <label className="sound-option">
                <input
                  type="checkbox"
                  checked={useDetectedBeats}
                  onChange={(e) => setUseDetectedBeats(e.target.checked)}
                />
                <span className="sound-option-text">
                  Use detected beats ({detectedBeats.length} available)
                </span>
              </label>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Metronome; 