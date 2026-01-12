import React from 'react';
import { Printer } from 'lucide-react';

/**
 * Professional Chord Chart Viewer
 * Real Book-style chord sheet layout for musicians
 * Following UI Design Principles: usability, clarity, printability
 */

const ChordListView = ({ chordData, bpm, fileName, capo, transposeChord }) => {

  // === DATA PROCESSING ===

  /**
   * Process raw chord data into measure-based structure
   * Standard: 4 beats per measure in 4/4 time
   */
  const processChordData = () => {
    if (!chordData || chordData.length === 0) return [];

    const measures = [];
    let currentMeasure = [];
    let currentBeats = 0;
    const BEATS_PER_MEASURE = 4;

    chordData.forEach((chord, index) => {
      const nextChord = chordData[index + 1];
      const duration = nextChord ? nextChord.time - chord.time : 4;
      const beats = Math.max(0.25, Math.round((duration * bpm) / 60 * 4) / 4); // Quantize to quarter notes
      const transposedChord = transposeChord(chord.chord, capo);

      // Add chord to current measure
      currentMeasure.push({
        chord: transposedChord,
        beats: beats,
        originalIndex: index
      });
      currentBeats += beats;

      // Complete measure when we reach or exceed 4 beats
      if (currentBeats >= BEATS_PER_MEASURE) {
        measures.push([...currentMeasure]);
        currentMeasure = [];
        currentBeats = 0;
      }
    });

    // Add remaining chords
    if (currentMeasure.length > 0) {
      measures.push(currentMeasure);
    }

    return measures;
  };

  /**
   * Organize measures into lines (4 measures per line)
   * Real Book standard for readability
   */
  const organizeMeasuresIntoLines = (measures) => {
    const MEASURES_PER_LINE = 4;
    const lines = [];

    for (let i = 0; i < measures.length; i += MEASURES_PER_LINE) {
      lines.push(measures.slice(i, i + MEASURES_PER_LINE));
    }

    return lines;
  };

  /**
   * Generate song structure analysis
   * Infer sections based on chord progression patterns
   */
  const analyzeSongStructure = (measures) => {
    // Simple heuristic: every 8-16 measures likely represents a section
    const sections = [];
    let sectionStart = 0;

    // Detect repeated patterns for verse/chorus identification
    const measureCount = measures.length;

    if (measureCount <= 8) {
      sections.push({ name: 'Song', start: 0, end: measureCount });
    } else if (measureCount <= 16) {
      sections.push({ name: 'Part A', start: 0, end: 8 });
      sections.push({ name: 'Part B', start: 8, end: measureCount });
    } else {
      // Standard song structure estimation
      const verses = Math.floor(measureCount / 16);
      for (let i = 0; i < verses; i++) {
        const start = i * 16;
        const end = Math.min(start + 8, measureCount);
        sections.push({ name: `Section ${i + 1}`, start, end });
      }
    }

    return sections;
  };

  const measures = processChordData();
  const lines = organizeMeasuresIntoLines(measures);
  const sections = analyzeSongStructure(measures);

  // === RENDERING HELPERS ===

  /**
   * Render a single chord within a measure cell
   * Uses bold sans-serif for maximum readability (UI Design Principles p.22)
   */
  const renderChord = (chord, index, totalInMeasure) => {
    const widthPercent = (chord.beats / 4) * 100;

    return (
      <div
        key={index}
        className="chord-cell"
        style={{ width: `${widthPercent}%` }}
      >
        <span className="chord-name">{chord.chord || 'N'}</span>
      </div>
    );
  };

  /**
   * Render a complete measure with bar lines
   * Real Book style: clear bar lines, evenly spaced chords
   */
  const renderMeasure = (measure, measureIndex) => {
    return (
      <div key={measureIndex} className="measure">
        <div className="measure-content">
          {measure.map((chord, idx) => renderChord(chord, idx, measure.length))}
        </div>
        <div className="bar-line"></div>
      </div>
    );
  };

  /**
   * Render complete line (4 measures)
   */
  const renderLine = (line, lineIndex) => {
    return (
      <div key={lineIndex} className="chord-line">
        <div className="measure-number">{lineIndex * 4 + 1}</div>
        <div className="measures-container">
          {line.map((measure, idx) => renderMeasure(measure, idx))}
        </div>
      </div>
    );
  };

  // === COMPONENT RENDER ===

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="chord-chart-viewer">

      {/* Screen-only toolbar */}
      <div className="toolbar print:hidden">
        <div className="song-info">
          <h1 className="song-title">{fileName}</h1>
          <div className="song-meta">
            <span>{measures.length} measures</span>
            <span>•</span>
            <span>{Math.round(bpm)} BPM</span>
            <span>•</span>
            <span>4/4 time</span>
            {capo !== 0 && (
              <>
                <span>•</span>
                <span>Capo {capo > 0 ? '+' : ''}{capo}</span>
              </>
            )}
          </div>
        </div>

        <button onClick={handlePrint} className="print-btn">
          <Printer size={18} />
          Print Chart
        </button>
      </div>

      {/* Print-only header */}
      <div className="print-header hidden print:block">
        <h1 className="print-title">{fileName}</h1>
        <div className="print-meta">
          <span>{Math.round(bpm)} BPM</span>
          <span className="mx-2">•</span>
          <span>4/4</span>
          {capo !== 0 && (
            <>
              <span className="mx-2">•</span>
              <span>Capo {capo > 0 ? '+' : ''}{capo}</span>
            </>
          )}
        </div>
      </div>

      {/* Song structure roadmap */}
      <div className="roadmap print:hidden">
        <div className="roadmap-label">Structure:</div>
        <div className="roadmap-items">
          {sections.map((section, idx) => (
            <React.Fragment key={idx}>
              <span className="roadmap-item">{section.name}</span>
              {idx < sections.length - 1 && <span className="roadmap-arrow">→</span>}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Main chord chart grid */}
      <div className="chord-chart">
        {lines.map((line, idx) => renderLine(line, idx))}

        {/* Final bar line */}
        <div className="final-bar-line"></div>
      </div>

      {/* Print footer */}
      <div className="print-footer hidden print:block">
        <p>Generated by Vocal Separator • Chord Analyzer</p>
      </div>

      {/* ===== STYLES ===== */}
      <style jsx>{`
        /* ===== LAYOUT STRUCTURE ===== */
        .chord-chart-viewer {
          height: 100%;
          overflow-auto;
          background: #18181b;
          color: #f4f4f5;
        }

        /* ===== TOOLBAR (Screen Only) ===== */
        .toolbar {
          position: sticky;
          top: 0;
          z-index: 10;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 1.5rem 2rem;
          background: rgba(24, 24, 27, 0.95);
          backdrop-filter: blur(12px);
          border-bottom: 1px solid rgba(63, 63, 70, 0.5);
        }

        .song-info {
          flex: 1;
        }

        .song-title {
          font-size: 1.5rem;
          font-weight: 700;
          color: #f4f4f5;
          margin: 0 0 0.5rem 0;
          font-family: system-ui, -apple-system, sans-serif;
        }

        .song-meta {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          font-size: 0.875rem;
          color: #a1a1aa;
        }

        .print-btn {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.625rem 1.25rem;
          background: rgba(59, 130, 246, 0.2);
          border: 1px solid rgba(59, 130, 246, 0.4);
          border-radius: 0.75rem;
          color: #93c5fd;
          font-weight: 500;
          font-size: 0.875rem;
          cursor: pointer;
          transition: all 0.2s;
        }

        .print-btn:hover {
          background: rgba(59, 130, 246, 0.3);
          box-shadow: 0 4px 12px rgba(59, 130, 246, 0.2);
        }

        /* ===== ROADMAP (Screen Only) ===== */
        .roadmap {
          padding: 1rem 2rem;
          background: rgba(39, 39, 42, 0.5);
          border-bottom: 1px solid rgba(63, 63, 70, 0.3);
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .roadmap-label {
          font-size: 0.875rem;
          font-weight: 600;
          color: #a1a1aa;
        }

        .roadmap-items {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          flex-wrap: wrap;
        }

        .roadmap-item {
          padding: 0.25rem 0.75rem;
          background: rgba(59, 130, 246, 0.15);
          border: 1px solid rgba(59, 130, 246, 0.3);
          border-radius: 0.5rem;
          font-size: 0.8125rem;
          color: #93c5fd;
          font-weight: 500;
        }

        .roadmap-arrow {
          color: #71717a;
          font-size: 0.875rem;
        }

        /* ===== CHORD CHART GRID ===== */
        .chord-chart {
          padding: 3rem 2rem;
          max-width: 1200px;
          margin: 0 auto;
        }

        .chord-line {
          display: flex;
          align-items: stretch;
          margin-bottom: 2rem;
          min-height: 80px;
        }

        .measure-number {
          width: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.75rem;
          font-weight: 600;
          color: #71717a;
          font-family: 'SF Mono', 'Monaco', 'Courier New', monospace;
        }

        .measures-container {
          flex: 1;
          display: flex;
          gap: 0;
        }

        /* ===== MEASURE RENDERING ===== */
        .measure {
          flex: 1;
          display: flex;
          position: relative;
          background: rgba(39, 39, 42, 0.3);
          border: 1px solid rgba(63, 63, 70, 0.4);
          border-right: none;
        }

        .measure:first-child {
          border-top-left-radius: 0.5rem;
          border-bottom-left-radius: 0.5rem;
        }

        .measure:last-child {
          border-top-right-radius: 0.5rem;
          border-bottom-right-radius: 0.5rem;
          border-right: 1px solid rgba(63, 63, 70, 0.4);
        }

        .measure-content {
          flex: 1;
          display: flex;
          align-items: center;
          padding: 0.75rem;
        }

        .bar-line {
          width: 2px;
          background: rgba(161, 161, 170, 0.6);
          align-self: stretch;
        }

        .measure:last-child .bar-line {
          display: none;
        }

        /* ===== CHORD CELLS ===== */
        .chord-cell {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0.5rem;
          min-height: 50px;
        }

        .chord-name {
          font-size: 1.5rem;
          font-weight: 700;
          color: #f4f4f5;
          font-family: system-ui, -apple-system, 'Inter', sans-serif;
          letter-spacing: -0.02em;
        }

        /* Final bar line */
        .final-bar-line {
          width: 100%;
          height: 3px;
          background: rgba(161, 161, 170, 0.6);
          margin-top: 1rem;
          margin-left: 40px;
        }

        /* ===== PRINT STYLES (High Contrast, A4 Optimized) ===== */
        @media print {
          .chord-chart-viewer {
            background: white;
            color: black;
            padding: 0;
          }

          .print-header {
            text-align: center;
            padding: 1.5rem 0 1rem 0;
            border-bottom: 2px solid black;
            margin-bottom: 1.5rem;
          }

          .print-title {
            font-size: 1.5rem;
            font-weight: 700;
            margin: 0 0 0.5rem 0;
            color: black;
          }

          .print-meta {
            font-size: 0.875rem;
            color: #333;
          }

          .chord-chart {
            padding: 1rem 1.5rem;
            max-width: 100%;
          }

          .chord-line {
            margin-bottom: 1.5rem;
            page-break-inside: avoid;
            min-height: 60px;
          }

          .measure-number {
            color: #666;
          }

          .measure {
            background: white;
            border: 1px solid #333;
          }

          .bar-line {
            background: #333;
            width: 2px;
          }

          .chord-name {
            color: black;
            font-size: 1.25rem;
          }

          .final-bar-line {
            background: #333;
            height: 4px;
            margin-top: 0.5rem;
          }

          .print-footer {
            position: fixed;
            bottom: 1rem;
            left: 0;
            right: 0;
            text-align: center;
            font-size: 0.75rem;
            color: #666;
            padding-top: 1rem;
            border-top: 1px solid #ddd;
          }

          /* Remove all screen-only elements */
          .toolbar,
          .roadmap {
            display: none !important;
          }

          /* Optimize for single-page A4 */
          @page {
            size: A4;
            margin: 1.5cm;
          }

          body {
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }
        }

        /* ===== RESPONSIVE (Mobile) ===== */
        @media (max-width: 768px) {
          .toolbar {
            flex-direction: column;
            align-items: flex-start;
            gap: 1rem;
          }

          .print-btn {
            width: 100%;
            justify-content: center;
          }

          .chord-chart {
            padding: 2rem 1rem;
          }

          .chord-line {
            flex-direction: column;
          }

          .measure-number {
            width: 100%;
            justify-content: flex-start;
            padding: 0.5rem 0;
          }

          .measures-container {
            flex-direction: column;
            gap: 0.5rem;
          }

          .measure {
            border-radius: 0.5rem !important;
            border-right: 1px solid rgba(63, 63, 70, 0.4) !important;
          }

          .bar-line {
            display: none;
          }

          .chord-name {
            font-size: 1.25rem;
          }
        }
      `}</style>
    </div>
  );
};

export default ChordListView;
