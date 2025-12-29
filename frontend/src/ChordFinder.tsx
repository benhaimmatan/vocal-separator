import React, { useState, useEffect, useRef } from 'react';
import type { ProcessedFile } from './types';
import { 
  MusicalNoteIcon,
  PlayIcon,
  PauseIcon,
  CheckIcon,
  XMarkIcon
} from '@heroicons/react/24/solid';
import { FiMusic, FiEdit2 } from 'react-icons/fi';
import './ChordFinder.css';
import PianoChordDiagram from './components/PianoChordDiagram';
import ChordProgressionBar from './components/ChordProgressionBar';

interface ChordSection {
  startTime: number;
  endTime: number;
  chord: string;
}

interface ProgressMessage {
  type: string;
  status: string;
  message: string;
  fileId: string;
  progress: number;
}

interface CustomMetadata {
  [fileId: string]: {
    title: string;
    artist: string;
  };
}

const parseArtistAndTitle = (filename: string) => {
  // Remove file extension
  const nameWithoutExt = filename.replace(/\.(mp3|wav|flac|m4a|aac)$/i, '');
  
  // Common patterns to try
  const patterns = [
    // "Artist - Title" format
    /^(.+?)\s*-\s*(.+)$/,
    // "Artist: Title" format  
    /^(.+?)\s*:\s*(.+)$/,
    // "Artist – Title" (em dash)
    /^(.+?)\s*–\s*(.+)$/,
    // "Artist | Title"
    /^(.+?)\s*\|\s*(.+)$/,
  ];
  
  for (const pattern of patterns) {
    const match = nameWithoutExt.match(pattern);
    if (match) {
      const artist = match[1].trim();
      const title = match[2].trim();
      
      // Clean up common prefixes/suffixes
      const cleanTitle = title
        .replace(/\s*\(.*?\)\s*$/, '') // Remove parentheses at end
        .replace(/\s*\[.*?\]\s*$/, '') // Remove brackets at end
        .replace(/\s*HD\s*$/, '')      // Remove HD suffix
        .replace(/\s*Official.*$/i, '') // Remove "Official Video" etc
        .trim();
        
      return {
        artist: artist,
        title: cleanTitle || title // Fallback to original title if cleaning removed everything
      };
    }
  }
  
  // If no pattern matches, treat whole name as title
  const cleanName = nameWithoutExt
    .replace(/\s*\(.*?\)\s*$/, '')
    .replace(/\s*\[.*?\]\s*$/, '')
    .replace(/\s*HD\s*$/, '')
    .replace(/\s*Official.*$/i, '')
    .trim();
    
  return {
    artist: 'Unknown Artist',
    title: cleanName || nameWithoutExt
  };
};

const formatTime = (seconds: number): string => {
  if (isNaN(seconds) || !isFinite(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const removeFileExtension = (filename: string): string => {
  return filename.replace(/\.(mp3|wav|flac|m4a|aac)$/i, '');
};

interface ChordFinderProps {
  onChordsDetected?: (chords: ChordSection[]) => void;
  onFileSelected?: (file: ProcessedFile | null) => void;
}

function ChordFinder({ onChordsDetected, onFileSelected }: ChordFinderProps) {
  const [files, setFiles] = useState<ProcessedFile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<ProcessedFile | null>(null);
  const [detectedChords, setDetectedChords] = useState<ChordSection[]>([]);
  const [detectedBeats, setDetectedBeats] = useState<number[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentChord, setCurrentChord] = useState('');
  const [audioError, setAudioError] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [progressMessage, setProgressMessage] = useState<string>('');
  const [progressValue, setProgressValue] = useState<number>(0);
  const [simplicityPreference, setSimplicityPreference] = useState<number>(0.5);
  const [isUsingCachedChords, setIsUsingCachedChords] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [isCheckingChords, setIsCheckingChords] = useState(false);
  const [bpm, setBpm] = useState<number>(120);
  const [showAnalysisSuccessPopup, setShowAnalysisSuccessPopup] = useState(false);
  
  const audioRef = useRef<HTMLAudioElement>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const chordFinderRootRef = useRef<HTMLDivElement>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Custom metadata state
  const [customMetadata, setCustomMetadata] = useState<CustomMetadata>({});
  const [editingFileId, setEditingFileId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [editingArtist, setEditingArtist] = useState('');

  // Fetch library data
  useEffect(() => {
    const fetchLibrary = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch('http://localhost:8000/api/library');
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        
        if (!data.files) {
          throw new Error('Invalid response format');
        }
        
        setFiles(data.files);
      } catch (error) {
        console.error('Error fetching library:', error);
        setError('Failed to load library. Please check if the backend server is running.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchLibrary();
  }, []);

  // WebSocket connection for real-time progress updates
  useEffect(() => {
    const connectWebSocket = () => {
      try {
        const ws = new WebSocket('ws://localhost:8000/ws');
        
        ws.onopen = () => {
          setSocket(ws);
          if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
            reconnectTimeoutRef.current = null;
          }
        };
        
        ws.onmessage = (event) => {
          try {
            const message: ProgressMessage = JSON.parse(event.data);
            
            if (message.type === 'progress') {
              setProgressMessage(message.message);
              setProgressValue(message.progress);
            }
          } catch (error) {
            console.error('Error parsing WebSocket message:', error);
          }
        };
        
        ws.onclose = () => {
          setSocket(null);
          
          // Attempt to reconnect after 3 seconds
          if (!reconnectTimeoutRef.current) {
            reconnectTimeoutRef.current = window.setTimeout(() => {
              connectWebSocket();
            }, 3000);
          }
        };
        
        ws.onerror = (error) => {
          console.error('WebSocket error:', error);
        };
        
      } catch (error) {
        console.error('Error creating WebSocket connection:', error);
      }
    };

    connectWebSocket();

    return () => {
      if (socket) {
        socket.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, []);

  // Update current chord based on time
  useEffect(() => {
    if (detectedChords.length > 0 && currentTime >= 0) {
      const activeChord = detectedChords.find(chord => 
        currentTime >= chord.startTime && currentTime < chord.endTime
      );
      setCurrentChord(activeChord ? activeChord.chord : '');
    }
  }, [currentTime, detectedChords]);

  const handleFileSelect = async (file: ProcessedFile) => {
    console.log('File selected:', file);
    // Reset all state when selecting a new file
    setSelectedFile(file);
    onFileSelected?.(file); // Notify parent component
    setDetectedChords([]);
    onChordsDetected?.([]);
    setDetectedBeats([]);
    setCurrentChord('');
    setCurrentTime(0);
    setDuration(0);
    setIsPlaying(false);
    setAudioError(null);
    setApiError(null);
    setIsUsingCachedChords(false);
    setProgressMessage('');
    setProgressValue(0);
    setIsCheckingChords(false);
    setShowAnalysisSuccessPopup(false);
    
    // Reset audio element
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current.load(); // Force reload of the audio element
    }
    
    console.log('Selected file state updated:', file.originalName);
    
    // Check if chords already exist for this file
    await checkExistingChords(file);
  };

  const checkExistingChords = async (file: ProcessedFile) => {
    setIsCheckingChords(true);
    try {
      console.log('🎵 Checking existing chords for:', file.originalName);
      
      // Use the lightweight cache check endpoint
      const response = await fetch(`http://localhost:8000/api/check-chords-cache?file_id=${file.id}&simplicity_preference=${simplicityPreference}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('🎵 Cache check result:', {
          hasChords: data.hasChords,
          cached: data.cached,
          chordsCount: data.chordsCount || 0
        });
        
        if (data.hasChords) {
          // If chords exist in cache, fetch them with the full endpoint
          console.log('🎵 Chords found in cache, fetching full data...');
          const fullResponse = await fetch(`http://localhost:8000/api/detect-chords?file_id=${file.id}&simplicity_preference=${simplicityPreference}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
          });
          
          if (fullResponse.ok) {
            const fullData = await fullResponse.json();
            if (fullData.chords && Array.isArray(fullData.chords) && fullData.chords.length > 0) {
              setDetectedChords(fullData.chords);
              onChordsDetected?.(fullData.chords);
              setDetectedBeats(fullData.beats || []);
              setIsUsingCachedChords(fullData.cached || false);
              
              // Update BPM if detected
              if (fullData.detected_bpm && typeof fullData.detected_bpm === 'number') {
                setBpm(Math.round(fullData.detected_bpm));
              }
              
              // Log beats information
              if (fullData.beats && Array.isArray(fullData.beats) && fullData.beats.length > 0) {
                console.log('🎵 Detected beats:', {
                  count: fullData.beats.length,
                  firstFew: fullData.beats.slice(0, 5).map((b: number) => Math.round(b * 100) / 100),
                  avgInterval: fullData.beats.length > 1 ? 
                    Math.round((fullData.beats[fullData.beats.length - 1] - fullData.beats[0]) / (fullData.beats.length - 1) * 1000) / 1000 
                    : 'N/A'
                });
              }
              
              console.log('🎵 Loaded existing chords for', file.originalName, fullData.cached ? '(from cache)' : '(fresh analysis)');
            }
          }
        } else {
          console.log('🎵 No existing chords found for', file.originalName);
        }
      } else {
        console.log('🎵 Cache check failed (API response not ok)');
      }
    } catch (error) {
      console.log('🎵 Error checking existing chords:', error);
      // Don't show error to user, just means no chords exist
    } finally {
      setIsCheckingChords(false);
    }
  };

  const parseErrorMessage = (error: string): string => {
    if (error.includes('No such file or directory')) {
      return 'Audio file not found. Please check if the file exists.';
    }
    if (error.includes('Connection refused')) {
      return 'Cannot connect to server. Please check if the backend is running.';
    }
    return error;
  };

  // Add debug logging useEffect
  useEffect(() => {
    console.log('🟪 MAIN CONTENT RENDERING:', {
      hasApiError: !!apiError,
      hasDetectedChords: detectedChords.length > 0,
      isAnalyzing,
      isCheckingChords,
      progressMessage,
      timestamp: new Date().toISOString()
    });
  }, [apiError, detectedChords.length, isAnalyzing, isCheckingChords, progressMessage]);

  const analyzeChords = async (isReAnalysis = false) => {
    if (!selectedFile) {
      setApiError('No file selected for analysis');
      return;
    }
    
    console.log('🎵 Analyzing chords:', {
      fileId: selectedFile.id,
      fileName: selectedFile.originalName,
      force: isReAnalysis,
      currentChordsCount: detectedChords.length
    });
    
    setIsAnalyzing(true);
    setApiError(null);
    setProgressMessage('Initializing chord analysis...');
    setProgressValue(0);
    
    try {
      const url = `http://localhost:8000/api/detect-chords?file_id=${selectedFile.id}&simplicity_preference=${simplicityPreference}${isReAnalysis ? '&force=true' : ''}`;
      console.log('🎵 API URL:', url);
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(parseErrorMessage(errorText));
      }
      
      const data = await response.json();
      console.log('🎵 API Response:', {
        chordsCount: data.chords?.length || 0,
        cached: data.cached,
        hasChords: !!data.chords,
        firstFewChords: data.chords?.slice(0, 3).map((c: ChordSection) => c.chord) || []
      });
      
      if (!data.chords || !Array.isArray(data.chords)) {
        throw new Error('Invalid chord data received from server');
      }
      
      // Compare with previous chords to see if they actually changed
      const previousChords = detectedChords.slice(0, 3).map((c: ChordSection) => c.chord);
      const newChords = data.chords.slice(0, 3).map((c: ChordSection) => c.chord);
      console.log('🎵 Chord comparison:', {
        previous: previousChords,
        new: newChords,
        changed: JSON.stringify(previousChords) !== JSON.stringify(newChords)
      });
      
      setDetectedChords(data.chords);
      onChordsDetected?.(data.chords);
      setDetectedBeats(data.beats || []);
      setIsUsingCachedChords(data.cached || false);
      
      // Update BPM if detected
      if (data.detected_bpm && typeof data.detected_bpm === 'number') {
        console.log('🎵 Auto-detected BPM:', data.detected_bpm);
        setBpm(Math.round(data.detected_bpm));
      }
      
      // Log beats information
      if (data.beats && Array.isArray(data.beats) && data.beats.length > 0) {
        console.log('🎵 Detected beats:', {
          count: data.beats.length,
          firstFew: data.beats.slice(0, 5).map((b: number) => Math.round(b * 100) / 100),
          avgInterval: data.beats.length > 1 ? 
            Math.round((data.beats[data.beats.length - 1] - data.beats[0]) / (data.beats.length - 1) * 1000) / 1000 
            : 'N/A'
        });
      }
      
      // Show success message
      const cacheStatus = data.cached ? ' (from cache)' : ' (fresh analysis)';
      const bpmStatus = data.detected_bpm ? ` BPM: ${Math.round(data.detected_bpm)}` : '';
      setProgressMessage(`Analysis complete! Found ${data.chords.length} chord sections${cacheStatus}.${bpmStatus}`);
      setProgressValue(100);
      
      // Show success popup for fresh analysis (not cached)
      if (!data.cached) {
        setShowAnalysisSuccessPopup(true);
        // Auto-hide popup after 8 seconds
        setTimeout(() => {
          setShowAnalysisSuccessPopup(false);
        }, 8000);
      }
      
      // Clear progress after a short delay
      setTimeout(() => {
        setProgressMessage('');
        setProgressValue(0);
      }, 3000); // Increased to 3 seconds to see cache status
      
    } catch (error: any) {
      console.error('Error analyzing chords:', error);
      setApiError(error.message || 'Failed to analyze chords. Please try again.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current && !isNaN(audioRef.current.currentTime)) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  // More frequent time updates for smoother beat visualization
  const updateTimeFrequently = () => {
    if (audioRef.current && !isNaN(audioRef.current.currentTime) && isPlaying) {
      setCurrentTime(audioRef.current.currentTime);
    }
    
    if (isPlaying) {
      animationFrameRef.current = requestAnimationFrame(updateTimeFrequently);
    }
  };

  // Start/stop frequent updates based on play state
  useEffect(() => {
    if (isPlaying) {
      animationFrameRef.current = requestAnimationFrame(updateTimeFrequently);
    } else {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [isPlaying]);

  const handleLoadedMetadata = () => {
    if (audioRef.current && !isNaN(audioRef.current.duration)) {
      setDuration(audioRef.current.duration);
      setAudioError(null); // Clear any previous errors
    }
  };

  const handlePlay = () => {
    setIsPlaying(true);
    setAudioError(null); // Clear errors when playback starts
  };

  const handlePause = () => {
    setIsPlaying(false);
  };

  const handleAudioError = (e: React.SyntheticEvent<HTMLAudioElement, Event>) => {
    const audio = e.currentTarget;
    const error = audio.error;
    
    let errorMessage = 'Audio playback error';
    if (error) {
      switch (error.code) {
        case error.MEDIA_ERR_ABORTED:
          errorMessage = 'Audio playback was aborted';
          break;
        case error.MEDIA_ERR_NETWORK:
          errorMessage = 'Network error occurred while loading audio';
          break;
        case error.MEDIA_ERR_DECODE:
          errorMessage = 'Audio file format is not supported';
          break;
        case error.MEDIA_ERR_SRC_NOT_SUPPORTED:
          errorMessage = 'Audio source not found or not supported';
          break;
        default:
          errorMessage = error.message || 'Unknown audio error';
      }
    }
    
    console.error('Audio error:', errorMessage, error);
    setAudioError(errorMessage);
    setIsPlaying(false);
    setCurrentTime(0);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    if (audioRef.current && !isNaN(time)) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const togglePlayPause = async () => {
    if (!audioRef.current || audioError) return;
    
    try {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        await audioRef.current.play();
      }
    } catch (error) {
      console.error('Audio playback error:', error);
      setAudioError('Failed to play audio. Please try again.');
    }
  };

  const getAudioUrl = (file: ProcessedFile) => {
    if (file.files?.original) {
      return `http://localhost:8000${file.files.original}`;
    }
    
    const encodedDirectory = encodeURIComponent(file.directory);
    const encodedFilename = encodeURIComponent(file.originalName);
    return `http://localhost:8000/audio/${encodedDirectory}/${encodedFilename}`;
  };

  // Custom metadata functions
  const loadCustomMetadata = () => {
    try {
      const saved = localStorage.getItem('audioalchemy-custom-metadata');
      if (saved) {
        setCustomMetadata(JSON.parse(saved));
      }
    } catch (error) {
      console.error('Failed to load custom metadata:', error);
    }
  };

  const saveCustomMetadata = (metadata: CustomMetadata) => {
    try {
      localStorage.setItem('audioalchemy-custom-metadata', JSON.stringify(metadata));
      setCustomMetadata(metadata);
    } catch (error) {
      console.error('Failed to save custom metadata:', error);
    }
  };

  const startEditing = (file: ProcessedFile) => {
    const custom = customMetadata[file.id];
    if (custom) {
      setEditingTitle(custom.title);
      setEditingArtist(custom.artist);
    } else {
      const { artist, title } = parseArtistAndTitle(file.originalName);
      setEditingTitle(title);
      setEditingArtist(artist);
    }
    setEditingFileId(file.id);
  };

  const cancelEditing = () => {
    setEditingFileId(null);
    setEditingTitle('');
    setEditingArtist('');
  };

  const saveEditing = () => {
    if (!editingFileId) return;
    
    const newMetadata = {
      ...customMetadata,
      [editingFileId]: {
        title: editingTitle.trim(),
        artist: editingArtist.trim()
      }
    };
    
    saveCustomMetadata(newMetadata);
    cancelEditing();
  };

  const handleEditKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      saveEditing();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancelEditing();
    }
  };

  const getDisplayMetadata = (file: ProcessedFile) => {
    const custom = customMetadata[file.id];
    if (custom) {
      return { artist: custom.artist, title: custom.title };
    }
    return parseArtistAndTitle(file.originalName);
  };

  // Load custom metadata on component mount
  useEffect(() => {
    loadCustomMetadata();
  }, []);

  // Parse artist and title from filename
  const { artist: artistName, title: songTitle } = selectedFile ? getDisplayMetadata(selectedFile) : { artist: '', title: '' };

  if (isLoading) {
    return (
      <div className="chord-finder-root">
        <div className="chord-finder-loading">
          <div className="loading-spinner" />
          <h3>Loading Music Library</h3>
          <p>Please wait while we load your music files...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="chord-finder-root">
        <div className="chord-finder-error">
          <div className="error-content">
            <h3>Error Loading Library</h3>
            <p>{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`chord-finder-root ${selectedFile ? 'with-lyrics' : ''}`} ref={chordFinderRootRef}>
      {/* Sidebar */}
      <div className="sidebar" ref={sidebarRef}>
        <div className="sidebar-header">
          <h2>
            <MusicalNoteIcon className="header-icon" />
            Music Library
          </h2>
        </div>
        
        <div className="file-list">
          {files.map((file) => {
            const { artist, title } = getDisplayMetadata(file);
            const isEditing = editingFileId === file.id;
            
            return (
              <div
                key={file.id}
                className={`file-item ${selectedFile?.id === file.id ? 'selected' : ''} ${customMetadata[file.id] ? 'has-custom-metadata' : ''}`}
              >
                <div className="file-icon">
                  <FiMusic />
                </div>
                
                {isEditing ? (
                  <div className="file-info editing">
                    <input
                      type="text"
                      value={editingTitle}
                      onChange={(e) => setEditingTitle(e.target.value)}
                      placeholder="Song title"
                      className="edit-input"
                      autoFocus
                      onKeyDown={handleEditKeyDown}
                    />
                    <input
                      type="text"
                      value={editingArtist}
                      onChange={(e) => setEditingArtist(e.target.value)}
                      placeholder="Artist name"
                      className="edit-input"
                      onKeyDown={handleEditKeyDown}
                    />
                  </div>
                ) : (
                  <div 
                    className="file-info"
                    onClick={() => handleFileSelect(file)}
                  >
                    <div className="song-title" title={title}>
                      {title}
                    </div>
                    <div className="song-artist" title={artist}>
                      {artist}
                    </div>
                  </div>
                )}
                
                <div className="file-actions">
                  {isEditing ? (
                    <>
                      <button
                        className="action-button save-button"
                        onClick={saveEditing}
                        title="Save changes"
                      >
                        <CheckIcon />
                      </button>
                      <button
                        className="action-button cancel-button"
                        onClick={cancelEditing}
                        title="Cancel editing"
                      >
                        <XMarkIcon />
                      </button>
                    </>
                  ) : (
                    <button
                      className="action-button edit-button"
                      onClick={(e) => {
                        e.stopPropagation();
                        startEditing(file);
                      }}
                      title="Edit song title and artist"
                    >
                      <FiEdit2 />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Content */}
      <div className="main-content">
        {!selectedFile ? (
          <div className="empty-state">
            <MusicalNoteIcon className="empty-state-icon" />
            <h3>Choose a Song</h3>
            <p>Select a song from the library to start analyzing chords and viewing lyrics</p>
          </div>
        ) : (
          <>
            {/* Song Header */}
            <div className="song-header">
              <div className="song-info-centered">
                <h1 className="song-title">
                  {removeFileExtension(songTitle)}
                </h1>
                <p className="song-artist">{artistName}</p>
              </div>
              
              {/* Audio Controls */}
              <div className="audio-controls">
                <button
                  className="play-button"
                  onClick={togglePlayPause}
                  disabled={!selectedFile || !!audioError}
                  aria-label={isPlaying ? 'Pause' : 'Play'}
                >
                  {isPlaying ? (
                    <PauseIcon />
                  ) : (
                    <PlayIcon />
                  )}
                </button>
                
                <div className="time-display">
                  {formatTime(currentTime)} / {formatTime(duration)}
                </div>
                
                <input
                  type="range"
                  className="audio-slider"
                  min="0"
                  max={duration || 0}
                  value={currentTime}
                  onChange={handleSeek}
                  disabled={!selectedFile || !!audioError}
                />
              </div>
              
              {/* Re-analysis Controls */}
              <div className="reanalysis-controls">
                <button
                  className="reanalyze-button"
                  onClick={() => analyzeChords(true)}
                  disabled={isAnalyzing || isCheckingChords || !selectedFile}
                  title="Re-analyze chords with current settings"
                >
                  {isAnalyzing ? (
                    <div className="button-spinner"></div>
                  ) : (
                    <svg className="reanalyze-icon" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
                    </svg>
                  )}
                  Re-analyze
                </button>
                
                <div className="simplicity-control">
                  <label htmlFor="simplicity-slider">Simplicity</label>
                  <input
                    id="simplicity-slider"
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={simplicityPreference}
                    onChange={(e) => setSimplicityPreference(parseFloat(e.target.value))}
                    className="simplicity-slider"
                  />
                  <span className="simplicity-value">{(simplicityPreference * 100).toFixed(0)}%</span>
                </div>
              </div>
            </div>

            {/* Lyrics Content */}
            <div className="lyrics-content">
              {apiError && (
                <div className="error-message">
                  {apiError}
                </div>
              )}
              
              {/* Chord Progression Display */}
              {detectedChords.length > 0 ? (
                <>
                  <ChordProgressionBar
                    detectedChords={detectedChords}
                    detectedBeats={detectedBeats}
                    currentTime={currentTime}
                    duration={duration}
                    isPlaying={isPlaying}
                    bpm={bpm}
                    simplicityPreference={simplicityPreference}
                    setSimplicityPreference={setSimplicityPreference}
                    setBpm={setBpm}
                    onAnalyze={() => analyzeChords(detectedChords.length > 0)}
                    isAnalyzing={isAnalyzing}
                    isCheckingChords={isCheckingChords}
                    selectedFile={selectedFile}
                  />
                  
                  {/* Chord Summary Section */}
                  <div className="chord-summary-section">
                    <div className="chord-summary-header">
                      <h3>All Song Chords</h3>
                      <div className="chord-count">
                        {(() => {
                          const uniqueChords = Array.from(new Set(detectedChords.map(chord => chord.chord).filter(chord => chord !== 'N/C' && chord !== '—')));
                          return `${uniqueChords.length} unique chords`;
                        })()}
                      </div>
                    </div>
                    
                    <div className="chord-summary-grid">
                      {(() => {
                        // Get unique chords and their first occurrence time
                        const uniqueChordsMap = new Map();
                        detectedChords.forEach(chord => {
                          if (chord.chord !== 'N/C' && chord.chord !== '—') {
                            if (!uniqueChordsMap.has(chord.chord)) {
                              uniqueChordsMap.set(chord.chord, {
                                chord: chord.chord,
                                firstTime: chord.startTime,
                                occurrences: 1
                              });
                            } else {
                              const existing = uniqueChordsMap.get(chord.chord);
                              existing.occurrences += 1;
                            }
                          }
                        });
                        
                        // Convert to array and sort by first occurrence
                        const sortedChords = Array.from(uniqueChordsMap.values())
                          .sort((a, b) => a.firstTime - b.firstTime);
                        
                        return sortedChords.map((chordInfo, index) => (
                          <div 
                            key={`${chordInfo.chord}-${index}`} 
                            className={`chord-summary-item ${currentChord === chordInfo.chord ? 'active' : ''}`}
                          >
                            <div className="chord-name">
                              {(() => {
                                // Format chord name for display (same logic as ChordProgressionBar)
                                let formatted = chordInfo.chord;
                                if (formatted.includes(':')) {
                                  const [root, quality] = formatted.split(':');
                                  switch (quality) {
                                    case 'min': formatted = `${root}m`; break;
                                    case 'maj': formatted = root; break;
                                    case 'dim': formatted = `${root}dim`; break;
                                    case 'aug': formatted = `${root}aug`; break;
                                    case '7': formatted = `${root}7`; break;
                                    case 'maj7': formatted = `${root}maj7`; break;
                                    case 'min7': formatted = `${root}m7`; break;
                                    default: formatted = `${root}${quality}`;
                                  }
                                }
                                return formatted.replace(/A#/g, 'Bb');
                              })()}
                            </div>
                            <div className="chord-occurrences">
                              {chordInfo.occurrences} time{chordInfo.occurrences !== 1 ? 's' : ''}
                            </div>
                          </div>
                        ));
                      })()}
                    </div>
                  </div>
                </>
              ) : isAnalyzing ? (
                <div className="analyzing-status">
                  <div className="loading-spinner"></div>
                  <h3>Analyzing Chords with Advanced Engine</h3>
                  <p>Using BTC-ISMIR19 + autochord for accurate chord detection...</p>
                  {progressMessage && (
                    <div className="progress-container">
                      <div className="progress-bar">
                        <div 
                          className="progress-fill" 
                          style={{ width: `${progressValue}%` }}
                        />
                      </div>
                      <div className="progress-text">
                        <div className="stage-message">{progressMessage}</div>
                        <div className="progress-percentage">{Math.round(progressValue)}%</div>
                      </div>
                    </div>
                  )}
                </div>
              ) : isCheckingChords ? (
                <div className="analyzing-status">
                  <div className="loading-spinner"></div>
                  <h3>Checking for Existing Chords</h3>
                  <p>Looking for previously analyzed chord data...</p>
                </div>
              ) : (
                <div className="no-chords-state">
                  <div className="analyze-prompt">
                    <div className="analyze-prompt-content">
                      <h3>Ready to Analyze Chords</h3>
                      <p>This song hasn't been analyzed yet. Use the "Re-analyze" button above to detect chords and view the progression.</p>
                      <div className="arrow-up">↑</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
        
        {/* Analysis Success Popup */}
        {showAnalysisSuccessPopup && (
          <div className="analysis-success-popup-overlay" onClick={() => setShowAnalysisSuccessPopup(false)}>
            <div className="analysis-success-popup" onClick={(e) => e.stopPropagation()}>
              <div className="popup-header">
                <FiMusic size={48} className="popup-icon" />
                <button 
                  className="popup-close"
                  onClick={() => setShowAnalysisSuccessPopup(false)}
                  aria-label="Close popup"
                >
                  ×
                </button>
              </div>
              <h3>Chords Detected Successfully!</h3>
              <p className="popup-stats">🎵 {detectedChords.length} chord sections analyzed</p>
              <p className="popup-description">
                Switch to the <strong>Lyrics</strong> tab to view synchronized lyrics with chord annotations using our advanced DTW alignment algorithm.
              </p>
              <div className="popup-arrow">
                👆 Click "Lyrics" in the navigation above
              </div>
              <button 
                className="popup-got-it"
                onClick={() => setShowAnalysisSuccessPopup(false)}
              >
                Got it!
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Audio Element */}
      {selectedFile && selectedFile.files?.original && (
        <audio
          ref={audioRef}
          src={`http://localhost:8000${selectedFile.files.original}`}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onPlay={handlePlay}
          onPause={handlePause}
          onError={handleAudioError}
          preload="metadata"
        />
      )}
    </div>
  );
}

export default ChordFinder;