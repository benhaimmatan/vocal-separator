import { useState, useEffect, useRef } from 'react'
import { useDropzone } from 'react-dropzone'
import AudioPlayer from './components/AudioPlayer'
import Library from './components/Library'
import ChordFinder from './ChordFinder'
import LyricsTab from './components/LyricsTab'
import LiveAudioCapture from './components/LiveAudioCapture'
import type { ProcessedFile, LibraryState, OutputOptions } from './types'
import './App.css'
import { FiMusic, FiMic, FiArchive, FiUpload, FiSettings, FiList, FiCheck, FiGrid } from 'react-icons/fi'
import PianoIcon from './components/PianoIcon'
import { FaPause, FaPlay, FaYoutube } from 'react-icons/fa'
import { IconType } from 'react-icons'
import logo from './assets/logo.svg'
import YouTubeDownloader from './components/YouTubeDownloader'

interface AudioFiles {
  original: string | null;
  vocals: string | null;
  accompaniment: string | null;
  piano?: string | null;
  midi?: string;
}

function App() {
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [progress, setProgress] = useState<number>(0);
  const [progressMessage, setProgressMessage] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const ws = useRef<WebSocket | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [processingMessage, setProcessingMessage] = useState('');
  const [processingResult, setProcessingResult] = useState<any>(null);
  const [currentView, setCurrentView] = useState<'separator' | 'library' | 'chordFinder' | 'lyrics' | 'liveCapture'>('separator');
  const [libraryState, setLibraryState] = useState<LibraryState>({
    files: [],
    selectedFile: null,
    isLoading: false,
    error: null
  });
  const [outputOptions, setOutputOptions] = useState<OutputOptions>({
    vocals: true,
    accompaniment: false
  });
  const [audioFiles, setAudioFiles] = useState<AudioFiles>({
    original: null,
    vocals: null,
    accompaniment: null
  });
  const [playerUrls, setPlayerUrls] = useState<AudioFiles>({
    original: null,
    vocals: null,
    accompaniment: null
  });
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [detectedChords, setDetectedChords] = useState<any[]>([]);
  const [chordFinderSelectedFile, setChordFinderSelectedFile] = useState<any>(null);

  useEffect(() => {
    const connect = () => {
      ws.current = new WebSocket('ws://localhost:8000/ws');

      ws.current.onopen = () => {
        console.log('Connected to WebSocket');
        setIsConnected(true);
        setError(null);
      };

      ws.current.onclose = () => {
        console.log('WebSocket disconnected');
        setIsConnected(false);
        // Try to reconnect in 2 seconds
        setTimeout(connect, 2000);
      };

      ws.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('Received:', data);

          if (data.progress !== undefined) {
            setProgress(data.progress);
            if (data.progress === 100) {
              setIsComplete(true);
              setIsProcessing(false);
              setStatus('Complete!');
            }
          }
          
          if (data.message) {
            setProgressMessage(data.message);
            
            // If it's a final message, also set it as the completion message
            if (data.progress === 100) {
              setMessage(data.message);
            }
          }
        } catch (e) {
          console.error('Error parsing message:', e);
        }
      };
    };

    connect();

    return () => {
      if (ws.current) {
        ws.current.close();
      }
    };
  }, []);

  useEffect(() => {
    console.log('Current view:', currentView); // Debug log
    if (currentView === 'library' || currentView === 'chordFinder') {
      fetchLibrary();
    }
  }, [currentView]);

  const fetchLibrary = async () => {
    console.log('Fetching library...'); // Debug log
    setLibraryState(prev => ({ ...prev, isLoading: true }));
    try {
      const response = await fetch('http://localhost:8000/api/library');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      console.log('Library data received:', data); // Debug log
      
      if (!data.files) {
        console.error('No files array in response:', data);
        throw new Error('Invalid response format');
      }
      
      setLibraryState(prev => ({
        ...prev,
        files: data.files,
        isLoading: false
      }));
    } catch (error) {
      console.error('Error fetching library:', error);
      setLibraryState(prev => ({
        ...prev,
        error: 'Failed to load library',
        isLoading: false
      }));
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
      setError(null);
      setMessage(null);
    }
  };

  const handleDrop = async (acceptedFiles: File[]) => {
    if (!isConnected) {
      setError('Not connected to server. Please wait...');
      return;
    }

    const file = acceptedFiles[0];
    setSelectedFile(file);
    setError(null);
    setMessage(null);
  };

  const handleStartProcessing = async () => {
    if (!selectedFile) {
      setError('Please select a file first');
      return;
    }

    if (!outputOptions.vocals && !outputOptions.accompaniment) {
      setError('Please select at least one output option (Vocals or Accompaniment)');
      return;
    }

    setStatus('Processing...');
    setError(null);
    setProgress(0);
    setProgressMessage('Starting...');
    setIsProcessing(true);
    setIsComplete(false);
    setMessage(null);
    
    const formData = new FormData();
    formData.append('audio_file', selectedFile);
    formData.append('output_options', JSON.stringify(outputOptions));
    
    try {
      const response = await fetch('http://localhost:8000/api/separate', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error('Processing failed');
      }

      const result = await response.json();
      console.log('Server response:', result);
      
      const baseUrl = 'http://localhost:8000';
      setAudioFiles({
        original: result.original ? `${baseUrl}${result.original}` : null,
        vocals: result.vocals ? `${baseUrl}${result.vocals}` : null,
        accompaniment: result.accompaniment ? `${baseUrl}${result.accompaniment}` : null,
        piano: result.piano ? `${baseUrl}${result.piano}` : undefined
      });
      
      if (result.id) {
        setLibraryState(prev => ({
          ...prev,
          files: [{
            id: result.id,
            originalName: selectedFile?.name || 'Unknown',
            dateProcessed: new Date().toISOString(),
            directory: result.directory || '',
            files: {
              original: result.original,
              vocals: result.vocals,
              accompaniment: result.accompaniment,
              piano: result.piano
            }
          }, ...prev.files]
        }));
      }
      
      setIsComplete(true);
      setStatus('Complete!');
    } catch (err) {
      console.error('Error:', err);
      setError('An error occurred during processing');
      setStatus(null);
      setMessage(null);
      setIsProcessing(false);
    }
  };

  const handleReset = () => {
    setStatus(null);
    setError(null);
    setMessage(null);
    setProgress(0);
    setProgressMessage('');
    setIsProcessing(false);
    setIsComplete(false);
    setSelectedFile(null);
    setOutputOptions({
      vocals: true,
      accompaniment: false
    });
    setAudioFiles({
      original: null,
      vocals: null,
      accompaniment: null
    });
  };

  const handleOutputOptionChange = (option: 'vocals' | 'accompaniment') => {
    setOutputOptions(prev => ({
      ...prev,
      [option]: !prev[option]
    }));
  };

  // We don't use the dropzone properties directly since we implemented custom handlers
  useDropzone({
    onDrop: handleDrop,
    accept: {
      'audio/*': ['.mp3', '.wav', '.m4a', '.aac']
    },
    multiple: false
  });

  const handleDeleteFile = async (fileId: string) => {
    try {
      const response = await fetch(`http://localhost:8000/api/library/${fileId}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete file');
      }
      
      // Update library state
      setLibraryState(prev => ({
        ...prev,
        files: prev.files.filter(file => file.id !== fileId),
        selectedFile: prev.selectedFile?.id === fileId ? null : prev.selectedFile
      }));
      
      // Clear audio files if the deleted file was selected
      if (libraryState.selectedFile?.id === fileId) {
        setAudioFiles({
          original: null,
          vocals: null,
          accompaniment: null
        });
      }
    } catch (error) {
      console.error('Error deleting file:', error);
      setLibraryState(prev => ({
        ...prev,
        error: 'Failed to delete file'
      }));
    }
  };

  const handleLibraryFileSelect = (file: ProcessedFile) => {
    // If the clicked file is already selected, deselect it
    if (libraryState.selectedFile?.id === file.id) {
      setLibraryState(prev => ({ ...prev, selectedFile: null }));
      setAudioFiles({
        original: null,
        vocals: null,
        accompaniment: null
      }); // Clear the audio players
    } else {
      // Otherwise, select the new file
      console.log('Selected library file:', file); // Debug log to see the structure
      setLibraryState(prev => ({ ...prev, selectedFile: file }));
      
      // Create audioFiles object with all possible file types from the ProcessedFile
      const baseUrl = 'http://localhost:8000';
      const fileUrls: AudioFiles = {
        original: null,
        vocals: null,
        accompaniment: null
      };
      
      // Debug file properties
      console.log('File URLs being generated:', {
        original: file.files.original ? `${baseUrl}${file.files.original}` : null,
        vocals: file.files.vocals ? `${baseUrl}${file.files.vocals}` : null,
        accompaniment: file.files.accompaniment ? `${baseUrl}${file.files.accompaniment}` : null
      });
      
      // Check and add each property only if it exists
      if (file.files.original) {
        fileUrls.original = `${baseUrl}${file.files.original}`;
      }
      
      if (file.files.vocals) {
        fileUrls.vocals = `${baseUrl}${file.files.vocals}`;
      }
      
      if (file.files.accompaniment) {
        fileUrls.accompaniment = `${baseUrl}${file.files.accompaniment}`;
      }
      
      // Add piano and midi if they exist
      if ('piano' in file.files && file.files.piano) {
        fileUrls.piano = `${baseUrl}${file.files.piano}`;
      }
      
      if ('midi' in file.files && file.files.midi) {
        fileUrls.midi = `${baseUrl}${file.files.midi}`;
      }
      
      console.log('Setting audio files to:', fileUrls);
      setAudioFiles(fileUrls);
    }
  };

  const TrackDisplay = ({ file, type, icon: Icon, label }: { file: string | null, type: string, icon: IconType, label: string }) => {
    if (!file) return null;
    
    const audioRef = useRef<HTMLAudioElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    
    const togglePlay = () => {
      if (audioRef.current) {
        if (isPlaying) {
          audioRef.current.pause();
        } else {
          audioRef.current.play();
        }
        setIsPlaying(!isPlaying);
      }
    };

    return (
      <div className="track-item">
        <div className="track-info">
          <div className="track-icon">
            <Icon />
          </div>
          <div className="track-label">{label}</div>
        </div>
        <div className="track-controls">
          <button onClick={togglePlay} className="play-button">
            {isPlaying ? <FaPause /> : <FaPlay />}
          </button>
          <audio ref={audioRef} src={file} onEnded={() => setIsPlaying(false)} />
        </div>
      </div>
    );
  };

  const handleYouTubeDownloadComplete = (result: any) => {
    console.log('YouTube download complete:', result);
    
    // Update audio files for playback
    const baseUrl = 'http://localhost:8000';
    setAudioFiles({
      original: result.original ? `${baseUrl}${result.original}` : null,
      vocals: result.vocals ? `${baseUrl}${result.vocals}` : null,
      accompaniment: result.accompaniment ? `${baseUrl}${result.accompaniment}` : null
    });
    
    // Update library
    if (result && result.id) {
      setLibraryState(prev => {
        // Extract the filename from the path
        const originalPath = result.original || '';
        const pathParts = originalPath.split('/');
        const fileName = pathParts[pathParts.length - 1] || 'YouTube Video';
        const directory = pathParts.length > 2 ? pathParts[2] : '';
        
        // Ensure the original file is always set
        if (!result.original && result.title) {
          console.warn('Original file path missing but title exists - this should not happen');
        }
        
        // Create the new file entry with explicit original file
        const files = {
          original: result.original || null,
          vocals: result.vocals || null,
          accompaniment: result.accompaniment || null
        };
        
        console.log('Creating new file entry with:', {
          id: result.id,
          name: fileName,
          files: files
        });
        
        const newFile: ProcessedFile = {
          id: result.id,
          originalName: fileName,
          dateProcessed: new Date().toISOString(),
          directory: directory,
          files: files
        };
        
        // Add to library
        return {
          ...prev,
          files: [...prev.files, newFile]
        };
      });
    }
  };

  const handleYoutubeUrlSubmit = async (e: React.MouseEvent) => {
    e.preventDefault();
    
    if (!youtubeUrl) {
      setError('Please enter a YouTube URL');
      return;
    }
    
    if (!outputOptions.vocals && !outputOptions.accompaniment) {
      setError('Please select at least one output option (Vocals or Accompaniment)');
      return;
    }
    
    setStatus('Processing...');
    setError(null);
    setProgress(0);
    setProgressMessage('Starting YouTube download process...');
    setIsProcessing(true);
    setIsComplete(false);
    setMessage(null);
    
    try {
      // Create form data for the API request
      const formData = new FormData();
      formData.append('url', youtubeUrl);
      formData.append('output_options', JSON.stringify(outputOptions));
      
      // Show the downloading status immediately to improve UX
      setProgressMessage('Starting download process... Please wait while we prepare your file.');
      
      const response = await fetch('http://localhost:8000/api/download-youtube', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to download from YouTube');
      }
      
      const result = await response.json();
      handleYouTubeDownloadComplete(result);
      setYoutubeUrl('');
      setIsComplete(true);
      setStatus('Complete!');
      setMessage('Your YouTube video has been processed successfully. You can find it in the Library tab.');
    } catch (err) {
      console.error('Error:', err);
      setError(err instanceof Error ? err.message : 'An error occurred during processing');
      setStatus(null);
      setMessage(null);
      setIsProcessing(false);
    }
  };

  // Add formatFileSize utility function
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Modify YouTubeDownloader component to make it more visually integrated
  const enhancedYouTubeDownloader = (
    <div className="upload-section">
      <h2 className="section-title">Or Download from YouTube</h2>
      <div className="youtube-section">
        <YouTubeDownloader 
          onDownloadComplete={handleYouTubeDownloadComplete}
          outputOptions={outputOptions}
          disabled={isProcessing}
        />
      </div>
      <div className="separator-info">
        <div className="info-icon">ℹ️</div>
        <p className="info-text">Use the same separation options above for both uploaded files and YouTube downloads.</p>
      </div>
    </div>
  );

  // Update the YouTube input area with a clearer explanation about the library
  const YoutubeInputArea = () => (
    <div className="youtube-input-container">
      <input
        type="text"
        placeholder="Paste YouTube URL here"
        value={youtubeUrl}
        onChange={(e) => setYoutubeUrl(e.target.value)}
        className="youtube-url-input"
      />
      <button 
        className="youtube-download-btn"
        onClick={handleYoutubeUrlSubmit}
        disabled={!youtubeUrl || isProcessing}
      >
        <FaYoutube size={18} />
        Download
      </button>
    </div>
  );

  // Also enhance the progress container to show more detailed info
  const ProgressContainer = () => (
    <>
      <div className="progress-overlay"></div>
      <div className="progress-container">
        <div className="progress-bar-modern">
          <div 
            className="progress-fill" 
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="progress-text">{progressMessage}</p>
        
        {/* Add a note about library availability if processing */}
        {isProcessing && progress < 100 && progress > 5 && (
          <p className="progress-note">
            Note: Files will appear in your library after processing is complete
          </p>
        )}
      </div>
    </>
  );

  // Add cleanup when switching tabs
  useEffect(() => {
    // Stop all audio when switching tabs
    if ((window as any).stopAllAudio) {
      (window as any).stopAllAudio();
    }
  }, [currentView]);

  return (
    <div className="app-layout">
      <nav className="side-nav">
        <div className="brand">
          <div className="brand-logo">
            <img src={logo} alt="AudioAlchemy" className="nav-logo" />
          </div>
        </div>
        
        <div className="nav-links">
          <button 
            className={`nav-item ${currentView === 'separator' ? 'active' : ''}`}
            onClick={() => setCurrentView('separator')}
          >
            <FiUpload size={20} />
            <span>Separator</span>
          </button>
          
          <button 
            className={`nav-item ${currentView === 'library' ? 'active' : ''}`}
            onClick={() => setCurrentView('library')}
          >
            <FiArchive size={20} />
            <span>Library</span>
          </button>
          
          <button 
            className={`nav-item ${currentView === 'chordFinder' ? 'active' : ''}`}
            onClick={() => setCurrentView('chordFinder')}
          >
            <FiGrid size={20} />
            <span>Chord Finder</span>
          </button>
          
          <button 
            className={`nav-item ${currentView === 'lyrics' ? 'active' : ''}`}
            onClick={() => setCurrentView('lyrics')}
          >
            <FiMusic size={20} />
            <span>Lyrics</span>
          </button>
          
          <button 
            className={`nav-item ${currentView === 'liveCapture' ? 'active' : ''}`}
            onClick={() => setCurrentView('liveCapture')}
          >
            <FiMic size={20} />
            <span>Live Capture</span>
          </button>
        </div>
      </nav>

      <main className="main-content">
        {currentView === 'separator' ? (
          <div className="separator-view">
            <div className="separator-header">
              <img src={logo} alt="AudioAlchemy" className="app-logo" />
              <h1>AudioAlchemy</h1>
              <p className="subtitle">Transform your music with the magic of AI - Separate vocals, instruments, and more</p>
            </div>

            <div className="separator-container">
              <div className="file-upload-container">
                {!selectedFile ? (
                  <>
                    <div 
                      className="unified-media-input"
                      onDragOver={handleDragOver} 
                      onDragLeave={handleDragLeave} 
                      onDrop={(e) => {
                        e.preventDefault();
                        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                          handleDrop([e.dataTransfer.files[0]]);
                        }
                        setIsDragging(false);
                      }}
                      style={{ 
                        borderColor: isDragging ? '#3b82f6' : 'rgba(255, 255, 255, 0.1)',
                        backgroundColor: isDragging ? 'rgba(59, 130, 246, 0.1)' : 'rgba(255, 255, 255, 0.03)'
                      }}
                    >
                      <div className="upload-icon">
                        <FiUpload size={48} color="#3b82f6" />
                      </div>
                      <div className="upload-text">
                        <p className="upload-title">Add your audio</p>
                        <p className="upload-subtitle">Drag & drop, browse, or paste YouTube URL</p>
                      </div>

                      <div className="input-options" style={{ marginTop: '20px', width: '100%', maxWidth: '580px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        <div style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
                          <label className="file-input-label" style={{ width: '100%', maxWidth: '280px' }}>
                            <FiUpload size={20} />
                            <span>Browse Files</span>
                            <input 
                              type="file" 
                              className="file-input" 
                              onChange={handleFileChange} 
                              accept="audio/*"
                              style={{ display: 'none' }}
                            />
                          </label>
                        </div>
                        
                        <div style={{ width: '100%' }}>
                          <YoutubeInputArea />
                        </div>
                      </div>
                    </div>
                    
                    <div className="output-options">
                      <div className="output-title">
                        <FiSettings size={18} />
                        Output Options
                      </div>
                      <div className="checkbox-row">
                        <label className="checkbox-container">
                          <input 
                            type="checkbox" 
                            checked={outputOptions.vocals} 
                            onChange={() => setOutputOptions({...outputOptions, vocals: !outputOptions.vocals})}
                            className="checkbox-input"
                          />
                          <div className="custom-checkbox">
                            {outputOptions.vocals && <FiCheck className="checkbox-icon" />}
                          </div>
                          <span><FiMic className="option-icon" /> Vocals</span>
                        </label>
                        
                        <label className="checkbox-container">
                          <input 
                            type="checkbox" 
                            checked={outputOptions.accompaniment} 
                            onChange={() => setOutputOptions({...outputOptions, accompaniment: !outputOptions.accompaniment})}
                            className="checkbox-input"
                          />
                          <div className="custom-checkbox">
                            {outputOptions.accompaniment && <FiCheck className="checkbox-icon" />}
                          </div>
                          <span><FiMusic className="option-icon" /> Accompaniment</span>
                        </label>
                      </div>
                    </div>
                  </>
                ) : (
                  // Selected file view - remains unchanged
                  <div className="selected-file-container">
                    <div className="selected-file-info">
                      <div className="file-icon">
                        <FiMusic size={32} />
                      </div>
                      <div className="file-details">
                        <div className="file-name">{selectedFile.name}</div>
                        <div className="file-size">{formatFileSize(selectedFile.size)}</div>
                      </div>
                      <button 
                        className="remove-file-button"
                        onClick={handleReset}
                      >
                        Remove
                      </button>
                    </div>
                    
                    <div className="output-options">
                      <div className="output-title">
                        <FiSettings size={18} />
                        Output Options
                      </div>
                      <div className="checkbox-row">
                        <label className="checkbox-container">
                          <input 
                            type="checkbox" 
                            checked={outputOptions.vocals} 
                            onChange={() => setOutputOptions({...outputOptions, vocals: !outputOptions.vocals})}
                            className="checkbox-input"
                          />
                          <div className="custom-checkbox">
                            {outputOptions.vocals && <FiCheck className="checkbox-icon" />}
                          </div>
                          <span><FiMic className="option-icon" /> Vocals</span>
                        </label>
                        
                        <label className="checkbox-container">
                          <input 
                            type="checkbox" 
                            checked={outputOptions.accompaniment} 
                            onChange={() => setOutputOptions({...outputOptions, accompaniment: !outputOptions.accompaniment})}
                            className="checkbox-input"
                          />
                          <div className="custom-checkbox">
                            {outputOptions.accompaniment && <FiCheck className="checkbox-icon" />}
                          </div>
                          <span><FiMusic className="option-icon" /> Accompaniment</span>
                        </label>
                      </div>
                    </div>
                    
                    <button
                      className="process-button-modern"
                      onClick={handleStartProcessing}
                      disabled={isProcessing || !isConnected}
                    >
                      {isProcessing ? 'Processing...' : 'Start Processing'}
                    </button>
                  </div>
                )}
              </div>

              {/* Show progress container when processing YouTube downloads or file uploads */}
              {(isProcessing || (progress > 0 && progress < 100)) && (
                <ProgressContainer />
              )}

              {error && <div className="error-message">{error}</div>}
              {message && <div className="success-message">{message}</div>}

              {/* The Processed Tracks section is now hidden with CSS */}
            </div>
          </div>
        ) : currentView === 'library' ? (
          <div className="separator-view library-view">
            <Library
              files={libraryState.files}
              onFileSelect={handleLibraryFileSelect}
              onDelete={handleDeleteFile}
              selectedFile={libraryState.selectedFile}
              isLoading={libraryState.isLoading}
              error={libraryState.error}
            />
          </div>
        ) : currentView === 'chordFinder' ? (
          <div className="separator-view chord-finder-view">
            <ChordFinder 
              onChordsDetected={setDetectedChords}
              onFileSelected={setChordFinderSelectedFile}
            />
          </div>
        ) : currentView === 'lyrics' ? (
          <div className="separator-view lyrics-view">
            <LyricsTab 
              selectedFile={chordFinderSelectedFile}
              detectedChords={detectedChords}
            />
          </div>
        ) : (
          <div className="separator-view live-capture-view">
            <LiveAudioCapture 
              onChordsDetected={setDetectedChords}
              onRecordingSaved={fetchLibrary}
            />
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
