import React, { useState, useEffect, useRef } from 'react';
import { FiMic, FiMicOff, FiPlay, FiPause, FiSettings, FiHelpCircle } from 'react-icons/fi';
import SystemAudioGuide from './SystemAudioGuide';
import './LiveAudioCapture.css';

interface ChordSection {
  startTime: number;
  endTime: number;
  chord: string;
}

interface LiveAudioCaptureProps {
  onChordsDetected?: (chords: ChordSection[]) => void;
  onRecordingSaved?: () => void;
}

const LiveAudioCapture: React.FC<LiveAudioCaptureProps> = ({ onChordsDetected, onRecordingSaved }) => {
  const [isCapturing, setIsCapturing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [detectedChords, setDetectedChords] = useState<ChordSection[]>([]);
  const [currentChord, setCurrentChord] = useState<string>('');
  const [audioLevel, setAudioLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [captureLength, setCaptureLength] = useState(30); // seconds
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showSetupGuide, setShowSetupGuide] = useState(false);
  const [showTips, setShowTips] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const animationFrameRef = useRef<number | null>(null);
  const recordingStartTimeRef = useRef<number>(0);
  const isCapturingRef = useRef<boolean>(false);

  // Initialize audio context and analyzer
  const initializeAudio = async () => {
    try {
      // Request microphone access for audio capture
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          sampleRate: 44100
        }
      });

      streamRef.current = stream;

      // Create audio context for real-time analysis
      audioContextRef.current = new AudioContext({ sampleRate: 44100 });
      const source = audioContextRef.current.createMediaStreamSource(stream);
      
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 2048;
      source.connect(analyserRef.current);
      
      console.log('Audio context initialized:', {
        sampleRate: audioContextRef.current.sampleRate,
        fftSize: analyserRef.current.fftSize,
        streamTracks: stream.getTracks().length
      });

      // Set up MediaRecorder for recording
      mediaRecorderRef.current = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus',
        audioBitsPerSecond: 128000
      });

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current.onstop = () => {
        handleRecordingComplete();
      };

      setIsCapturing(true);
      isCapturingRef.current = true; // Set ref immediately
      setError(null);
      
      // Resume audio context if it's suspended (required by some browsers)
      if (audioContextRef.current.state === 'suspended') {
        console.log('Resuming suspended audio context...');
        await audioContextRef.current.resume();
      }
      
      console.log('Audio context state:', audioContextRef.current.state);
      startAudioLevelMonitoring();

    } catch (err) {
      console.error('Error accessing microphone:', err);
      setError('Failed to access microphone. Please grant microphone permission to capture audio.');
    }
  };

  // Start monitoring audio levels
  const startAudioLevelMonitoring = () => {
    if (!analyserRef.current) {
      console.log('No analyser available for monitoring');
      return;
    }

    const bufferLength = analyserRef.current.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    console.log('Starting audio monitoring with buffer length:', bufferLength);

    const updateAudioLevel = () => {
      if (!analyserRef.current) {
        console.log('Analyser lost, stopping monitoring');
        return;
      }
      
      analyserRef.current.getByteTimeDomainData(dataArray);
      
      // Calculate RMS (Root Mean Square) for audio level
      let sum = 0;
      for (let i = 0; i < bufferLength; i++) {
        const sample = (dataArray[i] - 128) / 128; // Convert to -1 to 1 range
        sum += sample * sample;
      }
      const rms = Math.sqrt(sum / bufferLength);
      const level = Math.min(Math.max(rms, 0), 1);
      
      setAudioLevel(level);
      
      // Debug logging - log every few iterations to see if it's running
      if (Math.random() < 0.02) { // 2% chance to log
        console.log('Audio monitoring active, current level:', level, 'first few samples:', Array.from(dataArray.slice(0, 5)));
      }
      
      // Log when we detect audio
      if (level > 0.01) {
        console.log('Audio level detected:', level);
      }
      
      // Always continue the loop while capturing
      if (isCapturingRef.current) {
        animationFrameRef.current = requestAnimationFrame(updateAudioLevel);
      } else {
        console.log('Stopping audio monitoring - not capturing');
      }
    };

    // Start the monitoring loop
    updateAudioLevel();
  };

  // Start recording
  const startRecording = () => {
    if (!mediaRecorderRef.current) return;

    recordedChunksRef.current = [];
    recordingStartTimeRef.current = Date.now();
    
    mediaRecorderRef.current.start(100); // Capture in 100ms chunks
    setIsRecording(true);
    setDetectedChords([]);
    setCurrentChord('');
    setAnalysisProgress(0);

    // Auto-stop recording after specified length
    setTimeout(() => {
      if (mediaRecorderRef.current && isRecording) {
        stopRecording();
      }
    }, captureLength * 1000);
  };

  // Stop recording
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  // Handle completed recording
  const handleRecordingComplete = async () => {
    console.log('🎵 Recording completed, chunks:', recordedChunksRef.current.length);
    
    if (recordedChunksRef.current.length === 0) {
      console.log('❌ No recorded chunks available');
      setError('No audio data recorded. Please try again.');
      return;
    }

    setIsAnalyzing(true);
    setAnalysisProgress(0);
    setError(null); // Clear any previous errors
    console.log('🎵 Starting analysis...');

    try {
      // Create blob from recorded chunks
      const recordedBlob = new Blob(recordedChunksRef.current, { type: 'audio/webm' });
      console.log('🎵 Created blob, size:', recordedBlob.size, 'bytes');
      
      // Debug: Create a temporary URL to test the audio
      const audioUrl = URL.createObjectURL(recordedBlob);
      console.log('🎵 Audio blob URL for testing:', audioUrl);
      
      // Create a temporary audio element to test if the recording is valid
      const testAudio = new Audio(audioUrl);
      testAudio.addEventListener('loadedmetadata', () => {
        console.log('🎵 Audio metadata loaded - Duration:', testAudio.duration, 'seconds');
      });
      testAudio.addEventListener('error', (e) => {
        console.error('🎵 Audio blob is invalid:', e);
      });
      
      // Generate filename with timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `Live Recording ${timestamp}.webm`;
      
      // Send to backend for chord analysis AND save to library
      const formData = new FormData();
      formData.append('audio_file', recordedBlob, filename);
      formData.append('simplicity_preference', '0.5');
      formData.append('save_to_library', 'true');
      
      console.log('🎵 Sending to backend...');
      console.log('📤 Request details:', {
        url: 'http://localhost:8000/api/analyze-live-audio',
        method: 'POST',
        blobSize: recordedBlob.size,
        filename: filename,
        saveToLibrary: 'true'
      });

      const response = await fetch('http://localhost:8000/api/analyze-live-audio', {
        method: 'POST',
        body: formData,
      });

      console.log('📥 Response details:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
        headers: Object.fromEntries(response.headers.entries())
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.log('❌ Backend response not ok:', response.status, response.statusText);
        console.log('❌ Error details:', errorText);
        throw new Error(`Failed to analyze captured audio: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log('🎵 Backend response:', data);
      console.log('🎵 Response keys:', Object.keys(data));
      console.log('🎵 Has saved_to_library?', 'saved_to_library' in data);
      console.log('🎵 saved_to_library value:', data.saved_to_library);
      
      if (data.chords && Array.isArray(data.chords)) {
        console.log('🎵 Found chords:', data.chords.length, 'sections');
        setDetectedChords(data.chords);
        onChordsDetected?.(data.chords);
        
        // Set current chord based on the most recent detection
        const lastChord = data.chords[data.chords.length - 1];
        if (lastChord) {
          setCurrentChord(lastChord.chord);
          console.log('🎵 Current chord set to:', lastChord.chord);
        }
      } else {
        console.log('❌ No chords in response or invalid format');
      }

      // If recording was saved to library, show success message and refresh library
      if (data.saved_to_library) {
        console.log('✅ Recording saved to library:', data.library_entry);
        // Notify parent component to refresh library
        onRecordingSaved?.();
      } else {
        console.log('⚠️ Recording was not saved to library or field missing');
        console.log('⚠️ Attempting to refresh library anyway...');
        // Refresh library anyway since the file count increased
        onRecordingSaved?.();
      }

      setAnalysisProgress(100);
      console.log('🎵 Analysis complete!');
      
    } catch (err) {
      console.error('Error analyzing live audio:', err);
      
      // Provide more specific error messages
      if (err instanceof Error) {
        if (err.message.includes('Failed to fetch')) {
          setError('Cannot connect to backend server. Please make sure it is running.');
        } else if (err.message.includes('500')) {
          setError('Backend server error. Check the server logs for details.');
        } else if (err.message.includes('404')) {
          setError('Backend endpoint not found. Please check server configuration.');
        } else {
          setError(`Analysis failed: ${err.message}`);
        }
      } else {
        setError('Failed to analyze captured audio. Please try again.');
      }
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Stop capture
  const stopCapture = () => {
    if (isRecording) {
      stopRecording();
    }

    isCapturingRef.current = false; // Stop the monitoring loop
    setIsCapturing(false);

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    setAudioLevel(0);
  };

  // Cleanup on component unmount
  useEffect(() => {
    return () => {
      stopCapture();
    };
  }, []);

  // Format time display
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (showSetupGuide) {
    return (
      <div className="live-audio-capture">
        <div className="guide-header-nav">
          <button 
            className="back-button"
            onClick={() => setShowSetupGuide(false)}
          >
            ← Back to Live Capture
          </button>
        </div>
        <SystemAudioGuide />
      </div>
    );
  }

  return (
    <div className="live-audio-capture">
      <div className="capture-header">
        <h2>🎤 Live Chord Detection</h2>
        <p>Play music near your microphone and get instant chord analysis</p>
      </div>

      <div className="capture-controls">
        {!isCapturing ? (
          <div className="mic-setup">
            <div className="mic-icon-large">
              <FiMic size={48} />
            </div>
            <h3>Ready to Listen</h3>
            <p>Your microphone will pick up any audio playing nearby - instruments, speakers, or live performance</p>
            <button 
              className="capture-start-button"
              onClick={initializeAudio}
            >
              <FiMic size={20} />
              Start Listening
            </button>
          </div>
        ) : (
          <div className="active-controls">
            <div className="live-status">
              <div className={`status-indicator ${isRecording ? 'recording' : 'listening'}`}>
                <div className="pulse-ring"></div>
                <FiMic size={24} />
              </div>
              <div className="status-text">
                <h3>{isRecording ? 'Recording & Analyzing...' : 'Listening for Audio'}</h3>
                <p>{isRecording ? 'Capturing chords in real-time' : 'Play some music to begin analysis'}</p>
              </div>
            </div>

            <div className="audio-level-display">
              <div className="level-label">Input Level</div>
              <div className="level-meter">
                <div 
                  className="level-bar"
                  style={{ 
                    width: `${audioLevel * 100}%`,
                    backgroundColor: audioLevel > 0.1 ? '#34a853' : audioLevel > 0.05 ? '#fbbc04' : '#ea4335'
                  }}
                />
              </div>
              <div className="level-value">{Math.round(audioLevel * 100)}%</div>
            </div>

            <div className="quick-controls">
              <div className="duration-selector">
                <label>Recording Length:</label>
                <div className="duration-buttons">
                  {[10, 30, 60].map(duration => (
                    <button
                      key={duration}
                      className={`duration-btn ${captureLength === duration ? 'active' : ''}`}
                      onClick={() => setCaptureLength(duration)}
                      disabled={isRecording}
                    >
                      {duration}s
                    </button>
                  ))}
                </div>
              </div>

              <div className="action-buttons">
                {!isRecording ? (
                  <button 
                    className="record-button-main"
                    onClick={startRecording}
                    disabled={audioLevel < 0.01}
                  >
                    <FiPlay size={20} />
                    Record Chords ({captureLength}s)
                  </button>
                ) : (
                  <button 
                    className="stop-button-main"
                    onClick={stopRecording}
                  >
                    <FiPause size={20} />
                    Stop & Analyze
                  </button>
                )}

                <button 
                  className="stop-listening-button"
                  onClick={stopCapture}
                >
                  <FiMicOff size={18} />
                  Stop Listening
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="error-message">
          ❌ {error}
        </div>
      )}

      {isAnalyzing && (
        <div className="analysis-progress">
          <div className="progress-bar">
            <div 
              className="progress-fill"
              style={{ width: `${analysisProgress}%` }}
            />
          </div>
          <div className="progress-text">Analyzing captured audio...</div>
        </div>
      )}


      {detectedChords.length > 0 && (
        <div className="results-section">
          <div className="results-header">
            <h3>🎵 Detected Chords</h3>
            <div className="chord-count">{detectedChords.length} chord sections found</div>
          </div>
          
          {currentChord && (
            <div className="current-chord-highlight">
              <div className="current-label">Most Recent:</div>
              <div className="current-chord">{currentChord}</div>
            </div>
          )}

          <div className="chord-progression">
            {detectedChords.map((chord, idx) => (
              <div key={idx} className="chord-card">
                <div className="chord-name">{chord.chord}</div>
                <div className="chord-timing">
                  {formatTime(chord.startTime)} - {formatTime(chord.endTime)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="tips-section">
        <button 
          className="tips-toggle"
          onClick={() => setShowTips(!showTips)}
        >
          <FiHelpCircle size={16} />
          Tips for Better Results
        </button>
        
        {showTips && (
          <div className="tips-content">
            <div className="tip-category">
              <h4>🎤 Great Sources:</h4>
              <ul>
                <li><strong>Live instruments</strong> - Guitar, piano, any acoustic instrument</li>
                <li><strong>Phone/computer speakers</strong> - Play music and place device near mic</li>
                <li><strong>Headphone output</strong> - Connect headphone jack to computer's line-in</li>
                <li><strong>Practice/jam sessions</strong> - Real-time chord detection while playing</li>
              </ul>
            </div>
            
            <div className="tip-category">
              <h4>🔧 Pro Tips:</h4>
              <ul>
                <li><strong>Turn up the volume</strong> - Higher input levels = better detection</li>
                <li><strong>Reduce background noise</strong> - Close windows, turn off fans</li>
                <li><strong>Position microphone</strong> - Point towards the sound source</li>
                <li><strong>Use shorter clips</strong> - 10-30 seconds work best for analysis</li>
              </ul>
            </div>
            
            <div className="tip-category">
              <h4>🎯 What Works Best:</h4>
              <ul>
                <li>Clear chord progressions (avoid too much melody/vocals)</li>
                <li>Acoustic guitar, piano, or clean electric guitar</li>
                <li>Songs with distinct chord changes</li>
                <li>Medium to slow tempo music</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LiveAudioCapture;