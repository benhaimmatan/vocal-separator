// TypeScript interfaces for chord progression system

export interface ChordNode {
  id: string;
  chordName: string; // e.g., "Gm", "F", "Bbmaj7/Ab"
  durationBeats: number; // e.g., 8, 7, 4
  startTime?: number; // in seconds
  confidence?: number; // 0-1 detection confidence
}

export interface Progression {
  id: string;
  nodes: ChordNode[];
  bpm: number;
  totalBeats: number;
  timeSignature: [number, number]; // e.g., [4, 4]
}

export interface PlaybackState {
  currentBeat: number;
  currentTime: number; // in seconds
  isPlaying: boolean;
  bpm: number;
  activeChordIndex: number;
  totalBeats: number;
}

export interface ChordWindow {
  previous: ChordNode | null;
  current: ChordNode;
  next: ChordNode | null;
  cumulativeBeat: number; // "82" logic - cumulative beat count
  measureIndex: number;
}

// Conversion utilities from existing data format
export interface LegacyChordData {
  time: number;
  chord: string;
  confidence: number;
}

export interface ProcessedChord extends LegacyChordData {
  duration: number;
  beats: number;
  index: number;
}