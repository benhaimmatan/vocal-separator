declare module '@tonejs/midi' {
  export interface MidiNote {
    midi: number;
    time: number;
    duration: number;
    velocity: number;
    name: string;
    ticks: number;
    durationTicks: number;
  }

  export interface Track {
    name: string;
    notes: MidiNote[];
    channel: number;
    instrument: {
      number: number;
      name: string;
      family: string;
    };
  }

  export class Midi {
    constructor(arrayBuffer: ArrayBuffer);
    name: string;
    duration: number;
    tracks: Track[];
    header: {
      name: string;
      tempos: Array<{
        bpm: number;
        ticks: number;
      }>;
      timeSignatures: Array<{
        timeSignature: [number, number];
        ticks: number;
      }>;
      keySignatures: Array<{
        key: string;
        scale: string;
        ticks: number;
      }>;
    };
  }
} 