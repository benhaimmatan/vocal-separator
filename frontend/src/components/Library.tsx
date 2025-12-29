import React, { useState, useEffect, useRef } from 'react';
import type { ProcessedFile } from '../types.d.ts';
import { 
  MusicalNoteIcon, 
  MicrophoneIcon, 
  TrashIcon,
  ChevronDownIcon,
  ChevronUpIcon
} from '@heroicons/react/24/solid';
import { FiMusic } from 'react-icons/fi';
import AudioWaveform from './AudioWaveform';
import './Library.css';
import { FaYoutube, FaPlay } from 'react-icons/fa';
import { FiMic, FiHeadphones } from 'react-icons/fi';
import { FiTrash, FiEdit2 } from 'react-icons/fi';
import PianoIcon from '../components/PianoIcon';

interface LibraryProps {
  files: ProcessedFile[];
  onFileSelect: (file: ProcessedFile) => void;
  onDelete: (fileId: string) => void;
  selectedFile: ProcessedFile | null;
  isLoading: boolean;
  error: string | null;
}

// Global function to stop all audio - this will be called from AudioWaveform
declare global {
  interface Window {
    stopAllLibraryAudio?: () => void;
  }
}

const Library: React.FC<LibraryProps> = ({
  files,
  onFileSelect,
  onDelete,
  selectedFile,
  isLoading,
  error
}) => {
  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  const [activePlayer, setActivePlayer] = useState<string | null>(null); // Track which player is active
  const libraryRef = useRef<HTMLDivElement>(null);

  // Add effect to handle cleanup when component unmounts or files change
  useEffect(() => {
    return () => {
      // Cleanup on unmount
      if ((window as any).stopAllAudio) {
        (window as any).stopAllAudio();
      }
    };
  }, []);

  // Stop all audio when switching between expanded cards or when collapsing
  useEffect(() => {
    // If no card is expanded (collapsed), stop all audio
    if (expandedCard === null && activePlayer) {
      if ((window as any).stopAllAudio) {
        (window as any).stopAllAudio();
      }
      setActivePlayer(null);
    }
  }, [expandedCard, activePlayer]);

  // Function to handle when a player becomes active
  const handlePlayerBecomeActive = (fileId: string, trackType: string) => {
    const playerId = `${fileId}-${trackType}`;
    setActivePlayer(playerId);
  };

  // Function to handle when expanding a file card
  const handleFileExpand = (fileId: string) => {
    const currentExpandedFileId = expandedCard;
    
    // Stop audio in these cases:
    // 1. Switching to a different file AND there's audio playing
    // 2. Collapsing the current file (clicking same song again)
    if (activePlayer && (
      (currentExpandedFileId && currentExpandedFileId !== fileId) || // Switching to different file
      (currentExpandedFileId === fileId) // Collapsing current file
    )) {
      if ((window as any).stopAllAudio) {
        (window as any).stopAllAudio();
      }
      setActivePlayer(null);
    }
    
    // Toggle expansion
    if (expandedCard === fileId) {
      setExpandedCard(null); // Collapse
    } else {
      setExpandedCard(fileId); // Expand
    }
  };

  // Handle clicking outside to collapse and stop audio
  const handleContainerClick = (e: React.MouseEvent) => {
    // If clicking on the main container (not a card), stop audio and collapse
    if (e.target === e.currentTarget) {
      // Always stop audio when clicking outside
      if ((window as any).stopAllAudio) {
        (window as any).stopAllAudio();
      }
      setActivePlayer(null);
      setExpandedCard(null);
    }
  };

  const parseArtistAndTitle = (filename: string) => {
    // Remove file extension
    const nameWithoutExt = filename.replace(/\.[^/.]+$/, '');
    
    // Try to split by " - " (common format)
    if (nameWithoutExt.includes(' - ')) {
      const parts = nameWithoutExt.split(' - ');
      return {
        artist: parts[0].trim(),
        title: parts.slice(1).join(' - ').trim()
      };
    }
    
    // Try to split by " by " 
    if (nameWithoutExt.includes(' by ')) {
      const parts = nameWithoutExt.split(' by ');
      return {
        title: parts[0].trim(),
        artist: parts.slice(1).join(' by ').trim()
      };
    }
    
    // Default: treat entire name as title
    return {
      artist: 'Unknown Artist',
      title: nameWithoutExt
    };
  };

  const handleDelete = (fileId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    // Stop any playing audio before deleting
    if ((window as any).stopAllAudio) {
      (window as any).stopAllAudio();
    }
    setActivePlayer(null);
    onDelete(fileId);
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return 'Unknown date';
    }
  };

  const getTrackIcon = (trackType: string) => {
    switch (trackType) {
      case 'vocals':
        return <FiMic className="badge-icon" />;
      case 'accompaniment':
        return <FiHeadphones className="badge-icon" />;
      case 'piano':
        return <PianoIcon className="badge-icon" />;
      default:
        return <FiMusic className="badge-icon" />;
    }
  };

  const getTrackClass = (trackType: string) => {
    switch (trackType) {
      case 'vocals':
        return 'vocals';
      case 'accompaniment':
        return 'accompaniment';
      case 'piano':
        return 'piano';
      default:
        return 'original';
    }
  };

  const renderTrackPlayer = (file: ProcessedFile, trackType: 'original' | 'vocals' | 'accompaniment' | 'piano') => {
    const trackUrl = file.files[trackType];
    if (!trackUrl) {
      return (
        <div className="missing-track">
          <div className="missing-track-message">
            {getTrackIcon(trackType)}
            <span>{trackType.charAt(0).toUpperCase() + trackType.slice(1)} track not available</span>
          </div>
        </div>
      );
    }

    const playerId = `${file.id}-${trackType}`;
    const isActive = true; // Always allow waveforms to load and be active

    const fullUrl = trackUrl.startsWith('http') ? trackUrl : `http://localhost:8000${trackUrl}`;

    return (
      <div className="track-section" key={trackType}>
        <AudioWaveform 
          audioUrl={fullUrl}
          title={`${trackType.charAt(0).toUpperCase() + trackType.slice(1)} Track`}
          isActive={isActive}
          onBecomeActive={() => handlePlayerBecomeActive(file.id, trackType)}
        />
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="library-container">
        <div className="library-loading">
          <div className="loading-spinner"></div>
          <p>Loading your music library...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="library-container">
        <div className="library-error">
          <h3>Error Loading Library</h3>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  if (files.length === 0) {
    return (
      <div className="library-container">
        <div className="library-empty">
          <FiMusic className="icon" style={{ fontSize: '3rem', marginBottom: '1rem', color: '#6b7280' }} />
          <h2>Your Library is Empty</h2>
          <p>Upload some audio files to get started with vocal separation and analysis!</p>
        </div>
      </div>
    );
  }

  // Separate files by source type
  const liveRecordings = files.filter(file => file.source === 'live_recording');
  const otherFiles = files.filter(file => file.source !== 'live_recording');

  const renderFileGrid = (fileList: ProcessedFile[], sectionTitle?: string) => (
    <div className="library-section">
      {sectionTitle && (
        <div className="section-header">
          <h2 className="section-title">{sectionTitle}</h2>
          <div className="section-count">{fileList.length} {fileList.length === 1 ? 'file' : 'files'}</div>
        </div>
      )}
      <div className="library-grid">
        {fileList.map((file) => {
          const { artist, title } = parseArtistAndTitle(file.originalName);
          const isExpanded = expandedCard === file.id;
          
          return (
            <div 
              key={file.id} 
              className={`library-card ${isExpanded ? 'expanded' : ''}`}
            >
              <div 
                className="card-header"
                onClick={(e) => {
                  e.stopPropagation();
                  handleFileExpand(file.id);
                }}
              >
                <div className="header-content">
                  <div className="music-icon">
                    <FiMusic className="icon" />
                  </div>
                  
                  <div className="file-details">
                    <h3 className="file-name">{title}</h3>
                    <p className="file-date">by {artist}</p>
                  </div>
                </div>
                
                <div className="header-actions">
                  <div className="track-badges">
                    {(['original', 'vocals', 'accompaniment', 'piano'] as const).map(trackType => {
                      if (file.files[trackType]) {
                        return (
                          <div key={`${file.id}-badge-${trackType}`} className={`track-badge ${getTrackClass(trackType)}`}>
                            {getTrackIcon(trackType)}
                            <span>{trackType.charAt(0).toUpperCase() + trackType.slice(1)}</span>
                          </div>
                        );
                      }
                      return null;
                    })}
                  </div>
                  
                  <button 
                    className="delete-button"
                    onClick={(e) => handleDelete(file.id, e)}
                    title="Delete file"
                  >
                    <FiTrash className="action-icon" />
                  </button>
                  
                  {isExpanded ? (
                    <ChevronUpIcon className="expand-icon" />
                  ) : (
                    <ChevronDownIcon className="expand-icon" />
                  )}
                </div>
              </div>
              
              <div className={`card-content ${isExpanded ? 'expanded' : ''}`}>
                {isExpanded && (
                  <>
                    {(['original', 'vocals', 'accompaniment', 'piano'] as const).map(trackType => 
                      <div key={`${file.id}-player-${trackType}`}>
                        {renderTrackPlayer(file, trackType)}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="library-container" ref={libraryRef} onClick={handleContainerClick}>
      <h1 className="library-title">Music Library</h1>
      
      {liveRecordings.length > 0 && renderFileGrid(liveRecordings, "🎤 Live Recordings")}
      {otherFiles.length > 0 && renderFileGrid(otherFiles, otherFiles.length === files.length ? undefined : "🎵 Music Files")}
    </div>
  );
};

export default Library; 