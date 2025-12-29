import React from 'react';
import './ChordProgressionOverview.css';

interface ChordSection {
  startTime: number;
  endTime: number;
  chord: string;
}

interface ChordProgressionOverviewProps {
  detectedChords: ChordSection[];
  currentChord: string;
  bpm?: number;
  onChordClick: (startTime: number) => void;
}

const formatTime = (seconds: number): string => {
  if (isNaN(seconds) || !isFinite(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const ChordProgressionOverview: React.FC<ChordProgressionOverviewProps> = ({
  detectedChords,
  currentChord,
  bpm,
  onChordClick
}) => {
  if (detectedChords.length === 0) return null;

  const uniqueChords = Array.from(new Set(detectedChords.map(c => c.chord))).sort();
  const totalDuration = detectedChords[detectedChords.length - 1]?.endTime || 0;

  return (
    <div className="chord-progression-overview">
      <div className="chord-overview-header">
        <h3>🎼 Chord Progression Overview</h3>
        <button 
          className="print-button"
          onClick={() => window.print()}
          title="Print chord progression"
        >
          🖨️ Print
        </button>
      </div>
      
      <div className="chord-overview-content">
        {/* Statistics */}
        <div className="chord-stats">
          <div className="stat-item">
            <span className="stat-label">Total Sections</span>
            <span className="stat-value">{detectedChords.length}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Duration</span>
            <span className="stat-value">{formatTime(totalDuration)}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Unique Chords</span>
            <span className="stat-value">{uniqueChords.length}</span>
          </div>
          {bpm && (
            <div className="stat-item">
              <span className="stat-label">BPM</span>
              <span className="stat-value">{bpm}</span>
            </div>
          )}
        </div>

        {/* Chord Grid */}
        <div className="chord-grid">
          {detectedChords.map((chord, index) => (
            <div 
              key={index} 
              className={`chord-item ${currentChord === chord.chord ? 'active' : ''}`}
              onClick={() => onChordClick(chord.startTime)}
            >
              <div className="chord-name">{chord.chord}</div>
              <div className="chord-timing">
                {formatTime(chord.startTime)} - {formatTime(chord.endTime)}
              </div>
              <div className="chord-duration">
                {formatTime(chord.endTime - chord.startTime)}
              </div>
            </div>
          ))}
        </div>

        {/* Chord Sequence */}
        <div className="chord-sequence">
          <h4>📝 Chord Sequence</h4>
          <div className="sequence-line">
            {detectedChords.map((chord, index) => (
              <span key={index} className="sequence-chord">
                {chord.chord}
                {index < detectedChords.length - 1 && ' - '}
              </span>
            ))}
          </div>
          
          <div className="unique-chords">
            <h4>🎯 Unique Chords Used</h4>
            <div className="unique-chord-list">
              {uniqueChords.map((chord, index) => (
                <span key={index} className="unique-chord">{chord}</span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChordProgressionOverview;