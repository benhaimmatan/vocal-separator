import React, { useState, useRef, useEffect } from 'react';
import { Activity, Music, FileText, Layers, Settings, HelpCircle, Upload, X, Play, Pause, Download, Check, User } from 'lucide-react';
import AuthModal from './components/AuthModal';
import UserMenu from './components/UserMenu';
import JobHistoryModal from './components/JobHistoryModal';
import ChordAnalyzer from './components/ChordAnalyzer';

// API functions
const api = {
  async separateAudio(file, extractVocals, extractAccompaniment, authToken = null) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('extract_vocals', extractVocals);
    formData.append('extract_accompaniment', extractAccompaniment);
    
    const headers = {};
    if (authToken) headers.Authorization = `Bearer ${authToken}`;
    
    const res = await fetch('/api/separate', { method: 'POST', body: formData, headers });
    return res.json();
  },
  
  async detectChords(file, authToken = null, simplicityPreference = 0.5, bpmOverride = null) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('simplicity_preference', simplicityPreference);
    if (bpmOverride !== null) {
      formData.append('bpm_override', bpmOverride);
    }
    
    const headers = {};
    if (authToken) headers.Authorization = `Bearer ${authToken}`;
    
    const res = await fetch('/api/chords', { method: 'POST', body: formData, headers });
    return res.json();
  },
  
  async fetchLyrics(song, artist, authToken = null) {
    const formData = new FormData();
    formData.append('song', song);
    formData.append('artist', artist);
    
    const headers = {};
    if (authToken) headers.Authorization = `Bearer ${authToken}`;
    
    const res = await fetch('/api/lyrics', { method: 'POST', body: formData, headers });
    return res.json();
  }
};

// Toggle Switch Component
const Toggle = ({ enabled, onChange, label }) => (
  <label className="flex items-center justify-between cursor-pointer group">
    <span className="text-sm text-zinc-400 group-hover:text-zinc-200 transition-colors">{label}</span>
    <button
      type="button"
      onClick={() => onChange(!enabled)}
      className={`relative w-11 h-6 rounded-full transition-all duration-200 ${
        enabled ? 'bg-violet-500' : 'bg-zinc-600'
      }`}
    >
      <span
        className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm transition-transform duration-200 ${
          enabled ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  </label>
);

// Audio Player Component
const AudioPlayer = ({ title, subtitle, src }) => {
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const audioRef = useRef(null);

  const togglePlay = () => {
    if (playing) {
      audioRef.current?.pause();
    } else {
      audioRef.current?.play();
    }
    setPlaying(!playing);
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      const pct = (audioRef.current.currentTime / audioRef.current.duration) * 100;
      setProgress(pct || 0);
    }
  };

  const handleSeek = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    if (audioRef.current) {
      audioRef.current.currentTime = pct * audioRef.current.duration;
    }
  };

  return (
    <div className="bg-zinc-800/50 rounded-xl p-4 border border-zinc-700/50">
      <audio ref={audioRef} src={src} onTimeUpdate={handleTimeUpdate} onEnded={() => setPlaying(false)} />
      <div className="flex items-center justify-between mb-3">
        <div>
          <h4 className="text-sm font-medium text-zinc-100">{title}</h4>
          {subtitle && <span className="text-xs text-zinc-500">{subtitle}</span>}
        </div>
        <a 
          href={src} 
          download 
          className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-zinc-400 border border-zinc-600 rounded-lg hover:bg-zinc-700/50 hover:text-zinc-200 transition-all"
        >
          <Download size={14} />
          Download
        </a>
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={togglePlay}
          className="w-8 h-8 flex items-center justify-center bg-violet-500 rounded-full hover:bg-violet-400 transition-colors"
        >
          {playing ? <Pause size={14} /> : <Play size={14} />}
        </button>
        <div 
          className="flex-1 h-1.5 bg-zinc-700 rounded-full overflow-hidden cursor-pointer"
          onClick={handleSeek}
        >
          <div
            className="h-full bg-violet-500 rounded-full transition-all duration-100"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
};

// File Upload Zone
const UploadZone = ({ onFileSelect, isDragging, setIsDragging, accept = ".mp3,.wav,.flac,.m4a,.ogg" }) => {
  const fileInputRef = useRef(null);

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) onFileSelect(file);
  };

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      onClick={() => fileInputRef.current?.click()}
      className={`relative cursor-pointer border-2 border-dashed rounded-2xl p-16 text-center transition-all duration-300 ${
        isDragging
          ? 'border-violet-500 bg-violet-500/10'
          : 'border-zinc-700 hover:border-zinc-500 hover:bg-zinc-800/30'
      }`}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        onChange={(e) => e.target.files?.[0] && onFileSelect(e.target.files[0])}
        className="hidden"
      />
      <div className={`transition-transform duration-300 ${isDragging ? 'scale-110' : ''}`}>
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-zinc-800 text-zinc-400 mb-4">
          <Upload size={32} />
        </div>
        <p className="text-zinc-200 font-medium mb-1">
          Drop an audio file or click to browse
        </p>
        <p className="text-sm text-zinc-500">
          MP3, WAV, FLAC, M4A, OGG supported
        </p>
      </div>
    </div>
  );
};

// File Card
const FileCard = ({ file, onRemove }) => (
  <div className="flex items-center gap-4 p-4 bg-zinc-800/50 rounded-xl border border-zinc-700/50 animate-slideIn">
    <div className="w-12 h-12 rounded-xl bg-violet-500/20 text-violet-400 flex items-center justify-center">
      <Music size={20} />
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-sm font-medium text-zinc-100 truncate">{file.name}</p>
      <p className="text-xs text-zinc-500">{(file.size / (1024 * 1024)).toFixed(1)} MB</p>
    </div>
    <button
      onClick={onRemove}
      className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-zinc-700 text-zinc-500 hover:text-zinc-300 transition-colors"
    >
      <X size={16} />
    </button>
  </div>
);

// Processing Indicator
const ProcessingIndicator = ({ message = "Processing..." }) => (
  <div className="flex flex-col items-center justify-center py-20 animate-fadeIn">
    <div className="relative w-16 h-16 mb-6">
      <div className="absolute inset-0 rounded-full border-2 border-zinc-700" />
      <div className="absolute inset-0 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
    </div>
    <p className="text-zinc-200 font-medium">{message}</p>
  </div>
);

// Chord Badge
const ChordBadge = ({ chord }) => (
  <div className="flex-shrink-0 px-4 py-2 bg-zinc-800/50 rounded-lg border border-zinc-700/50 hover:border-violet-500/50 transition-all cursor-pointer group">
    <p className="text-lg font-bold text-zinc-100 group-hover:text-violet-400 transition-colors">{chord}</p>
  </div>
);

// Main App
export default function App() {
  const [activeNav, setActiveNav] = useState('separator');
  const [file, setFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [results, setResults] = useState(null);
  const [extractVocals, setExtractVocals] = useState(true);
  const [extractAccompaniment, setExtractAccompaniment] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [artistQuery, setArtistQuery] = useState('');
  const [lyrics, setLyrics] = useState(null);
  const [chords, setChords] = useState(null);
  const [error, setError] = useState(null);
  const [showChordAnalyzer, setShowChordAnalyzer] = useState(false);

  // Advanced chord detection parameters
  const [simplicityPreference, setSimplicityPreference] = useState(0.5);
  const [bpmOverride, setBpmOverride] = useState('');
  
  // Authentication state
  const [user, setUser] = useState(null);
  const [authToken, setAuthToken] = useState(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showJobHistory, setShowJobHistory] = useState(false);
  
  // Shared audio ref for chord visualizers
  const sharedAudioRef = useRef(null);

  // Check for existing auth on app load
  useEffect(() => {
    const savedToken = localStorage.getItem('auth_token');
    const savedUser = localStorage.getItem('user_data');
    
    if (savedToken && savedUser) {
      try {
        setAuthToken(savedToken);
        setUser(JSON.parse(savedUser));
      } catch (err) {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user_data');
      }
    }
  }, []);

  const navItems = [
    { id: 'separator', icon: Activity, label: 'Separator' },
    { id: 'chords', icon: Music, label: 'Chords' },
    { id: 'lyrics', icon: FileText, label: 'Lyrics' },
    { id: 'combined', icon: Layers, label: 'Combined' },
  ];

  const handleNavChange = (id) => {
    setActiveNav(id);
    setFile(null);
    setResults(null);
    setChords(null);
    setLyrics(null);
    setError(null);
    setShowChordAnalyzer(false);
  };

  const handleAuthSuccess = (userData, token) => {
    setUser(userData);
    setAuthToken(token);
    setShowAuthModal(false);
  };

  const handleLogout = () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_data');
    setUser(null);
    setAuthToken(null);
    setShowJobHistory(false);
  };

  const handleSeparate = async () => {
    if (!file) return;
    setProcessing(true);
    setError(null);
    try {
      const res = await api.separateAudio(file, extractVocals, extractAccompaniment, authToken);
      if (res.success) {
        setResults(res);
      } else {
        setError('Failed to process audio');
      }
    } catch (e) {
      setError(e.message);
    }
    setProcessing(false);
  };

  const handleDetectChords = async () => {
    if (!file) return;
    setProcessing(true);
    setError(null);
    try {
      const bpmValue = bpmOverride ? parseFloat(bpmOverride) : null;
      const res = await api.detectChords(file, authToken, simplicityPreference, bpmValue);
      if (res.success) {
        setChords(res.chords);
        setShowChordAnalyzer(true);
      } else {
        setError('Failed to detect chords');
      }
    } catch (e) {
      setError(e.message);
    }
    setProcessing(false);
  };

  const handleSearchLyrics = async () => {
    if (!searchQuery || !artistQuery) return;
    setProcessing(true);
    setError(null);
    try {
      const res = await api.fetchLyrics(searchQuery, artistQuery, authToken);
      if (res.success) {
        setLyrics(res);
      } else {
        setError('Lyrics not found');
      }
    } catch (e) {
      setError(e.message);
    }
    setProcessing(false);
  };

  const getTitle = () => {
    const titles = {
      separator: 'Vocal Separator',
      chords: 'Chord Finder',
      lyrics: 'Lyrics',
      combined: 'Lyrics + Chords'
    };
    return titles[activeNav];
  };

  const getDescription = () => {
    const desc = {
      separator: 'Separate vocals and accompaniment from any audio file',
      chords: 'Detect chord progressions with timestamps',
      lyrics: 'Search and fetch lyrics for any song',
      combined: 'View lyrics with synchronized chord annotations'
    };
    return desc[activeNav];
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex">
      {/* Main App Layout */}
      <>
          {/* Left Navigation */}
          <nav className="w-16 bg-zinc-900 border-r border-zinc-800 flex flex-col items-center py-4 flex-shrink-0">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center mb-8 shadow-lg shadow-violet-500/20">
          <Activity size={20} />
        </div>

        <div className="flex-1 flex flex-col items-center gap-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeNav === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleNavChange(item.id)}
                className={`relative w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 ${
                  isActive
                    ? 'bg-violet-500/15 text-violet-400'
                    : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'
                }`}
                title={item.label}
              >
                {isActive && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-violet-500 rounded-r-full" />
                )}
                <Icon size={20} />
              </button>
            );
          })}
        </div>

        <div className="flex flex-col items-center gap-1 pt-4 border-t border-zinc-800">
          {user ? (
            <button 
              onClick={() => setShowJobHistory(true)}
              className="w-10 h-10 rounded-xl flex items-center justify-center text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-all" 
              title="Job History"
            >
              <Activity size={20} />
            </button>
          ) : (
            <button 
              onClick={() => setShowAuthModal(true)}
              className="w-10 h-10 rounded-xl flex items-center justify-center text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-all" 
              title="Sign In"
            >
              <User size={20} />
            </button>
          )}
          <button className="w-10 h-10 rounded-xl flex items-center justify-center text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-all" title="Settings">
            <Settings size={20} />
          </button>
          <button className="w-10 h-10 rounded-xl flex items-center justify-center text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-all" title="Help">
            <HelpCircle size={20} />
          </button>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-14 px-6 border-b border-zinc-800 flex items-center justify-between flex-shrink-0 bg-zinc-900/50">
          <h1 className="text-sm font-semibold text-zinc-100">{getTitle()}</h1>
          {user && (
            <UserMenu 
              user={user} 
              onLogout={handleLogout}
              onViewHistory={() => setShowJobHistory(true)}
            />
          )}
        </header>

        {/* Main Content Area */}
        {showChordAnalyzer && chords && file ? (
          <ChordAnalyzer
            audioFile={file}
            chordData={chords}
            onBack={() => {
              setShowChordAnalyzer(false);
            }}
          />
        ) : (
          <div className="flex-1 overflow-auto">
            <div className="max-w-2xl mx-auto p-8">
              <p className="text-zinc-400 mb-8">{getDescription()}</p>

            {error && (
              <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 animate-fadeIn">
                {error}
              </div>
            )}

            {/* Separator Tab */}
            {activeNav === 'separator' && (
              <div className="space-y-6">
                {!file && !results && (
                  <UploadZone
                    onFileSelect={setFile}
                    isDragging={isDragging}
                    setIsDragging={setIsDragging}
                  />
                )}

                {file && !processing && !results && (
                  <>
                    <FileCard file={file} onRemove={() => setFile(null)} />
                    <div className="p-5 bg-zinc-800/50 rounded-xl border border-zinc-700/50 space-y-4">
                      <h3 className="text-sm font-medium text-zinc-200">Output Options</h3>
                      <Toggle label="Extract Vocals" enabled={extractVocals} onChange={setExtractVocals} />
                      <Toggle label="Extract Accompaniment" enabled={extractAccompaniment} onChange={setExtractAccompaniment} />
                    </div>
                    <button
                      onClick={handleSeparate}
                      disabled={!extractVocals && !extractAccompaniment}
                      className="w-full py-3.5 px-4 bg-violet-500 hover:bg-violet-400 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium rounded-xl transition-all duration-200 active:scale-[0.98]"
                    >
                      Separate Tracks
                    </button>
                  </>
                )}

                {processing && <ProcessingIndicator message="Separating audio..." />}

                {results && (
                  <div className="space-y-4 animate-fadeIn">
                    <div className="flex items-center gap-3 p-4 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
                      <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center text-white">
                        <Check size={14} />
                      </div>
                      <p className="text-sm text-zinc-200">Successfully separated tracks</p>
                    </div>
                    {results.vocals_path && (
                      <AudioPlayer title="Vocals" src={`/api/download/${encodeURIComponent(results.vocals_path)}`} />
                    )}
                    {results.accompaniment_path && (
                      <AudioPlayer title="Accompaniment" src={`/api/download/${encodeURIComponent(results.accompaniment_path)}`} />
                    )}
                    <button
                      onClick={() => { setFile(null); setResults(null); }}
                      className="w-full py-3 text-sm font-medium text-zinc-400 hover:text-zinc-200 transition-colors"
                    >
                      Process another file
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Chords Tab */}
            {activeNav === 'chords' && (
              <div className="space-y-6">
                {!file && !chords && (
                  <UploadZone
                    onFileSelect={setFile}
                    isDragging={isDragging}
                    setIsDragging={setIsDragging}
                  />
                )}

                {file && !processing && !chords && (
                  <>
                    <FileCard file={file} onRemove={() => setFile(null)} />
                    
                    {/* Advanced Chord Detection Parameters */}
                    <div className="p-5 bg-zinc-800/50 rounded-xl border border-zinc-700/50 space-y-4">
                      <h3 className="text-sm font-medium text-zinc-200">Advanced Chord Detection</h3>
                      
                      {/* Simplicity Preference Slider */}
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <label className="text-sm text-zinc-400">Simplicity Preference</label>
                          <span className="text-xs font-mono text-zinc-300 bg-zinc-700 px-2 py-1 rounded">
                            {(simplicityPreference * 100).toFixed(0)}%
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-zinc-500">Complex</span>
                          <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.1"
                            value={simplicityPreference}
                            onChange={(e) => setSimplicityPreference(parseFloat(e.target.value))}
                            className="flex-1 h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer slider"
                          />
                          <span className="text-xs text-zinc-500">Simple</span>
                        </div>
                        <p className="text-xs text-zinc-500">
                          Higher values prefer simpler chord progressions by filtering out short chord changes
                        </p>
                      </div>
                      
                      {/* BPM Override Input */}
                      <div className="space-y-2">
                        <label className="text-sm text-zinc-400">BPM Override (optional)</label>
                        <input
                          type="number"
                          min="60"
                          max="200"
                          placeholder="Auto-detect BPM"
                          value={bpmOverride}
                          onChange={(e) => setBpmOverride(e.target.value)}
                          className="w-full px-3 py-2.5 bg-zinc-900 border border-zinc-700 rounded-lg text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-violet-500 transition-colors"
                        />
                        <p className="text-xs text-zinc-500">
                          Leave empty to auto-detect BPM, or specify a value for more accurate beat-aligned chord detection
                        </p>
                      </div>
                    </div>
                    
                    <button
                      onClick={handleDetectChords}
                      className="w-full py-3.5 px-4 bg-violet-500 hover:bg-violet-400 text-white font-medium rounded-xl transition-all duration-200 active:scale-[0.98]"
                    >
                      Detect Chords with Advanced AI
                    </button>
                  </>
                )}

                {processing && <ProcessingIndicator message="Analyzing chords..." />}

                {chords && (
                  <div className="space-y-6 animate-fadeIn">
                    <div className="flex items-center gap-3 p-4 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
                      <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center text-white">
                        <Check size={14} />
                      </div>
                      <p className="text-sm text-zinc-200">Detected {chords.length} chord changes</p>
                    </div>

                    <div className="flex gap-2 overflow-x-auto pb-2" style={{ scrollbarWidth: 'none' }}>
                      {[...new Set(chords.slice(0, 20).map(c => c.chord))].map((chord, i) => (
                        <ChordBadge key={i} chord={chord} />
                      ))}
                    </div>

                    <div className="bg-zinc-800/50 rounded-xl border border-zinc-700/50 overflow-hidden">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-zinc-700/50">
                            <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">Time</th>
                            <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">Chord</th>
                          </tr>
                        </thead>
                        <tbody>
                          {chords.slice(0, 30).map((c, i) => (
                            <tr key={i} className="border-b border-zinc-700/30 last:border-0 hover:bg-zinc-700/20 transition-colors">
                              <td className="px-4 py-3 font-mono text-zinc-500">{c.time?.toFixed(2)}s</td>
                              <td className="px-4 py-3 font-bold text-zinc-100">{c.chord}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="space-y-3">
                      <button
                        onClick={() => setShowChordAnalyzer(true)}
                        className="w-full py-3.5 px-4 bg-violet-500 hover:bg-violet-400 text-white font-medium rounded-xl transition-all duration-200 active:scale-[0.98]"
                      >
                        Open Professional Analyzer
                      </button>
                      <button
                        onClick={() => { setFile(null); setChords(null); }}
                        className="w-full py-3 text-sm font-medium text-zinc-400 hover:text-zinc-200 transition-colors"
                      >
                        Analyze another file
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Lyrics Tab */}
            {activeNav === 'lyrics' && (
              <div className="space-y-6">
                {!lyrics && !processing && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-zinc-400 mb-2">Song Title</label>
                        <input
                          type="text"
                          placeholder="Enter song name..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="w-full px-4 py-3 bg-zinc-800/50 border border-zinc-700 rounded-xl text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-violet-500 transition-colors"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-zinc-400 mb-2">Artist</label>
                        <input
                          type="text"
                          placeholder="Enter artist name..."
                          value={artistQuery}
                          onChange={(e) => setArtistQuery(e.target.value)}
                          className="w-full px-4 py-3 bg-zinc-800/50 border border-zinc-700 rounded-xl text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-violet-500 transition-colors"
                        />
                      </div>
                    </div>
                    <button
                      onClick={handleSearchLyrics}
                      disabled={!searchQuery || !artistQuery}
                      className="w-full py-3.5 px-4 bg-violet-500 hover:bg-violet-400 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium rounded-xl transition-all duration-200 active:scale-[0.98]"
                    >
                      Search Lyrics
                    </button>
                  </>
                )}

                {processing && <ProcessingIndicator message="Searching lyrics..." />}

                {lyrics && (
                  <div className="space-y-6 animate-fadeIn">
                    <div className="flex items-center gap-4 p-4 bg-zinc-800/50 rounded-xl border border-zinc-700/50">
                      <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-zinc-700 to-zinc-800 flex items-center justify-center text-zinc-400">
                        <Music size={24} />
                      </div>
                      <div>
                        <h3 className="font-semibold text-zinc-100">{lyrics.song}</h3>
                        <p className="text-sm text-zinc-500">{lyrics.artist}</p>
                      </div>
                    </div>

                    <div className="bg-zinc-800/50 rounded-xl border border-zinc-700/50 p-6 max-h-96 overflow-auto">
                      <pre className="text-zinc-200 whitespace-pre-wrap font-sans leading-relaxed">{lyrics.lyrics}</pre>
                    </div>

                    <button
                      onClick={() => setLyrics(null)}
                      className="w-full py-3 text-sm font-medium text-zinc-400 hover:text-zinc-200 transition-colors"
                    >
                      Search another song
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Combined Tab */}
            {activeNav === 'combined' && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-5 bg-zinc-800/50 rounded-xl border border-zinc-700/50">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="w-6 h-6 rounded-full bg-violet-500/20 text-violet-400 flex items-center justify-center text-xs font-bold">1</span>
                      <h3 className="text-sm font-medium text-zinc-200">Song Info</h3>
                    </div>
                    <input
                      type="text"
                      placeholder="Song title..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full px-3 py-2.5 mb-2 bg-zinc-900 border border-zinc-700 rounded-lg text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-violet-500 transition-colors"
                    />
                    <input
                      type="text"
                      placeholder="Artist..."
                      value={artistQuery}
                      onChange={(e) => setArtistQuery(e.target.value)}
                      className="w-full px-3 py-2.5 bg-zinc-900 border border-zinc-700 rounded-lg text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-violet-500 transition-colors"
                    />
                  </div>
                  <div className="p-5 bg-zinc-800/50 rounded-xl border border-zinc-700/50">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="w-6 h-6 rounded-full bg-violet-500/20 text-violet-400 flex items-center justify-center text-xs font-bold">2</span>
                      <h3 className="text-sm font-medium text-zinc-200">Audio File</h3>
                    </div>
                    {!file ? (
                      <div
                        onClick={() => document.getElementById('combined-file')?.click()}
                        className="w-full px-3 py-6 border border-dashed border-zinc-700 rounded-lg text-sm text-zinc-500 hover:border-zinc-500 hover:text-zinc-400 transition-colors cursor-pointer text-center"
                      >
                        Click to upload audio
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 p-2 bg-zinc-900 rounded-lg">
                        <Music size={16} className="text-violet-400" />
                        <span className="text-sm text-zinc-300 truncate flex-1">{file.name}</span>
                        <button onClick={() => setFile(null)} className="text-zinc-500 hover:text-zinc-300">
                          <X size={14} />
                        </button>
                      </div>
                    )}
                    <input
                      id="combined-file"
                      type="file"
                      accept=".mp3,.wav,.flac,.m4a,.ogg"
                      onChange={(e) => e.target.files?.[0] && setFile(e.target.files[0])}
                      className="hidden"
                    />
                  </div>
                </div>

                <button
                  onClick={async () => {
                    setProcessing(true);
                    setError(null);
                    try {
                      if (searchQuery && artistQuery) {
                        const lyrRes = await api.fetchLyrics(searchQuery, artistQuery, authToken);
                        if (lyrRes.success) setLyrics(lyrRes);
                      }
                      if (file) {
                        const bpmValue = bpmOverride ? parseFloat(bpmOverride) : null;
                        const chordRes = await api.detectChords(file, authToken, simplicityPreference, bpmValue);
                        if (chordRes.success) setChords(chordRes.chords);
                      }
                    } catch (e) {
                      setError(e.message);
                    }
                    setProcessing(false);
                  }}
                  disabled={(!searchQuery || !artistQuery) && !file}
                  className="w-full py-3.5 px-4 bg-violet-500 hover:bg-violet-400 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium rounded-xl transition-all duration-200 active:scale-[0.98]"
                >
                  Analyze
                </button>

                {processing && <ProcessingIndicator message="Analyzing..." />}

                {(lyrics || chords) && !processing && (
                  <div className="grid grid-cols-2 gap-6 animate-fadeIn">
                    <div>
                      <h3 className="text-sm font-medium text-zinc-200 mb-3">Lyrics</h3>
                      {lyrics ? (
                        <div className="bg-zinc-800/50 rounded-xl border border-zinc-700/50 p-4 h-80 overflow-auto">
                          <pre className="text-sm text-zinc-300 whitespace-pre-wrap font-sans">{lyrics.lyrics}</pre>
                        </div>
                      ) : (
                        <div className="bg-zinc-800/50 rounded-xl border border-zinc-700/50 p-4 h-80 flex items-center justify-center text-zinc-500">
                          Enter song info to fetch lyrics
                        </div>
                      )}
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-zinc-200 mb-3">Chords</h3>
                      {chords ? (
                        <div className="bg-zinc-800/50 rounded-xl border border-zinc-700/50 p-4 h-80 overflow-auto">
                          {chords.slice(0, 30).map((c, i) => (
                            <div key={i} className="flex justify-between py-1 border-b border-zinc-700/30 last:border-0">
                              <span className="text-xs text-zinc-500 font-mono">{c.time?.toFixed(2)}s</span>
                              <span className="text-sm font-bold text-zinc-200">{c.chord}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="bg-zinc-800/50 rounded-xl border border-zinc-700/50 p-4 h-80 flex items-center justify-center text-zinc-500">
                          Upload audio to detect chords
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
            </div>
          </div>
        )}
      </main>

          {/* Modals */}
          <AuthModal 
            isOpen={showAuthModal}
            onClose={() => setShowAuthModal(false)}
            onAuthSuccess={handleAuthSuccess}
          />
          
          <JobHistoryModal 
            isOpen={showJobHistory}
            onClose={() => setShowJobHistory(false)}
            authToken={authToken}
          />
        </>
    </div>
  );
}
