import React from 'react';

// Map chord names to their notes
const CHORDS = {
  // Major chords
  'C': ['C', 'E', 'G'],
  'C#': ['C#', 'F', 'G#'],
  'Db': ['C#', 'F', 'G#'],
  'D': ['D', 'F#', 'A'],
  'D#': ['D#', 'G', 'A#'],
  'Eb': ['D#', 'G', 'A#'],
  'E': ['E', 'G#', 'B'],
  'F': ['F', 'A', 'C'],
  'F#': ['F#', 'A#', 'C#'],
  'Gb': ['F#', 'A#', 'C#'],
  'G': ['G', 'B', 'D'],
  'G#': ['G#', 'C', 'D#'],
  'Ab': ['G#', 'C', 'D#'],
  'A': ['A', 'C#', 'E'],
  'A#': ['A#', 'D', 'F'],
  'Bb': ['A#', 'D', 'F'],
  'B': ['B', 'D#', 'F#'],
  
  // Minor chords
  'Cm': ['C', 'D#', 'G'],
  'C#m': ['C#', 'E', 'G#'],
  'Dbm': ['C#', 'E', 'G#'],
  'Dm': ['D', 'F', 'A'],
  'D#m': ['D#', 'F#', 'A#'],
  'Ebm': ['D#', 'F#', 'A#'],
  'Em': ['E', 'G', 'B'],
  'Fm': ['F', 'G#', 'C'],
  'F#m': ['F#', 'A', 'C#'],
  'Gbm': ['F#', 'A', 'C#'],
  'Gm': ['G', 'A#', 'D'],
  'G#m': ['G#', 'B', 'D#'],
  'Abm': ['G#', 'B', 'D#'],
  'Am': ['A', 'C', 'E'],
  'A#m': ['A#', 'C#', 'F'],
  'Bbm': ['A#', 'C#', 'F'],
  'Bm': ['B', 'D', 'F#'],
  
  // Minor 7th chords
  'Em7': ['E', 'G', 'B', 'D'],
  'Cm7': ['C', 'D#', 'G', 'A#'],
  'Dm7': ['D', 'F', 'A', 'C'],
  'Bm7': ['B', 'D', 'F#', 'A'],
  'D#m7': ['D#', 'F#', 'A#', 'C#'],
  'Ebm7': ['D#', 'F#', 'A#', 'C#'],
  'G#m7': ['G#', 'B', 'D#', 'F#'],
  'Abm7': ['G#', 'B', 'D#', 'F#'],
  'A#m7': ['A#', 'C#', 'F', 'G#'],
  'Bbm7': ['A#', 'C#', 'F', 'G#'],
  'C#m7': ['C#', 'E', 'G#', 'B'],
  'Dbm7': ['C#', 'E', 'G#', 'B'],
  'Fm7': ['F', 'G#', 'C', 'D#'],
  'F#m7': ['F#', 'A', 'C#', 'E'],
  'Gbm7': ['F#', 'A', 'C#', 'E'],
  'Gm7': ['G', 'A#', 'D', 'F'],
  'Am7': ['A', 'C', 'E', 'G'],
  
  // Dominant 7th chords
  'C7': ['C', 'E', 'G', 'A#'],
  'C#7': ['C#', 'F', 'G#', 'B'],
  'Db7': ['C#', 'F', 'G#', 'B'],
  'D7': ['D', 'F#', 'A', 'C'],
  'D#7': ['D#', 'G', 'A#', 'C#'],
  'Eb7': ['D#', 'G', 'A#', 'C#'],
  'E7': ['E', 'G#', 'B', 'D'],
  'F7': ['F', 'A', 'C', 'D#'],
  'F#7': ['F#', 'A#', 'C#', 'E'],
  'Gb7': ['F#', 'A#', 'C#', 'E'],
  'G7': ['G', 'B', 'D', 'F'],
  'G#7': ['G#', 'C', 'D#', 'F#'],
  'Ab7': ['G#', 'C', 'D#', 'F#'],
  'A7': ['A', 'C#', 'E', 'G'],
  'A#7': ['A#', 'D', 'F', 'G#'],
  'Bb7': ['A#', 'D', 'F', 'G#'],
  'B7': ['B', 'D#', 'F#', 'A'],
  
  // Major 7th chords
  'Cmaj7': ['C', 'E', 'G', 'B'],
  'C#maj7': ['C#', 'F', 'G#', 'C'],
  'Dbmaj7': ['C#', 'F', 'G#', 'C'],
  'Dmaj7': ['D', 'F#', 'A', 'C#'],
  'D#maj7': ['D#', 'G', 'A#', 'D'],
  'Ebmaj7': ['D#', 'G', 'A#', 'D'],
  'Emaj7': ['E', 'G#', 'B', 'D#'],
  'Fmaj7': ['F', 'A', 'C', 'E'],
  'F#maj7': ['F#', 'A#', 'C#', 'F'],
  'Gbmaj7': ['F#', 'A#', 'C#', 'F'],
  'Gmaj7': ['G', 'B', 'D', 'F#'],
  'G#maj7': ['G#', 'C', 'D#', 'G'],
  'Abmaj7': ['G#', 'C', 'D#', 'G'],
  'Amaj7': ['A', 'C#', 'E', 'G#'],
  'A#maj7': ['A#', 'D', 'F', 'A'],
  'Bbmaj7': ['A#', 'D', 'F', 'A'],
  'Bmaj7': ['B', 'D#', 'F#', 'A#'],
};

const WHITE_KEYS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const BLACK_KEYS = ['C#', 'D#', '', 'F#', 'G#', 'A#', ''];

// Function to normalize chord names from different detection systems
const normalizeChordName = (chordName) => {
  if (!chordName || chordName === 'N/C' || chordName === '—' || chordName === 'N') {
    return chordName;
  }
  
  // Handle colon notation (e.g., "C:min" -> "Cm", "D:min" -> "Dm")
  if (chordName.includes(':')) {
    const [root, quality] = chordName.split(':');
    switch (quality) {
      case 'min':
        return `${root}m`;
      case 'maj':
        return root; // Major chords don't need suffix
      case 'dim':
        return `${root}dim`;
      case 'aug':
        return `${root}aug`;
      case '7':
        return `${root}7`;
      case 'maj7':
        return `${root}maj7`;
      case 'min7':
        return `${root}m7`;
      default:
        return root; // Default to major
    }
  }
  
  // Return as-is if already in standard format
  return chordName;
};

// Function to format chord names for display
const formatChordForDisplay = (chordName) => {
  if (!chordName || chordName === 'N/C' || chordName === '—' || chordName === 'N') {
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

const PianoChordDiagram = ({ chordName }) => {
  // Normalize the chord name to handle different detection system formats
  const normalizedChordName = normalizeChordName(chordName);
  const notes = CHORDS[normalizedChordName] || [];
  
  // Format for display
  const displayChordName = formatChordForDisplay(chordName);
  const displayNotes = notes.map(note => note.replace(/A#/g, 'Bb'));

  // Render white keys
  const whiteKeys = WHITE_KEYS.map((key, idx) => {
    const isActive = notes.includes(key);
    return (
      <div
        key={key}
        className={`w-8 h-20 bg-white border border-zinc-400 flex items-end justify-center pb-2 text-xs font-medium transition-all duration-200 ${
          isActive 
            ? 'bg-blue-400 text-white shadow-lg' 
            : 'hover:bg-zinc-100 text-zinc-600'
        }`}
        style={{
          borderRadius: '0 0 4px 4px',
        }}
      >
        {/* Show note name only on active keys */}
        {isActive && <span>{key}</span>}
      </div>
    );
  });

  // Render black keys (skip empty slots)
  const blackKeys = BLACK_KEYS.map((key, idx) => {
    if (!key) return <div key={idx} className="w-6" />; // spacer
    
    const isActive = notes.includes(key);
    return (
      <div
        key={key}
        className={`w-6 h-12 flex items-end justify-center pb-1 text-xs font-medium transition-all duration-200 ${
          isActive 
            ? 'bg-blue-600 text-white shadow-lg' 
            : 'bg-zinc-800 hover:bg-zinc-700 text-white'
        }`}
        style={{
          borderRadius: '0 0 2px 2px',
          marginLeft: idx === 0 ? '1.25rem' : (idx === 2 ? '1.25rem' : '0.5rem'),
          marginRight: '0.5rem',
          position: 'relative',
          zIndex: 10,
        }}
      >
        {/* Show note name only on active keys */}
        {isActive && <span>{key.replace('#', '♯')}</span>}
      </div>
    );
  });

  return (
    <div className="piano-chord-diagram flex flex-col items-center bg-zinc-900/50 backdrop-blur-sm rounded-xl p-4 border border-zinc-700/50">
      <div className="piano-keys-container relative">
        {/* White keys */}
        <div className="piano-keys white-keys flex">
          {whiteKeys}
        </div>
        
        {/* Black keys - positioned absolute over white keys */}
        <div className="piano-keys black-keys absolute top-0 left-0 flex pointer-events-none">
          {blackKeys}
        </div>
      </div>
      
      {notes.length > 0 ? (
        <div className="chord-info mt-4 text-center">
          <div className="text-lg font-bold text-zinc-100 mb-1">{displayChordName}</div>
          <div className="text-sm text-zinc-400">{displayNotes.join(' • ')}</div>
        </div>
      ) : (
        <div className="chord-info mt-4 text-center">
          <div className="text-lg font-bold text-zinc-100 mb-1">{displayChordName}</div>
          <div className="text-sm text-zinc-500">Unknown chord</div>
        </div>
      )}
    </div>
  );
};

export default PianoChordDiagram;