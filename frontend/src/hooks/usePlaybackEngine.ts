import { useRef, useEffect, useState, useCallback } from 'react';
import { ChordNode, PlaybackState, ChordWindow, Progression } from '../types/chord';

export const usePlaybackEngine = (
  progression: Progression | null,
  audioRef: React.RefObject<HTMLAudioElement>
) => {
  const [playbackState, setPlaybackState] = useState<PlaybackState>({
    currentBeat: 0,
    currentTime: 0,
    isPlaying: false,
    bpm: 120,
    activeChordIndex: 0,
    totalBeats: 0
  });

  const frameRef = useRef<number>();
  const lastUpdateTime = useRef<number>(0);

  // Convert current time to beat position
  const timeToBeat = useCallback((timeInSeconds: number, bpm: number): number => {
    return (timeInSeconds / 60) * bpm * 4; // Assuming 4/4 time signature
  }, []);

  // Calculate which chord is active based on current beat
  const calculateActiveChord = useCallback((currentBeat: number, nodes: ChordNode[]): number => {
    if (!nodes || nodes.length === 0) return 0;

    let cumulativeBeats = 0;
    for (let i = 0; i < nodes.length; i++) {
      cumulativeBeats += nodes[i].durationBeats;
      if (currentBeat < cumulativeBeats) {
        return i;
      }
    }
    return Math.max(0, nodes.length - 1); // Return last chord if beyond end
  }, []);

  // Get the current chord window (previous, current, next)
  const getChordWindow = useCallback((
    activeIndex: number, 
    nodes: ChordNode[], 
    currentBeat: number
  ): ChordWindow | null => {
    if (!nodes || nodes.length === 0) return null;

    const current = nodes[activeIndex];
    const previous = activeIndex > 0 ? nodes[activeIndex - 1] : null;
    const next = activeIndex < nodes.length - 1 ? nodes[activeIndex + 1] : null;

    // Calculate cumulative beat count up to current chord
    let cumulativeBeat = 0;
    for (let i = 0; i <= activeIndex; i++) {
      if (i < activeIndex) {
        cumulativeBeat += nodes[i].durationBeats;
      } else {
        // Add current position within the active chord
        const beatsIntoCurrentChord = currentBeat - cumulativeBeat;
        cumulativeBeat += Math.floor(beatsIntoCurrentChord);
      }
    }

    const measureIndex = Math.floor(cumulativeBeat / 4); // Assuming 4/4 time

    return {
      previous,
      current,
      next,
      cumulativeBeat,
      measureIndex
    };
  }, []);

  // Main update loop - frame accurate
  const updatePlayback = useCallback(() => {
    if (!audioRef.current || !progression) return;

    const currentTime = audioRef.current.currentTime;
    const isPlaying = !audioRef.current.paused;
    const bpm = progression.bpm;
    
    const currentBeat = timeToBeat(currentTime, bpm);
    const activeChordIndex = calculateActiveChord(currentBeat, progression.nodes);

    // Only update state if something meaningful changed
    setPlaybackState(prev => {
      const needsUpdate = 
        prev.currentTime !== currentTime ||
        prev.currentBeat !== currentBeat ||
        prev.isPlaying !== isPlaying ||
        prev.activeChordIndex !== activeChordIndex ||
        prev.bpm !== bpm;

      if (!needsUpdate) return prev;

      return {
        currentBeat,
        currentTime,
        isPlaying,
        bpm,
        activeChordIndex,
        totalBeats: progression.totalBeats
      };
    });

    // Schedule next frame only if playing
    if (isPlaying) {
      frameRef.current = requestAnimationFrame(updatePlayback);
    }
  }, [progression, audioRef, timeToBeat, calculateActiveChord]);

  // Start/stop the update loop based on play state
  useEffect(() => {
    if (playbackState.isPlaying) {
      frameRef.current = requestAnimationFrame(updatePlayback);
    } else {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
      }
    }

    return () => {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, [playbackState.isPlaying, updatePlayback]);

  // Listen to audio events
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handlePlay = () => {
      setPlaybackState(prev => ({ ...prev, isPlaying: true }));
    };

    const handlePause = () => {
      setPlaybackState(prev => ({ ...prev, isPlaying: false }));
    };

    const handleTimeUpdate = () => {
      // Trigger an update when time changes
      updatePlayback();
    };

    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('seeked', handleTimeUpdate);

    return () => {
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('seeked', handleTimeUpdate);
    };
  }, [audioRef, updatePlayback]);

  // Get current chord window
  const currentWindow = progression 
    ? getChordWindow(playbackState.activeChordIndex, progression.nodes, playbackState.currentBeat)
    : null;

  // Jump to specific chord
  const jumpToChord = useCallback((chordIndex: number) => {
    if (!audioRef.current || !progression || !progression.nodes[chordIndex]) return;

    // Calculate the start time of the target chord
    let cumulativeBeats = 0;
    for (let i = 0; i < chordIndex; i++) {
      cumulativeBeats += progression.nodes[i].durationBeats;
    }

    const targetTime = (cumulativeBeats / 4) * (60 / progression.bpm);
    audioRef.current.currentTime = targetTime;
    
    // Force immediate update
    updatePlayback();
  }, [audioRef, progression, updatePlayback]);

  return {
    playbackState,
    currentWindow,
    jumpToChord,
    progression
  };
};