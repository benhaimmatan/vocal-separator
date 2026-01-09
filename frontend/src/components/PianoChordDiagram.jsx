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

  // Diminished chords (dim = 1, b3, b5)
  'Cdim': ['C', 'D#', 'F#'],
  'C#dim': ['C#', 'E', 'G'],
  'Dbdim': ['C#', 'E', 'G'],
  'Ddim': ['D', 'F', 'G#'],
  'D#dim': ['D#', 'F#', 'A'],
  'Ebdim': ['D#', 'F#', 'A'],
  'Edim': ['E', 'G', 'A#'],
  'Fdim': ['F', 'G#', 'B'],
  'F#dim': ['F#', 'A', 'C'],
  'Gbdim': ['F#', 'A', 'C'],
  'Gdim': ['G', 'A#', 'C#'],
  'G#dim': ['G#', 'B', 'D'],
  'Abdim': ['G#', 'B', 'D'],
  'Adim': ['A', 'C', 'D#'],
  'A#dim': ['A#', 'C#', 'E'],
  'Bbdim': ['A#', 'C#', 'E'],
  'Bdim': ['B', 'D', 'F'],

  // Diminished 7th chords (dim7 = 1, b3, b5, bb7)
  'Cdim7': ['C', 'D#', 'F#', 'A'],
  'C#dim7': ['C#', 'E', 'G', 'A#'],
  'Dbdim7': ['C#', 'E', 'G', 'A#'],
  'Ddim7': ['D', 'F', 'G#', 'B'],
  'D#dim7': ['D#', 'F#', 'A', 'C'],
  'Ebdim7': ['D#', 'F#', 'A', 'C'],
  'Edim7': ['E', 'G', 'A#', 'C#'],
  'Fdim7': ['F', 'G#', 'B', 'D'],
  'F#dim7': ['F#', 'A', 'C', 'D#'],
  'Gbdim7': ['F#', 'A', 'C', 'D#'],
  'Gdim7': ['G', 'A#', 'C#', 'E'],
  'G#dim7': ['G#', 'B', 'D', 'F'],
  'Abdim7': ['G#', 'B', 'D', 'F'],
  'Adim7': ['A', 'C', 'D#', 'F#'],
  'A#dim7': ['A#', 'C#', 'E', 'G'],
  'Bbdim7': ['A#', 'C#', 'E', 'G'],
  'Bdim7': ['B', 'D', 'F', 'G#'],

  // Half-diminished 7th chords (hdim7/m7b5 = 1, b3, b5, b7)
  'Chdim7': ['C', 'D#', 'F#', 'A#'],
  'C#hdim7': ['C#', 'E', 'G', 'B'],
  'Dbhdim7': ['C#', 'E', 'G', 'B'],
  'Dhdim7': ['D', 'F', 'G#', 'C'],
  'D#hdim7': ['D#', 'F#', 'A', 'C#'],
  'Ebhdim7': ['D#', 'F#', 'A', 'C#'],
  'Ehdim7': ['E', 'G', 'A#', 'D'],
  'Fhdim7': ['F', 'G#', 'B', 'D#'],
  'F#hdim7': ['F#', 'A', 'C', 'E'],
  'Gbhdim7': ['F#', 'A', 'C', 'E'],
  'Ghdim7': ['G', 'A#', 'C#', 'F'],
  'G#hdim7': ['G#', 'B', 'D', 'F#'],
  'Abhdim7': ['G#', 'B', 'D', 'F#'],
  'Ahdim7': ['A', 'C', 'D#', 'G'],
  'A#hdim7': ['A#', 'C#', 'E', 'G#'],
  'Bbhdim7': ['A#', 'C#', 'E', 'G#'],
  'Bhdim7': ['B', 'D', 'F', 'A'],

  // Minor-major 7th chords (minmaj7 = 1, b3, 5, 7)
  'Cminmaj7': ['C', 'D#', 'G', 'B'],
  'C#minmaj7': ['C#', 'E', 'G#', 'C'],
  'Dbminmaj7': ['C#', 'E', 'G#', 'C'],
  'Dminmaj7': ['D', 'F', 'A', 'C#'],
  'D#minmaj7': ['D#', 'F#', 'A#', 'D'],
  'Ebminmaj7': ['D#', 'F#', 'A#', 'D'],
  'Eminmaj7': ['E', 'G', 'B', 'D#'],
  'Fminmaj7': ['F', 'G#', 'C', 'E'],
  'F#minmaj7': ['F#', 'A', 'C#', 'F'],
  'Gbminmaj7': ['F#', 'A', 'C#', 'F'],
  'Gminmaj7': ['G', 'A#', 'D', 'F#'],
  'G#minmaj7': ['G#', 'B', 'D#', 'G'],
  'Abminmaj7': ['G#', 'B', 'D#', 'G'],
  'Aminmaj7': ['A', 'C', 'E', 'G#'],
  'A#minmaj7': ['A#', 'C#', 'F', 'A'],
  'Bbminmaj7': ['A#', 'C#', 'F', 'A'],
  'Bminmaj7': ['B', 'D', 'F#', 'A#'],

  // Minor 6th chords (min6 = 1, b3, 5, 6)
  'Cmin6': ['C', 'D#', 'G', 'A'],
  'C#min6': ['C#', 'E', 'G#', 'A#'],
  'Dbmin6': ['C#', 'E', 'G#', 'A#'],
  'Dmin6': ['D', 'F', 'A', 'B'],
  'D#min6': ['D#', 'F#', 'A#', 'C'],
  'Ebmin6': ['D#', 'F#', 'A#', 'C'],
  'Emin6': ['E', 'G', 'B', 'C#'],
  'Fmin6': ['F', 'G#', 'C', 'D'],
  'F#min6': ['F#', 'A', 'C#', 'D#'],
  'Gbmin6': ['F#', 'A', 'C#', 'D#'],
  'Gmin6': ['G', 'A#', 'D', 'E'],
  'G#min6': ['G#', 'B', 'D#', 'F'],
  'Abmin6': ['G#', 'B', 'D#', 'F'],
  'Amin6': ['A', 'C', 'E', 'F#'],
  'A#min6': ['A#', 'C#', 'F', 'G'],
  'Bbmin6': ['A#', 'C#', 'F', 'G'],
  'Bmin6': ['B', 'D', 'F#', 'G#'],

  // Major 6th chords (maj6/6 = 1, 3, 5, 6)
  'C6': ['C', 'E', 'G', 'A'],
  'Cmaj6': ['C', 'E', 'G', 'A'],
  'C#6': ['C#', 'F', 'G#', 'A#'],
  'C#maj6': ['C#', 'F', 'G#', 'A#'],
  'Db6': ['C#', 'F', 'G#', 'A#'],
  'Dbmaj6': ['C#', 'F', 'G#', 'A#'],
  'D6': ['D', 'F#', 'A', 'B'],
  'Dmaj6': ['D', 'F#', 'A', 'B'],
  'D#6': ['D#', 'G', 'A#', 'C'],
  'D#maj6': ['D#', 'G', 'A#', 'C'],
  'Eb6': ['D#', 'G', 'A#', 'C'],
  'Ebmaj6': ['D#', 'G', 'A#', 'C'],
  'E6': ['E', 'G#', 'B', 'C#'],
  'Emaj6': ['E', 'G#', 'B', 'C#'],
  'F6': ['F', 'A', 'C', 'D'],
  'Fmaj6': ['F', 'A', 'C', 'D'],
  'F#6': ['F#', 'A#', 'C#', 'D#'],
  'F#maj6': ['F#', 'A#', 'C#', 'D#'],
  'Gb6': ['F#', 'A#', 'C#', 'D#'],
  'Gbmaj6': ['F#', 'A#', 'C#', 'D#'],
  'G6': ['G', 'B', 'D', 'E'],
  'Gmaj6': ['G', 'B', 'D', 'E'],
  'G#6': ['G#', 'C', 'D#', 'F'],
  'G#maj6': ['G#', 'C', 'D#', 'F'],
  'Ab6': ['G#', 'C', 'D#', 'F'],
  'Abmaj6': ['G#', 'C', 'D#', 'F'],
  'A6': ['A', 'C#', 'E', 'F#'],
  'Amaj6': ['A', 'C#', 'E', 'F#'],
  'A#6': ['A#', 'D', 'F', 'G'],
  'A#maj6': ['A#', 'D', 'F', 'G'],
  'Bb6': ['A#', 'D', 'F', 'G'],
  'Bbmaj6': ['A#', 'D', 'F', 'G'],
  'B6': ['B', 'D#', 'F#', 'G#'],
  'Bmaj6': ['B', 'D#', 'F#', 'G#'],

  // Augmented chords (aug = 1, 3, #5)
  'Caug': ['C', 'E', 'G#'],
  'C#aug': ['C#', 'F', 'A'],
  'Dbaug': ['C#', 'F', 'A'],
  'Daug': ['D', 'F#', 'A#'],
  'D#aug': ['D#', 'G', 'B'],
  'Ebaug': ['D#', 'G', 'B'],
  'Eaug': ['E', 'G#', 'C'],
  'Faug': ['F', 'A', 'C#'],
  'F#aug': ['F#', 'A#', 'D'],
  'Gbaug': ['F#', 'A#', 'D'],
  'Gaug': ['G', 'B', 'D#'],
  'G#aug': ['G#', 'C', 'E'],
  'Abaug': ['G#', 'C', 'E'],
  'Aaug': ['A', 'C#', 'F'],
  'A#aug': ['A#', 'D', 'F#'],
  'Bbaug': ['A#', 'D', 'F#'],
  'Baug': ['B', 'D#', 'G'],

  // Suspended chords (sus2 = 1, 2, 5)
  'Csus2': ['C', 'D', 'G'],
  'C#sus2': ['C#', 'D#', 'G#'],
  'Dbsus2': ['C#', 'D#', 'G#'],
  'Dsus2': ['D', 'E', 'A'],
  'D#sus2': ['D#', 'F', 'A#'],
  'Ebsus2': ['D#', 'F', 'A#'],
  'Esus2': ['E', 'F#', 'B'],
  'Fsus2': ['F', 'G', 'C'],
  'F#sus2': ['F#', 'G#', 'C#'],
  'Gbsus2': ['F#', 'G#', 'C#'],
  'Gsus2': ['G', 'A', 'D'],
  'G#sus2': ['G#', 'A#', 'D#'],
  'Absus2': ['G#', 'A#', 'D#'],
  'Asus2': ['A', 'B', 'E'],
  'A#sus2': ['A#', 'C', 'F'],
  'Bbsus2': ['A#', 'C', 'F'],
  'Bsus2': ['B', 'C#', 'F#'],

  // Suspended 4th chords (sus4 = 1, 4, 5)
  'Csus4': ['C', 'F', 'G'],
  'C#sus4': ['C#', 'F#', 'G#'],
  'Dbsus4': ['C#', 'F#', 'G#'],
  'Dsus4': ['D', 'G', 'A'],
  'D#sus4': ['D#', 'G#', 'A#'],
  'Ebsus4': ['D#', 'G#', 'A#'],
  'Esus4': ['E', 'A', 'B'],
  'Fsus4': ['F', 'A#', 'C'],
  'F#sus4': ['F#', 'B', 'C#'],
  'Gbsus4': ['F#', 'B', 'C#'],
  'Gsus4': ['G', 'C', 'D'],
  'G#sus4': ['G#', 'C#', 'D#'],
  'Absus4': ['G#', 'C#', 'D#'],
  'Asus4': ['A', 'D', 'E'],
  'A#sus4': ['A#', 'D#', 'F'],
  'Bbsus4': ['A#', 'D#', 'F'],
  'Bsus4': ['B', 'E', 'F#'],
};

// 2 octaves for better visibility
const WHITE_KEYS = ['C', 'D', 'E', 'F', 'G', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'A', 'B'];
const BLACK_KEYS = ['C#', 'D#', '', 'F#', 'G#', 'A#', '', 'C#', 'D#', '', 'F#', 'G#', 'A#', ''];

// Helper function to calculate chord notes dynamically for unknown chords
const calculateChordNotes = (root, quality) => {
  const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const rootIndex = notes.indexOf(root);
  if (rootIndex === -1) return null;

  const getNote = (semitones) => notes[(rootIndex + semitones) % 12];

  // Return notes based on chord quality intervals
  switch(quality) {
    case '': // Major triad: 1, 3, 5 (0, 4, 7 semitones)
      return [getNote(0), getNote(4), getNote(7)];
    case 'm': // Minor triad: 1, b3, 5 (0, 3, 7 semitones)
      return [getNote(0), getNote(3), getNote(7)];
    case '7': // Dominant 7th: 1, 3, 5, b7 (0, 4, 7, 10 semitones)
      return [getNote(0), getNote(4), getNote(7), getNote(10)];
    case 'm7': // Minor 7th: 1, b3, 5, b7 (0, 3, 7, 10 semitones)
      return [getNote(0), getNote(3), getNote(7), getNote(10)];
    case 'maj7':
    case 'M7': // Major 7th: 1, 3, 5, 7 (0, 4, 7, 11 semitones)
      return [getNote(0), getNote(4), getNote(7), getNote(11)];
    case '6':
    case 'maj6': // Major 6th: 1, 3, 5, 6 (0, 4, 7, 9 semitones)
      return [getNote(0), getNote(4), getNote(7), getNote(9)];
    case 'min6':
    case 'm6': // Minor 6th: 1, b3, 5, 6 (0, 3, 7, 9 semitones)
      return [getNote(0), getNote(3), getNote(7), getNote(9)];
    case 'dim':
    case '°': // Diminished: 1, b3, b5 (0, 3, 6 semitones)
      return [getNote(0), getNote(3), getNote(6)];
    case 'dim7':
    case '°7': // Diminished 7th: 1, b3, b5, bb7 (0, 3, 6, 9 semitones)
      return [getNote(0), getNote(3), getNote(6), getNote(9)];
    case 'hdim7':
    case 'ø7':
    case 'm7b5': // Half-diminished 7th: 1, b3, b5, b7 (0, 3, 6, 10 semitones)
      return [getNote(0), getNote(3), getNote(6), getNote(10)];
    case 'minmaj7':
    case 'mM7': // Minor-major 7th: 1, b3, 5, 7 (0, 3, 7, 11 semitones)
      return [getNote(0), getNote(3), getNote(7), getNote(11)];
    case 'aug':
    case '+': // Augmented: 1, 3, #5 (0, 4, 8 semitones)
      return [getNote(0), getNote(4), getNote(8)];
    case 'sus2': // Suspended 2nd: 1, 2, 5 (0, 2, 7 semitones)
      return [getNote(0), getNote(2), getNote(7)];
    case 'sus4':
    case 'sus': // Suspended 4th: 1, 4, 5 (0, 5, 7 semitones)
      return [getNote(0), getNote(5), getNote(7)];
    default:
      return null;
  }
};

// Function to normalize chord names from different detection systems
const normalizeChordName = (chordName) => {
  if (!chordName || chordName === 'N/C' || chordName === '—' || chordName === 'N') {
    return chordName;
  }

  // Handle colon notation (e.g., "C:min" -> "Cm", "E:hdim7" -> "Ehdim7")
  if (chordName.includes(':')) {
    const [root, quality] = chordName.split(':');
    switch (quality) {
      case 'min':
        return `${root}m`;
      case 'maj':
        return root; // Major chords don't need suffix
      case 'dim':
        return `${root}dim`;
      case 'dim7':
        return `${root}dim7`;
      case 'hdim7':
      case 'm7b5':
        return `${root}hdim7`;
      case 'aug':
        return `${root}aug`;
      case '7':
        return `${root}7`;
      case 'maj7':
        return `${root}maj7`;
      case 'min7':
        return `${root}m7`;
      case 'min6':
        return `${root}min6`;
      case 'maj6':
      case '6':
        return `${root}6`;
      case 'minmaj7':
      case 'mM7':
        return `${root}minmaj7`;
      case 'sus2':
        return `${root}sus2`;
      case 'sus4':
      case 'sus':
        return `${root}sus4`;
      default:
        // For unknown qualities, try to preserve them
        return `${root}${quality}`;
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
      case 'min6':
        formatted = `${root}m6`;
        break;
      case 'maj6':
      case '6':
        formatted = `${root}6`;
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

const PianoChordDiagram = ({ chordName }) => {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('[PianoChordDiagram] COMPONENT RE-RENDERED');
  console.log('[PianoChordDiagram] 1. RAW INPUT:', JSON.stringify(chordName));

  // Parse slash chords (e.g., "G/B" = G chord with B bass)
  let bassNote = null;
  let chordPart = chordName;

  if (chordName && chordName.includes('/')) {
    const [chord, bass] = chordName.split('/');
    chordPart = chord.trim();
    bassNote = bass.trim();
    console.log('[PianoChordDiagram] SLASH CHORD DETECTED - Chord:', chordPart, 'Bass:', bassNote);
  }

  // Normalize the chord name to handle different detection system formats
  const normalizedChordName = normalizeChordName(chordPart);
  console.log('[PianoChordDiagram] 2. NORMALIZED:', JSON.stringify(normalizedChordName));

  let notes = CHORDS[normalizedChordName] || [];
  console.log('[PianoChordDiagram] 3. LOOKUP RESULT:', notes.length > 0 ? notes : 'NOT FOUND IN CHORDS TABLE');

  // If chord not found in lookup table, try to calculate it dynamically
  if (notes.length === 0 && normalizedChordName && normalizedChordName !== 'N' && normalizedChordName !== 'N/C' && normalizedChordName !== '—') {
    console.log('[PianoChordDiagram] 4. ATTEMPTING DYNAMIC CALCULATION...');

    // Parse the chord to extract root and quality
    const chordRegex = /^([A-G][#b]?)(.*)$/;
    const match = normalizedChordName.match(chordRegex);
    console.log('[PianoChordDiagram] 5. REGEX MATCH:', match);

    if (match) {
      const [, root, quality] = match;
      console.log('[PianoChordDiagram] 6. PARSED - Root:', root, 'Quality:', quality);

      // Normalize root note (b to #)
      const flatToSharp = { 'Db': 'C#', 'Eb': 'D#', 'Gb': 'F#', 'Ab': 'G#', 'Bb': 'A#' };
      const normalizedRoot = flatToSharp[root] || root;
      console.log('[PianoChordDiagram] 7. NORMALIZED ROOT:', normalizedRoot, '(from:', root, ')');

      const calculatedNotes = calculateChordNotes(normalizedRoot, quality);
      console.log('[PianoChordDiagram] 8. CALCULATED NOTES:', calculatedNotes);

      if (calculatedNotes) {
        notes = calculatedNotes;
        console.log('[PianoChordDiagram] 9. SUCCESS - Using calculated notes:', notes);
      } else {
        console.log('[PianoChordDiagram] 9. FAILED - calculateChordNotes returned null');
      }
    } else {
      console.log('[PianoChordDiagram] 5. REGEX FAILED - Could not parse chord');
    }
  }

  console.log('[PianoChordDiagram] 10. FINAL NOTES FOR HIGHLIGHTING:', notes);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  // Determine bass note (for left hand)
  // If slash chord, use specified bass; otherwise use root note (first note of chord)
  if (!bassNote && notes.length > 0) {
    bassNote = notes[0]; // Root note is typically the first note
  }

  console.log('[PianoChordDiagram] 🎹 Bass note (left hand):', bassNote);
  console.log('[PianoChordDiagram] 🎹 Chord notes (right hand):', notes);

  // Format for display
  const displayChordName = formatChordForDisplay(chordName);
  const displayNotes = notes.map(note => note.replace(/A#/g, 'Bb'));

  // Normalize notes for matching (handle enharmonic equivalents)
  const normalizeNote = (note) => {
    const enharmonic = {
      'Db': 'C#', 'Eb': 'D#', 'Gb': 'F#', 'Ab': 'G#', 'Bb': 'A#'
    };
    return enharmonic[note] || note;
  };

  const normalizedChordNotes = notes.map(normalizeNote);
  const normalizedBassNote = bassNote ? normalizeNote(bassNote) : null;
  console.log('[PianoChordDiagram] Normalized chord notes for matching:', normalizedChordNotes);
  console.log('[PianoChordDiagram] Normalized bass note for matching:', normalizedBassNote);

  // Render white keys
  const whiteKeys = WHITE_KEYS.map((key, idx) => {
    const normalizedKey = normalizeNote(key);
    const isLeftOctave = idx < 7; // First 7 keys are left octave (bass)
    const isRightOctave = idx >= 7; // Last 7 keys are right octave (chord)

    // Left octave: only highlight bass note in RED
    const isBass = isLeftOctave && normalizedBassNote && normalizedKey === normalizedBassNote;
    // Right octave: highlight all chord notes in BLUE
    const isChord = isRightOctave && normalizedChordNotes.includes(normalizedKey);

    const isActive = isBass || isChord;

    if (isActive) {
      console.log(`[PianoChordDiagram] White key "${key}" at index ${idx} is ACTIVE - ${isBass ? 'BASS (red)' : 'CHORD (blue)'}`);
    }

    return (
      <div
        key={`white-${idx}`}
        className={`w-8 h-20 border flex items-end justify-center pb-2 text-xs font-medium transition-all duration-200 ${
          isBass
            ? 'bg-red-500 text-white shadow-lg border-red-400'
            : isChord
            ? 'bg-blue-500 text-white shadow-lg border-blue-400'
            : 'bg-white hover:bg-zinc-100 text-zinc-600 border-zinc-400'
        }`}
        style={{
          borderRadius: '0 0 4px 4px',
        }}
      >
        {/* Show note name only on active keys */}
        {isActive && <span className="font-bold">{key}</span>}
      </div>
    );
  });

  // Render black keys (skip empty slots)
  const blackKeys = BLACK_KEYS.map((key, idx) => {
    if (!key) return <div key={`spacer-${idx}`} className="w-6" />; // spacer

    const normalizedKey = normalizeNote(key);
    const isLeftOctave = idx < 7; // First 7 positions are left octave (bass)
    const isRightOctave = idx >= 7; // Last 7 positions are right octave (chord)

    // Left octave: only highlight bass note in RED
    const isBass = isLeftOctave && normalizedBassNote && normalizedKey === normalizedBassNote;
    // Right octave: highlight all chord notes in BLUE
    const isChord = isRightOctave && normalizedChordNotes.includes(normalizedKey);

    const isActive = isBass || isChord;

    if (isActive) {
      console.log(`[PianoChordDiagram] Black key "${key}" at index ${idx} is ACTIVE - ${isBass ? 'BASS (red)' : 'CHORD (blue)'}`);
    }

    // Calculate proper spacing for black keys
    const getMarginLeft = () => {
      const posInOctave = idx % 7;
      if (posInOctave === 0) return '1.25rem'; // After C
      if (posInOctave === 2) return '1.25rem'; // After E (gap before F)
      return '0.5rem';
    };

    return (
      <div
        key={`black-${idx}`}
        className={`w-6 h-12 flex items-end justify-center pb-1 text-xs font-medium transition-all duration-200 ${
          isBass
            ? 'bg-red-600 text-white shadow-lg'
            : isChord
            ? 'bg-blue-600 text-white shadow-lg'
            : 'bg-zinc-800 hover:bg-zinc-700 text-white'
        }`}
        style={{
          borderRadius: '0 0 2px 2px',
          marginLeft: getMarginLeft(),
          marginRight: '0.5rem',
          position: 'relative',
          zIndex: 10,
        }}
      >
        {/* Show note name only on active keys */}
        {isActive && <span className="font-bold">{key.replace('#', '♯')}</span>}
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
        <div className="chord-info mt-4 text-center space-y-2">
          <div className="text-lg font-bold text-zinc-100">{displayChordName}</div>
          <div className="flex items-center justify-center gap-4 text-xs">
            <div className="flex items-center gap-1">
              <span className="text-red-400 font-semibold">Bass:</span>
              <span className="text-red-300">{bassNote ? bassNote.replace(/A#/g, 'Bb') : '—'}</span>
            </div>
            <div className="text-zinc-600">|</div>
            <div className="flex items-center gap-1">
              <span className="text-blue-400 font-semibold">Chord:</span>
              <span className="text-blue-300">{displayNotes.join(' • ')}</span>
            </div>
          </div>
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