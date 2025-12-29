import React, { useState, useEffect } from 'react';
import './ChordProgressionBar.css';
import PianoChordDiagram from './PianoChordDiagram';

// Add logger for debugging
const logger = {
  info: (message: string) => console.log(message),
  warn: (message: string) => console.warn(message),
  error: (message: string) => console.error(message)
};

interface ChordSection {
  chord: string;
  startTime: number;
  endTime: number;
  // Enhanced properties from backend
  duration?: number;
  beats?: number;
  measures?: number;
  beat_position?: number;
  time_signature?: string;
  tempo_bpm?: number;
  chord_type?: string;
  rhythmic_strength?: number;
}

interface ChordWithBeats {
  chord: string;
  startTime: number;
  endTime: number;
  duration: number;
  beats: number;
  measures?: number;
  beat_position?: number;
  time_signature?: string;
  tempo_bpm?: number;
  chord_type?: string;
  rhythmic_strength?: number;
  index: number;
  // Legacy properties for compatibility
  isActive?: boolean;
  beatProgress?: number;
  currentBeat?: number;
}

interface ChordProgressionBarProps {
  detectedChords: ChordSection[];
  detectedBeats: number[];
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  bpm: number;
  simplicityPreference: number;
  setSimplicityPreference: (value: number) => void;
  setBpm: (value: number) => void;
  onAnalyze: () => void;
  isAnalyzing: boolean;
  isCheckingChords: boolean;
  selectedFile: any;
}

// Function to format chord names for display
const formatChordForDisplay = (chordName: string): string => {
  if (!chordName || chordName === 'N/C' || chordName === '—') {
    return chordName;
  }
  
  let formatted = chordName;
  
  // Handle colon notation (e.g., "C:min" -> "Cm", "F:7" -> "F7")
  if (formatted.includes(':')) {
    const [root, quality] = formatted.split(':');
    switch (quality) {
      case 'min':
        formatted = `${root}m`;
        break;
      case 'maj':
        formatted = root; // Major chords don't need suffix
        break;
      case 'dim':
        formatted = `${root}dim`;
        break;
      case 'aug':
        formatted = `${root}aug`;
        break;
      case '7':
        formatted = `${root}7`;
        break;
      case 'maj7':
        formatted = `${root}maj7`;
        break;
      case 'min7':
        formatted = `${root}m7`;
        break;
      default:
        formatted = `${root}${quality}`;
    }
  }
  
  // Convert A# to Bb (more common in music notation)
  formatted = formatted.replace(/A#/g, 'Bb');
  
  return formatted;
};

const ChordProgressionBar: React.FC<ChordProgressionBarProps> = ({
  detectedChords,
  detectedBeats,
  currentTime,
  duration,
  isPlaying,
  bpm = 120,
  simplicityPreference,
  setSimplicityPreference,
  setBpm,
  onAnalyze,
  isAnalyzing,
  isCheckingChords,
  selectedFile
}) => {
  const [chordProgression, setChordProgression] = useState<ChordWithBeats[]>([]);
  const [currentChordIndex, setCurrentChordIndex] = useState<number>(-1);

  const estimatedBPM = bpm;
  const beatsPerSecond = estimatedBPM / 60;


  // Enhanced rhythm analysis using backend data
  useEffect(() => {
    if (!detectedChords.length) {
      setChordProgression([]);
      return;
    }

    // Check if we have enhanced chord data from the new backend
    const hasEnhancedData = detectedChords.some(chord => 
      chord.hasOwnProperty('beats') && chord.hasOwnProperty('time_signature')
    );

    if (hasEnhancedData) {
      // Use enhanced data directly from backend
      logger.info("✅ Using enhanced rhythm analysis from backend");
      const enhancedProgression = detectedChords.map((chord, index) => ({
        chord: chord.chord,
        startTime: chord.startTime,
        endTime: chord.endTime,
        duration: chord.duration || (chord.endTime - chord.startTime),
        beats: chord.beats || 1,
        measures: chord.measures || 0,
        beat_position: chord.beat_position || 1,
        time_signature: chord.time_signature || '4/4',
        tempo_bpm: chord.tempo_bpm || bpm,
        chord_type: chord.chord_type || 'standard',
        rhythmic_strength: chord.rhythmic_strength || 0.5,
        index
      }));
      
      setChordProgression(enhancedProgression);
      return;
    }

    // Fallback to legacy consolidation and calculation
    logger.info("⚠️ Using legacy rhythm analysis - enhanced backend not available");
    
    // First, consolidate consecutive identical chords to avoid micro-segments
    const consolidatedChords = [];
    let currentConsolidated = null;
    
    for (const chord of detectedChords) {
      if (currentConsolidated && currentConsolidated.chord === chord.chord) {
        // Extend the current chord if it's the same
        currentConsolidated.endTime = chord.endTime;
      } else {
        // Start a new chord
        if (currentConsolidated) {
          consolidatedChords.push(currentConsolidated);
        }
        currentConsolidated = { ...chord };
      }
    }
    if (currentConsolidated) {
      consolidatedChords.push(currentConsolidated);
    }

    // Process consolidated chords
    const processedChords = consolidatedChords.map((chord, index) => {
      const chordDuration = chord.endTime - chord.startTime;
      
      // Debug logging for ALL chords to see what's happening
      console.log(`🎵 Legacy Chord Analysis: ${chord.chord}`, {
        startTime: chord.startTime.toFixed(2),
        endTime: chord.endTime.toFixed(2),
        duration: chordDuration.toFixed(2),
        bpm: bpm,
        beatInterval: (60/bpm).toFixed(2)
      });
      
      // Enhanced beat counting with better fallback logic
      let actualBeats;
      
      // Fallback: estimate based on BPM and duration
      const beatInterval = 60.0 / bpm;
      const estimatedBeats = chordDuration / beatInterval;
      actualBeats = Math.max(1, Math.round(estimatedBeats));
      
      // Special handling for ballads (BPM < 80)
      if (bpm < 80) {
        // Ensure minimum 2 beats for ballad chords unless very short
        if (chordDuration > 1.0) {
          actualBeats = Math.max(2, actualBeats);
        }
      }
      
      console.log(`✅ Using ${actualBeats} estimated beats for ${chord.chord} (${chordDuration.toFixed(2)}s @ ${bpm} BPM)`);

      return {
        chord: chord.chord,
        startTime: chord.startTime,
        endTime: chord.endTime,
        duration: chordDuration,
        beats: actualBeats,
        measures: Math.ceil(actualBeats / 4), // Assume 4/4 time
        beat_position: ((index % 4) + 1), // Simple position estimate
        time_signature: '4/4',
        tempo_bpm: bpm,
        chord_type: actualBeats > 4 ? 'sustained' : actualBeats === 1 ? 'accent' : 'standard',
        rhythmic_strength: 0.5, // Default strength
        index
      };
    });

    setChordProgression(processedChords);
  }, [detectedChords, bpm, detectedBeats]);

  useEffect(() => {
    const activeIndex = chordProgression.findIndex(chord => 
      currentTime >= chord.startTime && currentTime < chord.endTime
    );
    setCurrentChordIndex(activeIndex);
  }, [chordProgression, currentTime]);

  // Calculate current beat and progress for active chord
  const getCurrentBeatInfo = (chord: ChordWithBeats) => {
    if (currentTime < chord.startTime || currentTime >= chord.endTime) {
      return { currentBeat: 1, beatProgress: 0 };
    }

    const timeInChord = currentTime - chord.startTime;
    const beatDuration = chord.duration / chord.beats;
    const rawCurrentBeat = timeInChord / beatDuration;
    const currentBeat = Math.max(1, Math.min(chord.beats, Math.floor(rawCurrentBeat) + 1));
    const timeInCurrentBeat = timeInChord % beatDuration;
    const beatProgress = Math.min(1, Math.max(0, timeInCurrentBeat / beatDuration));

    return { currentBeat, beatProgress };
  };

  const currentChord = currentChordIndex >= 0 ? chordProgression[currentChordIndex] : null;
  const currentBeatInfo = currentChord ? getCurrentBeatInfo(currentChord) : { currentBeat: 1, beatProgress: 0 };
  const currentChordName = currentChord ? currentChord.chord : '';

  // DEBUG: Log what's being rendered
  useEffect(() => {
    console.log('🟦 ChordProgressionBar RENDERING:', {
      chordsCount: chordProgression.length,
      currentChordIndex,
      currentChordName,
      displayChordsCount: displayChords.length,
      timestamp: new Date().toISOString()
    });
  }, [chordProgression.length, currentChordIndex, currentChordName]);

  // Get display chords for sequence
  const displayChords = [];
  const startIndex = Math.max(0, currentChordIndex - 1);
  const endIndex = Math.min(chordProgression.length, startIndex + 4);
  
  for (let i = startIndex; i < endIndex; i++) {
    displayChords.push(chordProgression[i]);
  }

  return (
    <div className="chord-progression-bar">
      {/* Main container */}
      <div className="chord-progression-container">
        

        {/* Center Column - Clean Rebuilt Chord Progression */}
        <div className="chord-progression-section">
          {chordProgression.length > 0 ? (
            <div style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              gap: '20px',
              padding: '20px' 
            }}>
              {/* Simple Header */}
              <div style={{
                textAlign: 'center',
                borderBottom: '2px solid #e5e7eb',
                paddingBottom: '15px'
              }}>
                <h3 style={{ 
                  margin: '0 0 10px 0', 
                  fontSize: '1.5rem', 
                  color: '#1f2937',
                  fontWeight: '600' 
                }}>
                  Chord Progression
                </h3>
                <div style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: '#f3f4f6',
                  padding: '8px 16px',
                  borderRadius: '20px',
                  fontSize: '14px',
                  fontWeight: '500',
                  color: '#6b7280'
                }}>
                  <span style={{ fontSize: '18px', fontWeight: '600', color: '#1f2937' }}>
                    {estimatedBPM}
                  </span>
                  <span>BPM</span>
                </div>
              </div>

              {/* Clean Chord Display */}
              <div style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                gap: '20px',
                flexWrap: 'nowrap',
                minHeight: '140px',
                overflow: 'hidden'
              }}>
                {displayChords.map((chordInfo, index) => {
                  const actualIndex = startIndex + index;
                  const isPrevious = actualIndex < currentChordIndex;
                  const isCurrent = actualIndex === currentChordIndex;
                  const isNext = actualIndex > currentChordIndex;
                  
                  // Clean styling based on state
                  let cardStyle: React.CSSProperties = {
                    padding: '20px 24px',
                    borderRadius: '16px',
                    border: '2px solid transparent',
                    background: '#ffffff',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                    minWidth: '100px',
                    maxWidth: '150px',
                    textAlign: 'center',
                    transition: 'all 0.3s ease',
                    position: 'relative',
                    flexShrink: 0
                  };

                  if (isCurrent) {
                    cardStyle = {
                      ...cardStyle,
                      background: 'linear-gradient(135deg, #3b82f6, #1e40af)',
                      color: 'white',
                      border: '2px solid #2563eb',
                      transform: 'scale(1.15)',
                      boxShadow: '0 8px 25px rgba(59, 130, 246, 0.4)',
                      zIndex: 10,
                      minWidth: '120px',
                      padding: '24px 28px'
                    };
                  } else if (isPrevious) {
                    cardStyle = {
                      ...cardStyle,
                      background: '#f9fafb',
                      color: '#6b7280',
                      border: '2px solid #e5e7eb',
                      opacity: 0.7,
                      transform: 'scale(0.95)'
                    };
                  } else if (isNext) {
                    cardStyle = {
                      ...cardStyle,
                      background: '#f0f9ff',
                      color: '#0369a1',
                      border: '2px solid #bae6fd'
                    };
                  }

                  return (
                    <div 
                      key={actualIndex} 
                      style={cardStyle}
                    >
                      {/* Chord Name with proper formatting */}
                      <div style={{
                        fontSize: isCurrent ? '1.8rem' : '1.3rem',
                        fontWeight: '600',
                        marginBottom: isCurrent ? '10px' : '6px',
                        fontFamily: '"SF Mono", "Monaco", monospace'
                      }}>
                        {formatChordForDisplay(chordInfo.chord)}
                      </div>

                      {/* Beat Info */}
                      {isCurrent ? (
                        <div style={{ fontSize: '12px', opacity: 0.9 }}>
                          <div style={{ marginBottom: '4px' }}>
                            Beat {getCurrentBeatInfo(chordInfo).currentBeat} of {chordInfo.beats}
                          </div>
                          <div style={{
                            width: '100%',
                            height: '4px',
                            background: 'rgba(255,255,255,0.3)',
                            borderRadius: '2px',
                            overflow: 'hidden'
                          }}>
                            <div style={{
                              width: `${getCurrentBeatInfo(chordInfo).beatProgress * 100}%`,
                              height: '100%',
                              background: 'rgba(255,255,255,0.9)',
                              transition: 'width 0.1s ease'
                            }} />
                          </div>
                        </div>
                      ) : (
                        <div style={{ 
                          fontSize: '11px', 
                          opacity: 0.8,
                          fontWeight: '500'
                        }}>
                          {chordInfo.beats} beats
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div style={{ 
              padding: '60px 20px', 
              textAlign: 'center' 
            }}>
              <h3 style={{ 
                margin: '0 0 10px 0', 
                fontSize: '1.5rem', 
                color: '#1f2937' 
              }}>
                Ready to Analyze
              </h3>
              <p style={{ 
                color: '#6b7280', 
                fontSize: '0.875rem', 
                margin: 0 
              }}>
                Click "Analyze Chords" to detect chord progressions and view beat visualization
              </p>
            </div>
          )}
        </div>

        {/* Right Column - Current Chord with Piano */}
        <div className="current-chord-section">
          <h4>Now Playing</h4>
          {/* Current Chord Display */}
          <div className="current-chord-display">
            {currentChordName && currentChordName !== 'N/C' && currentChordName !== '—' ? (
              <div className="piano-container">
                <PianoChordDiagram chordName={currentChordName} />
              </div>
            ) : (
              <div className="no-chord-display">
                <div className="no-chord-text">—</div>
                <div className="no-chord-subtitle">No chord detected</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChordProgressionBar; 