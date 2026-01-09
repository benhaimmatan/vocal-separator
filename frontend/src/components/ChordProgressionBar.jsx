import React, { useState, useEffect, useRef } from 'react';
import PianoChordDiagram from './PianoChordDiagram';

// Function to format chord names for display
const formatChordForDisplay = (chordName) => {
  if (!chordName || chordName === 'N/C' || chordName === '—' || chordName === 'N') {
    return chordName;
  }

  let formatted = chordName;

  // Handle colon notation (e.g., "C:min" -> "Cm", "E:hdim7" -> "Eø7")
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
      case 'dim7':
        formatted = `${root}°7`;
        break;
      case 'hdim7':
      case 'm7b5':
        formatted = `${root}ø7`; // Half-diminished symbol
        break;
      case 'aug':
        formatted = `${root}+`;
        break;
      case '7':
        formatted = `${root}7`;
        break;
      case 'maj7':
        formatted = `${root}M7`;
        break;
      case 'min7':
        formatted = `${root}m7`;
        break;
      case 'minmaj7':
      case 'mM7':
        formatted = `${root}mM7`;
        break;
      case 'sus2':
        formatted = `${root}sus2`;
        break;
      case 'sus4':
      case 'sus':
        formatted = `${root}sus4`;
        break;
      default:
        formatted = `${root}${quality}`;
    }
  }

  // Additional formatting for better readability
  // Convert hdim7 to half-diminished symbol
  formatted = formatted.replace(/hdim7/g, 'ø7');
  // Convert dim7 to diminished symbol
  formatted = formatted.replace(/dim7/g, '°7');
  // Convert dim to diminished symbol (but not dim7)
  formatted = formatted.replace(/dim(?!7)/g, '°');
  // Convert aug to + symbol
  formatted = formatted.replace(/aug/g, '+');
  // Convert maj7 to M7 (cleaner notation)
  formatted = formatted.replace(/maj7/g, 'M7');
  // Convert minmaj7 to mM7
  formatted = formatted.replace(/minmaj7/g, 'mM7');

  // Convert A# to Bb (more common in music notation)
  formatted = formatted.replace(/A#/g, 'Bb');

  return formatted;
};

const ChordProgressionBar = ({
  detectedChords = [],
  detectedBeats = [],
  currentTime = 0,
  duration = 0,
  isPlaying = false,
  bpm = 120,
  simplicityPreference = 0.5,
  setSimplicityPreference,
  setBpm,
  onAnalyze,
  isAnalyzing = false,
  selectedFile = null
}) => {
  const [chordProgression, setChordProgression] = useState([]);
  const [currentChordIndex, setCurrentChordIndex] = useState(-1);
  const scrollContainerRef = useRef(null);

  const estimatedBPM = Math.round(bpm);
  const beatsPerSecond = bpm / 60; // Use original BPM for calculations

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
      console.log("✅ Using enhanced rhythm analysis from backend");
      const enhancedProgression = detectedChords.map((chord, index) => ({
        chord: chord.chord,
        startTime: chord.startTime || chord.time,
        endTime: chord.endTime || (detectedChords[index + 1]?.time || duration),
        duration: chord.duration || (chord.endTime - chord.startTime) || 4,
        beats: chord.beats || 1,
        measures: chord.measures || 0,
        beat_position: chord.beat_position || 1,
        time_signature: chord.time_signature || '4/4',
        tempo_bpm: chord.tempo_bpm || bpm,
        chord_type: chord.chord_type || 'standard',
        rhythmic_strength: chord.rhythmic_strength || 0.5,
        confidence: chord.confidence || 0.8,
        index
      }));
      
      setChordProgression(enhancedProgression);
      return;
    }

    // Fallback to legacy consolidation and calculation
    console.log("⚠️ Using legacy rhythm analysis - enhanced backend not available");
    
    // First, consolidate consecutive identical chords to avoid micro-segments
    const consolidatedChords = [];
    let currentConsolidated = null;
    
    for (const chord of detectedChords) {
      const chordTime = chord.time || chord.startTime || 0;
      const nextChord = detectedChords[detectedChords.indexOf(chord) + 1];
      const chordEndTime = nextChord ? (nextChord.time || nextChord.startTime) : duration;
      
      const chordWithTiming = {
        ...chord,
        startTime: chordTime,
        endTime: chordEndTime,
        chord: chord.chord || 'N'
      };
      
      if (currentConsolidated && currentConsolidated.chord === chordWithTiming.chord) {
        // Extend the current chord if it's the same
        currentConsolidated.endTime = chordWithTiming.endTime;
      } else {
        // Start a new chord
        if (currentConsolidated) {
          consolidatedChords.push(currentConsolidated);
        }
        currentConsolidated = { ...chordWithTiming };
      }
    }
    if (currentConsolidated) {
      consolidatedChords.push(currentConsolidated);
    }

    // Process consolidated chords
    const processedChords = consolidatedChords.map((chord, index) => {
      const chordDuration = chord.endTime - chord.startTime;
      
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
        confidence: chord.confidence || 0.8,
        index
      };
    });

    setChordProgression(processedChords);
  }, [detectedChords, bpm, detectedBeats, duration]);

  useEffect(() => {
    const activeIndex = chordProgression.findIndex(chord => 
      currentTime >= chord.startTime && currentTime < chord.endTime
    );
    setCurrentChordIndex(activeIndex);
    
    // Auto-scroll to current chord
    if (activeIndex >= 0 && scrollContainerRef.current) {
      const cardWidth = 140; // Card width + margin
      const scrollPosition = activeIndex * cardWidth - scrollContainerRef.current.offsetWidth / 2;
      scrollContainerRef.current.scrollTo({
        left: Math.max(0, scrollPosition),
        behavior: 'smooth'
      });
    }
  }, [chordProgression, currentTime]);

  // Calculate current beat and progress for active chord
  const getCurrentBeatInfo = (chord) => {
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

  console.log('[ChordProgressionBar] Current chord index:', currentChordIndex);
  console.log('[ChordProgressionBar] Current chord name:', JSON.stringify(currentChordName));
  console.log('[ChordProgressionBar] Passing to PianoChordDiagram:', JSON.stringify(currentChordName));

  // Get display chords for sequence (3 before, current, 3 after = 7 total)
  const displayChords = [];
  const startIndex = Math.max(0, currentChordIndex - 3);
  const endIndex = Math.min(chordProgression.length, startIndex + 7); // Show exactly 7 chords

  for (let i = startIndex; i < endIndex; i++) {
    displayChords.push(chordProgression[i]);
  }

  return (
    <div className="chord-progression-bar h-full">
      {chordProgression.length > 0 ? (
        <div className="flex flex-col h-full">
          {/* Centered Chord Timeline - Prominent Display */}
          <div className="flex-1 flex flex-col items-center justify-center py-8 px-6">
            {/* BPM Display - Centered Above */}
            <div className="flex items-center gap-3 mb-6">
              <div className="flex items-center gap-2 bg-zinc-800/60 px-5 py-2.5 rounded-xl border border-zinc-700/50 shadow-lg">
                <span className="text-2xl font-bold text-zinc-100">{estimatedBPM}</span>
                <span className="text-sm text-zinc-400 font-medium">BPM</span>
              </div>
            </div>

            {/* Chord Cards - Centered and Prominent */}
            <div
              ref={scrollContainerRef}
              className="flex items-center justify-center gap-6 overflow-x-auto px-8 py-4"
              style={{ scrollbarWidth: 'thin', maxWidth: '100%' }}
            >
              {displayChords.map((chordInfo, index) => {
                const actualIndex = startIndex + index;
                const isPrevious = actualIndex < currentChordIndex;
                const isCurrent = actualIndex === currentChordIndex;
                const isNext = actualIndex > currentChordIndex;

                // Enhanced styling with more prominence
                let cardClasses = "flex-shrink-0 rounded-2xl border-2 text-center transition-all duration-300 cursor-pointer";

                if (isCurrent) {
                  cardClasses += " bg-gradient-to-br from-blue-500 to-blue-600 text-white border-blue-400 transform scale-125 shadow-2xl shadow-blue-500/50 z-10 px-8 py-6 min-w-32";
                } else if (isPrevious) {
                  cardClasses += " bg-zinc-800/40 text-zinc-500 border-zinc-700/50 opacity-50 transform scale-90 px-5 py-4 min-w-24";
                } else if (isNext) {
                  cardClasses += " bg-blue-500/10 text-blue-300 border-blue-500/40 hover:bg-blue-500/20 transform scale-100 px-5 py-4 min-w-24";
                } else {
                  cardClasses += " bg-zinc-800/50 text-zinc-300 border-zinc-700/50 hover:bg-zinc-700/50 px-5 py-4 min-w-24";
                }

                return (
                  <div key={actualIndex} className={cardClasses}>
                    {/* Chord Name - Larger for current */}
                    <div className={`font-bold font-mono mb-2 ${isCurrent ? 'text-3xl' : 'text-xl'}`}>
                      {formatChordForDisplay(chordInfo.chord)}
                    </div>

                    {/* Beat Info */}
                    {isCurrent ? (
                      <div className="text-sm opacity-90">
                        <div className="mb-2 font-semibold">
                          {getCurrentBeatInfo(chordInfo).currentBeat}/{chordInfo.beats}
                        </div>
                        <div className="w-full h-1.5 bg-white/20 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-white/90 rounded-full transition-all duration-100"
                            style={{ width: `${getCurrentBeatInfo(chordInfo).beatProgress * 100}%` }}
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="text-sm opacity-70 font-medium">
                        {chordInfo.beats}b
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Subtle Label Below */}
            <div className="mt-6 text-xs text-zinc-500 font-medium tracking-wider uppercase">
              Chord Timeline
            </div>
          </div>
        </div>
      ) : (
        <div className="p-8 text-center h-full flex flex-col items-center justify-center">
          <div className="text-zinc-600 mb-2 text-4xl">♪</div>
          <p className="text-sm text-zinc-500">
            Chord progression will appear here
          </p>
        </div>
      )}
    </div>
  );
};

export default ChordProgressionBar;