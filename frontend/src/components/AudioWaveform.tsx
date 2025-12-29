import React, { useEffect, useRef, useState } from 'react';
import WaveSurfer from 'wavesurfer.js';
import { PlayIcon, PauseIcon, ForwardIcon, BackwardIcon, ArrowPathIcon } from '@heroicons/react/24/solid';
import './AudioWaveform.css';

interface AudioWaveformProps {
  audioUrl: string;
  title: string;
  isActive?: boolean; // New prop to track if this player should be active
  onBecomeActive?: () => void; // Callback when this player becomes active
}

// Global audio manager to stop all other audio instances
let globalAudioInstances: Set<WaveSurfer> = new Set();
let currentActivePlayer: WaveSurfer | null = null;

// Global function to stop all audio (can be called from outside)
(window as any).stopAllAudio = () => {
  globalAudioInstances.forEach(ws => {
    try {
      if (ws && ws.isPlaying && ws.isPlaying()) {
        ws.pause();
      }
    } catch (error) {
      console.debug('Error stopping audio:', error);
    }
  });
  currentActivePlayer = null;
};

const AudioWaveform: React.FC<AudioWaveformProps> = ({ 
  audioUrl, 
  title, 
  isActive = true, 
  onBecomeActive 
}) => {
  const waveformRef = useRef<HTMLDivElement>(null);
  const wavesurfer = useRef<WaveSurfer | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const isVocals = title.toLowerCase().includes('vocals');
  const abortControllerRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);

  // Stop and reset this player when it becomes inactive
  useEffect(() => {
    if (!isActive && wavesurfer.current) {
      try {
        if (wavesurfer.current.isPlaying && wavesurfer.current.isPlaying()) {
          wavesurfer.current.pause();
        }
        wavesurfer.current.seekTo(0); // Reset to beginning
        setIsPlaying(false);
        setCurrentTime(0);
      } catch (error) {
        console.debug('Error resetting inactive player:', error);
      }
    }
  }, [isActive]);

  // Stop all other players when this one starts playing
  const stopAllOtherPlayers = () => {
    globalAudioInstances.forEach(ws => {
      if (ws !== wavesurfer.current) {
        try {
          if (ws && ws.isPlaying && ws.isPlaying()) {
            ws.pause();
          }
        } catch (error) {
          console.debug('Error stopping other player:', error);
        }
      }
    });
    currentActivePlayer = wavesurfer.current;
    if (onBecomeActive) {
      onBecomeActive();
    }
  };

  useEffect(() => {
    mountedRef.current = true;
    
    if (!waveformRef.current || !audioUrl) {
      return;
    }

    // Cleanup previous instance
    if (wavesurfer.current) {
      globalAudioInstances.delete(wavesurfer.current);
      try {
        wavesurfer.current.destroy();
      } catch (error) {
        console.debug('Cleanup destroy error (ignorable):', error);
      }
    }

    // Create abort controller for this instance
    abortControllerRef.current = new AbortController();
    
    // Reset states
    setIsReady(false);
    setLoadError(null);
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);

    // Handle unhandled promise rejections
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (event.reason?.name === 'AbortError') {
        event.preventDefault();
      }
    };
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    // Initialize WaveSurfer
    const ws = WaveSurfer.create({
      container: waveformRef.current,
      waveColor: 'rgba(147, 51, 234, 0.4)',
      progressColor: '#9333ea',
      cursorColor: '#6366f1',
      barWidth: 2,
      barGap: 1,
      height: 60,
      normalize: true,
      backend: 'WebAudio'
    });

    // Add to global instances
    globalAudioInstances.add(ws);

    // Event listeners
    ws.on('ready', () => {
      if (!abortControllerRef.current?.signal.aborted && mountedRef.current) {
        setIsReady(true);
        setDuration(ws.getDuration());
        console.log(`✅ WaveSurfer ready for: ${title}`);
      }
    });

    ws.on('play', () => {
      if (!abortControllerRef.current?.signal.aborted && mountedRef.current) {
        stopAllOtherPlayers(); // Stop all other players
        setIsPlaying(true);
      }
    });

    ws.on('pause', () => {
      if (!abortControllerRef.current?.signal.aborted && mountedRef.current) {
        setIsPlaying(false);
      }
    });

    ws.on('finish', () => {
      if (!abortControllerRef.current?.signal.aborted && mountedRef.current) {
        setIsPlaying(false);
        setCurrentTime(0);
        ws.seekTo(0); // Reset to beginning when finished
      }
    });

    ws.on('error', (error) => {
      if (!abortControllerRef.current?.signal.aborted && mountedRef.current) {
        console.error(`❌ WaveSurfer error for ${title}:`, {
          error,
          errorMessage: error?.message || 'Unknown error',
          errorType: error?.name || 'Unknown type',
          url: encodedUrl,
          audioUrl,
          fullUrl,
          errorString: String(error),
          errorStack: error?.stack
        });
        
        // Don't show error if it's just an abort error from switching tracks
        if (error?.name === 'AbortError' && error?.message?.includes('aborted')) {
          console.log(`🔄 Audio loading was cancelled for ${title} (likely due to switching tracks)`);
          return; // Don't set error state for abort errors
        }
        
        // Try to provide more specific error messages
        let errorMessage = 'Failed to load audio file';
        const errorStr = String(error);
        const errorMsg = error?.message || '';
        
        if (errorMsg.includes('404') || errorMsg.includes('Not Found') || errorStr.includes('404')) {
          errorMessage = 'Audio file not found on server';
        } else if (errorMsg.includes('network') || errorMsg.includes('fetch') || errorStr.includes('fetch')) {
          errorMessage = 'Network error loading audio';
        } else if (errorMsg.includes('decode') || errorMsg.includes('format') || errorStr.includes('decode')) {
          errorMessage = 'Invalid audio format';
        } else if (errorMsg.includes('CORS') || errorStr.includes('CORS')) {
          errorMessage = 'Cross-origin request blocked';
        } else if (errorStr.includes('Error')) {
          errorMessage = `Audio load error: ${errorStr}`;
        }
        
        setLoadError(errorMessage);
        setIsReady(false);
      }
    });

    ws.on('audioprocess', () => {
      if (!abortControllerRef.current?.signal.aborted && mountedRef.current) {
        setCurrentTime(ws.getCurrentTime());
      }
    });

    // Load the audio
    const fullUrl = audioUrl.startsWith('http') ? audioUrl : `http://localhost:8000${audioUrl}`;
    
    // Better URL encoding - encode each path segment separately
    let encodedUrl: string;
    try {
      if (fullUrl.includes('/audio/')) {
        const [baseUrl, audioPath] = fullUrl.split('/audio/');
        const pathSegments = audioPath.split('/');
        const encodedSegments = pathSegments.map(segment => encodeURIComponent(segment));
        encodedUrl = `${baseUrl}/audio/${encodedSegments.join('/')}`;
      } else {
        encodedUrl = fullUrl;
      }
    } catch (error) {
      console.error('Error encoding URL:', error);
      encodedUrl = fullUrl;
    }
    
    console.log(`🎵 AudioWaveform Loading:`, {
      title,
      originalUrl: audioUrl,
      fullUrl,
      encodedUrl,
      container: waveformRef.current
    });
    
    // Delay the loading slightly to prevent race conditions with abort controllers
    const loadTimeout = setTimeout(() => {
      if (!abortControllerRef.current?.signal.aborted && mountedRef.current) {
        try {
          ws.load(encodedUrl);
          wavesurfer.current = ws;
          console.log(`✅ WaveSurfer load initiated for: ${title}`);
        } catch (error) {
          console.error(`❌ Error loading ${title}:`, error);
          setLoadError('Failed to load audio file');
          setIsReady(false);
        }
      }
    }, 100); // Small delay to let the component settle

    // Cleanup function
    return () => {
      mountedRef.current = false;
      clearTimeout(loadTimeout);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      
      if (ws) {
        globalAudioInstances.delete(ws);
        if (currentActivePlayer === ws) {
          currentActivePlayer = null;
        }
        try {
          ws.destroy();
        } catch (error) {
          console.debug('Cleanup destroy error (ignorable):', error);
        }
      }
      
      if (abortControllerRef.current && !abortControllerRef.current.signal.aborted) {
        abortControllerRef.current.abort();
      }
    };
  }, [audioUrl, title]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const togglePlayPause = () => {
    if (!wavesurfer.current || !isReady || loadError) return;

    try {
      if (isPlaying) {
        wavesurfer.current.pause();
      } else {
        stopAllOtherPlayers(); // Ensure other players are stopped
        wavesurfer.current.play();
      }
    } catch (error) {
      console.error('Error toggling playback:', error);
      setLoadError('Playback error occurred');
    }
  };

  const seekBackward = () => {
    if (!wavesurfer.current || !isReady) return;
    try {
      const currentTime = wavesurfer.current.getCurrentTime();
      const newTime = Math.max(0, currentTime - 10);
      wavesurfer.current.seekTo(newTime / wavesurfer.current.getDuration());
    } catch (error) {
      console.error('Error seeking backward:', error);
    }
  };

  const seekForward = () => {
    if (!wavesurfer.current || !isReady) return;
    try {
      const currentTime = wavesurfer.current.getCurrentTime();
      const duration = wavesurfer.current.getDuration();
      const newTime = Math.min(duration, currentTime + 10);
      wavesurfer.current.seekTo(newTime / duration);
    } catch (error) {
      console.error('Error seeking forward:', error);
    }
  };

  const resetToBeginning = () => {
    if (!wavesurfer.current || !isReady) return;
    try {
      wavesurfer.current.seekTo(0);
      setCurrentTime(0);
    } catch (error) {
      console.error('Error resetting to beginning:', error);
    }
  };

  const formatTime = (time: number): string => {
    if (isNaN(time) || time < 0) return '0:00';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Remove the problematic fallback - always render full waveform interface
  return (
    <div className={`waveform-container ${title.toLowerCase().includes('vocals') ? 'vocals-track' : ''} ${loadError ? 'error' : ''}`}>
      <div className="waveform-header">
        <div className="waveform-controls">
          <button 
            className={`seek-button ${!isReady || loadError ? 'disabled' : ''}`}
            onClick={seekBackward}
            disabled={!isReady || !!loadError}
            title="Seek backward 10s"
          >
            <BackwardIcon className="player-icon" />
          </button>
          
          <button 
            className={`play-button ${!isReady || loadError ? 'disabled' : ''}`}
            onClick={togglePlayPause}
            disabled={!isReady || !!loadError}
            title={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? (
              <PauseIcon className="player-icon" />
            ) : (
              <PlayIcon className="player-icon" />
            )}
          </button>
          
          <button 
            className={`seek-button ${!isReady || loadError ? 'disabled' : ''}`}
            onClick={seekForward}
            disabled={!isReady || !!loadError}
            title="Seek forward 10s"
          >
            <ForwardIcon className="player-icon" />
          </button>
          
          <button 
            className={`seek-button ${!isReady || loadError ? 'disabled' : ''}`}
            onClick={resetToBeginning}
            disabled={!isReady || !!loadError}
            title="Reset to beginning"
          >
            <ArrowPathIcon className="player-icon" />
          </button>
          
          <span className="track-title">{title}</span>
          <span className="track-time">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>
        </div>
      </div>
      
      <div className="waveform-wrapper">
        <div ref={waveformRef} className="waveform" />
      </div>
      
      {loadError && (
        <div className="error-message">
          {loadError}
        </div>
      )}
    </div>
  );
};

export default AudioWaveform; 