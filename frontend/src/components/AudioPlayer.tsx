import React, { useState, useRef, useEffect } from 'react';
import './AudioPlayer.css';

interface AudioPlayerProps {
  src: string;
  title: string;
}

const AudioPlayer: React.FC<AudioPlayerProps> = ({ src, title }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Decode the URL before setting it as the audio source
    const decodedSrc = decodeURIComponent(src);
    console.log('Loading audio from:', decodedSrc);
    
    if (audioRef.current) {
      audioRef.current.src = decodedSrc;
      audioRef.current.load(); // Force reload with new source
    }
  }, [src]);

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const handlePlayPause = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = Number(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  return (
    <div className="audio-player">
      <h3>{title}</h3>
      <div className="player-controls">
        <button 
          onClick={handlePlayPause} 
          className="play-pause-button"
          disabled={!!error}
        >
          {isPlaying ? '⏸️' : '▶️'}
        </button>
        <div className="time-control">
          <span className="time">{formatTime(currentTime)}</span>
          <input
            type="range"
            min="0"
            max={duration}
            value={currentTime}
            onChange={handleSeek}
            className="time-slider"
            disabled={!!error}
          />
          <span className="time">{formatTime(duration)}</span>
        </div>
      </div>
      <audio
        ref={audioRef}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onError={(e) => {
          console.error('Audio error:', e);
          setError('Failed to load audio file');
        }}
        onEnded={() => setIsPlaying(false)}
      />
      {error && <div className="error">{error}</div>}
    </div>
  );
};

export default AudioPlayer; 