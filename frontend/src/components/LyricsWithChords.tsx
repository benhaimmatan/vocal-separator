import React, { useEffect, useState } from 'react';
import '../ChordFinder.css';

interface ChordSection {
  startTime: number;
  endTime: number;
  chord: string;
}

interface LyricsWithChordsProps {
  artist: string;
  title: string;
  fileId: string;
  currentTime?: number;
  detectedChords?: ChordSection[];
}

interface WordWithChord {
  text: string;
  chord?: string;
}

interface LyricLineWithChords {
  words: WordWithChord[];
  lineNumber: number;
}

const LyricsWithChords: React.FC<LyricsWithChordsProps> = ({ 
  artist, 
  title, 
  fileId, 
  currentTime = 0,
  detectedChords = []
}) => {
  const [lyrics, setLyrics] = useState<string[]>([]);
  const [processedLyrics, setProcessedLyrics] = useState<LyricLineWithChords[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isHebrew, setIsHebrew] = useState(false);
  const [lyricToChordMapping, setLyricToChordMapping] = useState<{ [key: string]: string }>({});

  // DEBUG: Log what LyricsWithChords is rendering - MUST be at top level for hooks consistency
  useEffect(() => {
    console.log('🟨 LyricsWithChords RENDERING:', {
      hasLyrics: lyrics.length > 0,
      hasChords: detectedChords.length > 0,
      processedLyricsCount: processedLyrics.length,
      timestamp: new Date().toISOString()
    });
  }, [lyrics.length, detectedChords.length, processedLyrics.length]);

  // Hebrew detection function
  const detectHebrew = (text: string): boolean => {
    const hebrewRegex = /[\u0590-\u05FF]/;
    return hebrewRegex.test(text);
  };

  // Normalize chord format to match chord progression display
  const normalizeChordFormat = (chord: string): string => {
    if (!chord || chord === 'N' || typeof chord !== 'string') return chord;
    
    // Convert backend format to display format
    const normalizedChord = chord
      .replace(':min', 'm')        // F#:min → F#m
      .replace(':maj', '')         // F#:maj → F#
      .replace(':dim', 'dim')      // F#:dim → F#dim
      .replace(':aug', 'aug')      // F#:aug → F#aug
      .replace(':sus2', 'sus2')    // F#:sus2 → F#sus2
      .replace(':sus4', 'sus4')    // F#:sus4 → F#sus4
      .replace(':7', '7')          // F#:7 → F#7
      .replace(':maj7', 'maj7')    // F#:maj7 → F#maj7
      .replace(':min7', 'm7')      // F#:min7 → F#m7
      .replace(':dim7', 'dim7')    // F#:dim7 → F#dim7
      .replace(':hdim7', 'm7b5')   // F#:hdim7 → F#m7b5
      .replace(':9', '9')          // F#:9 → F#9
      .replace(':maj9', 'maj9')    // F#:maj9 → F#maj9
      .replace(':min9', 'm9')      // F#:min9 → F#m9
      .replace(':11', '11')        // F#:11 → F#11
      .replace(':13', '13');       // F#:13 → F#13
    
    return normalizedChord;
  };

  // Clean lyrics by removing metadata lines
  const cleanLyrics = (rawLyrics: string): string => {
    if (!rawLyrics) return '';
    
    const lines = rawLyrics.split('\n');
    const cleanedLines = lines.filter(line => {
      const trimmedLine = line.trim();
      
      // Keep empty lines for structure
      if (!trimmedLine) return true;
      
      // Remove lines that contain metadata patterns
      const metadataPatterns = [
        /lyrics$/i,
        /contributors?$/i,
        /\d+\s+contributors?/i,
        /^[^a-zA-Z\u0590-\u05FF]*\d+[^a-zA-Z\u0590-\u05FF]*$/,
        /featuring|ft\.|feat\./i,
        /produced by/i,
        /written by/i,
        /genius\.com/i,
        /embed$/i,
        /^you might also like/i,
        /^\[.*\]$/,
        /\d+embed$/i,
        /song\s*name\s*-/i,
        /\s-\s.*lyrics$/i,
        /^view\s+/i,
        /^share\s+/i,
        /^download\s+/i,
        /^stream\s+/i,
        /^\d+\s*$|^\d+\.\s*$/,
        /translation$/i,
        /annotation$/i,
        /see live$/i,
        /get tickets$/i,
        // Hebrew-specific patterns
        /מילים$/,
        /מילות השיר$/,
        /מילים ולחן$/,
        /מילים:/,
        /לחן:/,
        /ביצוע:/,
        /^מילים\s+/,
        /^לחן\s+/,
        /^ביצוע\s+/,
        // Pattern for "Song Name - מלאך Lyrics" format
        /^.*\s-\s.*\sLyrics$/i,
        // Pattern for contributor count at start
        /^\d+\s+Contributor/i,
      ];
      
      for (const pattern of metadataPatterns) {
        if (pattern.test(trimmedLine)) {
          return false;
        }
      }
      
      // Remove lines that are mostly English metadata in Hebrew songs
      const isHebrewSong = /[\u0590-\u05FF]/.test(rawLyrics);
      if (isHebrewSong && /^[a-zA-Z0-9\s\-_]+$/.test(trimmedLine) && trimmedLine.length < 50) {
        // Skip short English-only lines in Hebrew songs (likely metadata)
        return false;
      }
      
      if (trimmedLine.toLowerCase().includes('lyrics') && 
          (trimmedLine.includes('-') || trimmedLine.includes('•'))) {
        return false;
      }
      
      return true;
    });
    
    // Remove leading and trailing empty lines
    while (cleanedLines.length > 0 && !cleanedLines[0].trim()) {
      cleanedLines.shift();
    }
    while (cleanedLines.length > 0 && !cleanedLines[cleanedLines.length - 1].trim()) {
      cleanedLines.pop();
    }
    
    return cleanedLines.join('\n');
  };

  // COMPLETELY NEW APPROACH: Sync chords with lyrics using detected chord progression
  const createChordLyricsSync = (lyricsArray: string[], detectedChords: ChordSection[]): LyricLineWithChords[] => {
    if (!lyricsArray.length || !detectedChords.length) return [];

    const processed: LyricLineWithChords[] = [];
    
    console.log('🎵 NEW SYNC APPROACH - VERSION 2.0:', {
      lyricsLines: lyricsArray.length,
      detectedChords: detectedChords.length,
      firstChord: detectedChords[0],
      songDuration: detectedChords[detectedChords.length - 1]?.endTime || 0
    });

    // Debug: Show first 10 chords with timing
    console.log('🎵 FIRST 10 CHORDS:', detectedChords.slice(0, 10).map(c => 
      `${c.chord} (${c.startTime.toFixed(1)}s - ${c.endTime.toFixed(1)}s)`
    ));

    // Debug: Show what lyrics we're actually processing
    console.log('🎵 LYRICS LINES TO PROCESS:', lyricsArray.slice(0, 5).map((line, idx) => 
      `Line ${idx}: "${line}"`
    ));

    // Calculate total words and estimate vocal timing
    const totalWords = lyricsArray.reduce((sum, line) => sum + line.split(' ').filter(w => w.trim()).length, 0);
    
    // INTELLIGENT VOCAL START DETECTION - works for any song
    const detectVocalStart = (chords: ChordSection[]): number => {
      // Filter out silence/no-chord segments
      const musicalChords = chords.filter(c => c.chord !== 'N');
      if (musicalChords.length === 0) return 0;
      
      // Look for the first sustained chord that's likely to support vocals
      // Criteria: 
      // 1. Starts after reasonable intro time (1-20 seconds)
      // 2. Duration >= 2 seconds (sustained enough for vocals)
      // 3. Not a brief transitional chord
      const vocalCandidate = musicalChords.find(chord => {
        const duration = chord.endTime - chord.startTime;
        const isAfterIntro = chord.startTime >= 1 && chord.startTime <= 20;
        const isSustained = duration >= 2;
        return isAfterIntro && isSustained;
      });
      
      return vocalCandidate?.startTime || musicalChords[0]?.startTime || 0;
    };
    
    const vocalStartTime = detectVocalStart(detectedChords);
    
    // Find last chord end time  
    const songEndTime = detectedChords[detectedChords.length - 1]?.endTime || 180;
    const vocalDuration = songEndTime - vocalStartTime;
    
    // Calculate words per second (more realistic timing)
    const wordsPerSecond = totalWords / vocalDuration;
    
    console.log('🎵 TIMING CALCULATION:', {
      totalWords,
      vocalStartTime,
      vocalDuration,
      wordsPerSecond,
      detectedVocalStartLogic: `Found sustained chord at ${vocalStartTime}s`
    });

    let currentWordTime = vocalStartTime;
    
    lyricsArray.forEach((line, lineIdx) => {
      console.log(`🎵 PROCESSING Line ${lineIdx}: "${line}" (${line.trim().length} chars)`);
      
      if (!line.trim()) {
        processed.push({
          words: [{ text: '', chord: undefined }],
          lineNumber: lineIdx
        });
        return;
      }

      const words = line.split(' ').filter(w => w.trim());
      const wordsWithChords: WordWithChord[] = [];

      words.forEach((word, wordIdx) => {
        // Find chord active at this word's current time (BEFORE advancing)
        const activeChord = detectedChords.find(chord => 
          chord.startTime <= currentWordTime && currentWordTime < chord.endTime
        );

        const chord = activeChord?.chord || '';
        const normalizedChord = chord && chord !== 'N' ? normalizeChordFormat(chord) : '';
        
        // DEBUG: Always log what chord is found, even if it's N or empty
        console.log(`🎵 DEBUG: Line ${lineIdx} Word ${wordIdx} "${word}" @ ${currentWordTime.toFixed(2)}s -> RAW: "${chord}" | NORMALIZED: "${normalizedChord}"`);
        
        wordsWithChords.push({
          text: word,
          chord: normalizedChord
        });

        if (normalizedChord) {
          console.log(`🎵 SYNC: Line ${lineIdx} Word ${wordIdx} "${word}" @ ${currentWordTime.toFixed(2)}s -> ${normalizedChord}`);
        }

        // Advance time for NEXT word
        const fastWordsPerSecond = 4.5;
        const wordDuration = 1 / fastWordsPerSecond;
        currentWordTime += wordDuration;
      });

      processed.push({
        words: wordsWithChords,
        lineNumber: lineIdx
      });
    });

    return processed;
  };

  const processLyricsWithChords = (lyricsArray: string[], chordMapping: { [key: string]: any }): LyricLineWithChords[] => {
    if (!lyricsArray.length) return [];
    
    const processed: LyricLineWithChords[] = [];
    
    console.log('🎵 PROCESSING LYRICS WITH CHORDS:', {
      lyricsLines: lyricsArray.length,
      chordMappingKeys: Object.keys(chordMapping).length,
      sampleMapping: Object.entries(chordMapping).slice(0, 5),
      allMappingKeys: Object.keys(chordMapping)
    });
    
    // Check if lyrics contain Hebrew
    const allText = lyricsArray.join(' ');
    const isHebrewText = detectHebrew(allText);
    setIsHebrew(isHebrewText);
    
    lyricsArray.forEach((line, lineIdx) => {
      if (!line.trim()) {
        // Handle empty lines
        processed.push({
          words: [{ text: '', chord: undefined }],
          lineNumber: lineIdx
        });
        return;
      }
      
      const words = line.split(' ').filter(word => word.trim() !== '');
      const wordsWithChords: WordWithChord[] = [];
      
      // Build word-to-chord mapping for this line
      const lineChordMap: { [wordIndex: number]: string } = {};
      
      // Scan all chord mappings for this line
      Object.entries(chordMapping).forEach(([key, chordData]) => {
        const parts = key.split('_');
        if (parts.length >= 2) {
          const [lineIndexStr, wordIndexStr] = parts;
          const lineIndex = parseInt(lineIndexStr);
          const wordIndex = parseInt(wordIndexStr);
          
          // Check if this mapping belongs to current line
          if (lineIndex === lineIdx && !isNaN(wordIndex) && wordIndex < words.length) {
            const chordString = extractChordString(chordData);
            if (chordString) {
              lineChordMap[wordIndex] = chordString;
              console.log(`🎵 Line ${lineIdx} Word ${wordIndex} ("${words[wordIndex]}") -> Chord: ${chordString}`);
            }
          }
        }
      });
      
      // Process each word with its chord
      words.forEach((word, wordIdx) => {
        const rawChord = lineChordMap[wordIdx] || '';
        const normalizedChord = rawChord ? normalizeChordFormat(rawChord) : '';
        
        wordsWithChords.push({
          text: word,
          chord: normalizedChord
        });
      });
      
      // DISTRIBUTE CHORDS: If no word-level mappings but we have line-level chord data, 
      // distribute multiple chords across the line intelligently
      const hasWordChords = Object.keys(lineChordMap).length > 0;
      if (!hasWordChords && wordsWithChords.length > 0) {
        // Get all chord data for this line
        const lineChordData = chordMapping[lineIdx.toString()];
        if (lineChordData && typeof lineChordData === 'object') {
          const chords = Object.values(lineChordData)
            .map(chord => extractChordString(chord))
            .filter(chord => chord !== '' && chord !== 'N');
          
          if (chords.length > 0) {
            // Distribute chords across words intelligently
            if (chords.length === 1) {
              // Single chord goes on first word
              wordsWithChords[0].chord = normalizeChordFormat(chords[0]);
            } else {
              // Multiple chords: distribute across the line
              const wordsPerChord = Math.max(1, Math.floor(wordsWithChords.length / chords.length));
              chords.forEach((chord, chordIdx) => {
                const wordIdx = chordIdx * wordsPerChord;
                if (wordIdx < wordsWithChords.length) {
                  wordsWithChords[wordIdx].chord = normalizeChordFormat(chord);
                }
              });
            }
          }
        }
      }
      
      processed.push({
        words: wordsWithChords,
        lineNumber: lineIdx
      });
    });
    
    console.log('🎵 PROCESSING COMPLETE:', {
      processedLines: processed.length,
      totalWords: processed.reduce((sum, line) => sum + line.words.length, 0),
      chordsFound: processed.reduce((sum, line) => sum + line.words.filter(w => w.chord).length, 0)
    });
    
    return processed;
  };

  const fetchLyrics = async () => {
    if (!fileId) {
      setError('No file selected');
      return;
    }
    
    console.log('🎵 Fetching lyrics for file ID:', fileId);
    
    setLoading(true);
    setError(null);
    
    try {
      const requestBody = { file_id: fileId };
      console.log('🎵 Request body:', requestBody);
      
      const res = await fetch(`http://localhost:8000/api/file-lyrics`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });
      
      console.log('🎵 Response status:', res.status, res.statusText);
      
      if (!res.ok) {
        const errorText = await res.text();
        console.log('🎵 Error response:', errorText);
        
        // Handle 404 specifically - lyrics not found
        if (res.status === 404) {
          console.log('🎵 Lyrics not found (404), but chords may still be available');
          setError(null); // Don't show error for missing lyrics
          setLyrics([]); // Set empty lyrics
          setProcessedLyrics([]);
          setLyricToChordMapping({});
          return; // Exit gracefully
        }
        
        throw new Error(`Failed to fetch lyrics: ${res.status} ${res.statusText}`);
      }
      
      const data = await res.json();
      
      if (!data.lyrics) {
        console.log('🎵 No lyrics in response, but not treating as error');
        setLyrics([]);
        setProcessedLyrics([]);
        setLyricToChordMapping({});
        return;
      }
      
      // Clean the lyrics to remove metadata lines
      const cleanedLyricsText = cleanLyrics(data.lyrics);
      
      if (!cleanedLyricsText.trim()) {
        console.log('🎵 No valid lyrics content after cleaning');
        setLyrics([]);
        setProcessedLyrics([]);
        setLyricToChordMapping({});
        return;
      }
      
      const lyricsArray = cleanedLyricsText.split('\n');
      setLyrics(lyricsArray);
      
      // Calculate offset between raw lyrics and cleaned lyrics
      const rawLyricsArray = data.lyrics.split('\n');
      const cleanedStartIndex = rawLyricsArray.findIndex((line: string) => 
        line.trim() && cleanedLyricsText.includes(line.trim())
      );
      
      // More intelligent offset detection
      const hasMetadataOffset = cleanedStartIndex > 0 && cleanedStartIndex <= 3; // Reasonable metadata range
      const actualOffset = hasMetadataOffset ? cleanedStartIndex : 0;
      
      console.log('🎵 Lyrics cleaning analysis:', {
        rawLyricsLines: rawLyricsArray.length,
        cleanedLyricsLines: lyricsArray.length,
        detectedOffset: cleanedStartIndex,
        hasMetadataOffset,
        actualOffsetUsed: actualOffset,
        firstRawLine: rawLyricsArray[0],
        firstCleanedLine: lyricsArray[0],
        needsOffsetCorrection: hasMetadataOffset
      });
      
      // Set chord mapping if available
      if (data.lyric_to_chord_mapping) {
        console.log('🎵 Received chord mapping:', data.lyric_to_chord_mapping);
        console.log('🎵 Backend mapping keys count:', Object.keys(data.lyric_to_chord_mapping).length);
        console.log('🎵 Sample backend mapping:', Object.entries(data.lyric_to_chord_mapping).slice(0, 5));
        console.log('🎵 Detected chords for comparison:', detectedChords.slice(0, 5).map(c => ({ chord: c.chord, startTime: c.startTime })));
        setLyricToChordMapping(data.lyric_to_chord_mapping);
      } else {
        console.log('🎵 No chord mapping received from API');
      }
      
      // Create chord mapping from detected chords if available
      let finalChordMapping = {};
      if (data.lyric_to_chord_mapping && Object.keys(data.lyric_to_chord_mapping).length > 0) {
        console.log('🎵 Using backend chord mapping (most accurate)');
        
        // Adjust backend mapping indices to account for cleaned lyrics offset
        const adjustedMapping: { [key: string]: string } = {};
        Object.entries(data.lyric_to_chord_mapping).forEach(([key, chord]) => {
          const [lineIndexStr, wordIndexStr] = key.split('_');
          const originalLineIndex = parseInt(lineIndexStr);
          const wordIndex = parseInt(wordIndexStr);
          
          // Adjust line index by subtracting the offset
          const adjustedLineIndex = originalLineIndex - actualOffset;
          
          // Only include mappings that fall within the cleaned lyrics range
          if (adjustedLineIndex >= 0 && adjustedLineIndex < lyricsArray.length) {
            const adjustedKey = `${adjustedLineIndex}_${wordIndex}`;
            adjustedMapping[adjustedKey] = chord as string;
          }
        });
        
        console.log('🎵 Chord mapping adjustment:', {
          originalMappingCount: Object.keys(data.lyric_to_chord_mapping).length,
          adjustedMappingCount: Object.keys(adjustedMapping).length,
          offset: actualOffset,
          sampleAdjusted: Object.entries(adjustedMapping).slice(0, 5)
        });
        
        finalChordMapping = adjustedMapping;
        setLyricToChordMapping(finalChordMapping);
      } else if (detectedChords.length > 0) {
        console.log('🎵 Backend mapping not available, creating frontend mapping as fallback');
        finalChordMapping = createChordMappingFromDetectedChords(lyricsArray, detectedChords);
        setLyricToChordMapping(finalChordMapping);
      } else {
        console.log('🎵 No chord data available');
        setLyricToChordMapping({});
      }
      
      // Use new chord-lyrics synchronization approach
      const processed = createChordLyricsSync(lyricsArray, detectedChords);
      setProcessedLyrics(processed);
      
      // Debug output for המלאך song
      if (lyricsArray.length > 0) {
        console.log('🎵 LYRICS PROCESSING COMPLETE:', {
          originalLyricsLines: lyricsArray.length,
          processedLyricsLines: processed.length,
          chordMappingKeys: Object.keys(finalChordMapping).length,
          firstFewLines: lyricsArray.slice(0, 3),
          firstFewMappings: Object.entries(finalChordMapping).slice(0, 5),
          detectedChordsCount: detectedChords.length,
          firstFewChords: detectedChords.slice(0, 3).map(c => ({ chord: c.chord, start: c.startTime, end: c.endTime }))
        });
      }
      
    } catch (err) {
      console.error('Error fetching lyrics:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch lyrics');
    } finally {
      setLoading(false);
    }
  };

  // Fetch lyrics when component mounts or fileId changes
  useEffect(() => {
    if (fileId) {
      fetchLyrics();
    }
  }, [fileId]);

  // Re-process lyrics when detected chords change
  useEffect(() => {
    if (lyrics.length > 0 && detectedChords.length > 0) {
      console.log('🎵 Re-processing lyrics with new detected chords');
      console.log('🎵 First 5 detected chords:', detectedChords.slice(0, 5).map(c => ({ 
        chord: c.chord, 
        normalizedChord: normalizeChordFormat(c.chord),
        startTime: c.startTime, 
        endTime: c.endTime 
      })));
      
      // Only create frontend mapping if we don't already have backend mapping
      if (Object.keys(lyricToChordMapping).length === 0) {
        console.log('🎵 No existing mapping, creating frontend mapping');
        console.log('🎵 Creating new chord-lyrics sync');
        const processed = createChordLyricsSync(lyrics, detectedChords);
        setProcessedLyrics(processed);
        
        // Log the first few processed lines to see what chords are being assigned
        console.log('🎵 First 3 processed lines with chords:', 
          processed.slice(0, 3).map((line, idx) => ({
            lineNumber: idx,
            text: line.words.map(w => w.text).join(' '),
            chords: line.words.filter(w => w.chord).map(w => w.chord)
          }))
        );
      } else {
        console.log('🎵 Using new sync approach with detected chords');
        const processed = createChordLyricsSync(lyrics, detectedChords);
        setProcessedLyrics(processed);
      }
    }
  }, [detectedChords, lyrics]);

  // Create chord mapping based on detected chords and estimated timing
  const createChordMappingFromDetectedChords = (lyricsArray: string[], detectedChords: ChordSection[]): { [key: string]: string } => {
    if (!detectedChords.length || !lyricsArray.length) return {};
    
    const mapping: { [key: string]: string } = {};
    
    // Filter out empty lines and calculate total content
    const nonEmptyLines = lyricsArray.map((line, idx) => ({ line, originalIndex: idx }))
      .filter(item => item.line.trim());
    
    if (nonEmptyLines.length === 0) return {};
    
    // Filter out 'N' (no chord) segments and get actual music sections
    const musicalChords = detectedChords.filter(chord => chord.chord !== 'N');
    if (musicalChords.length === 0) return {};
    
    // Smarter vocal start detection:
    // Look for the first sustained chord that's likely when vocals begin
    // This is often after initial instrumental chords and around 15-30 seconds for most songs
    const likelyVocalStartTime = musicalChords.find(chord => {
      const duration = chord.endTime - chord.startTime;
      const isReasonableVocalTime = chord.startTime >= 10 && chord.startTime <= 45; // Reasonable vocal start range
      const isSustainedChord = duration >= 2; // Chord lasts long enough for vocals
      return isReasonableVocalTime && isSustainedChord;
    })?.startTime || musicalChords[Math.floor(musicalChords.length * 0.2)]?.startTime || musicalChords[0].startTime;
    
    const songEndTime = Math.max(...detectedChords.map(c => c.endTime));
    const vocalDuration = songEndTime - likelyVocalStartTime;
    
    // Conservative approach: assume vocals take up 60-70% of the remaining time
    // with instrumental breaks and outros
    const effectiveVocalDuration = vocalDuration * 0.65;
    const timePerLine = effectiveVocalDuration / nonEmptyLines.length;
    
    console.log('🎵 Improved vocal timing analysis:', {
      likelyVocalStartTime,
      songEndTime,
      vocalDuration,
      effectiveVocalDuration,
      timePerLine,
      nonEmptyLinesCount: nonEmptyLines.length,
      musicalChordsCount: musicalChords.length,
      firstFewMusicalChords: musicalChords.slice(0, 5).map(c => ({ chord: c.chord, start: c.startTime, duration: c.endTime - c.startTime }))
    });
    
    nonEmptyLines.forEach((lineItem, lineIdx) => {
      const { line, originalIndex } = lineItem;
      const words = line.split(' ').filter(word => word.trim() !== '');
      
      if (words.length === 0) return;
      
      // Calculate more accurate timing for this line
      const lineStartTime = likelyVocalStartTime + (lineIdx * timePerLine);
      const lineEndTime = likelyVocalStartTime + ((lineIdx + 1) * timePerLine);
      
      // Find chords that are active during this line's timeframe
      const activeChords = musicalChords.filter(chord => {
        const overlapStart = Math.max(chord.startTime, lineStartTime);
        const overlapEnd = Math.min(chord.endTime, lineEndTime);
        const overlapDuration = Math.max(0, overlapEnd - overlapStart);
        
        // Include chord if it has meaningful overlap (at least 1 second or 25% of line duration)
        const minOverlap = Math.max(1.0, (lineEndTime - lineStartTime) * 0.25);
        return overlapDuration >= minOverlap;
      });
      
      if (activeChords.length === 0) {
        // Fallback: find the closest chord in time
        const closestChord = musicalChords.reduce((closest, chord) => {
          const currentDistance = Math.min(
            Math.abs(chord.startTime - lineStartTime),
            Math.abs(chord.endTime - lineStartTime)
          );
          const closestDistance = Math.min(
            Math.abs(closest.startTime - lineStartTime),
            Math.abs(closest.endTime - lineStartTime)
          );
          return currentDistance < closestDistance ? chord : closest;
        });
        
        // Only use fallback if it's reasonably close (within 8 seconds)
        const fallbackDistance = Math.min(
          Math.abs(closestChord.startTime - lineStartTime),
          Math.abs(closestChord.endTime - lineStartTime)
        );
        
        if (fallbackDistance <= 8.0) {
          activeChords.push(closestChord);
        }
      }
      
      if (activeChords.length === 0) return;
      
      // Conservative chord placement: 
      // - For short lines (1-4 words), place one chord at the beginning
      // - For longer lines, be more selective about chord changes
      if (words.length <= 4) {
        const primaryChord = activeChords[0];
        mapping[`${originalIndex}_0`] = normalizeChordFormat(primaryChord.chord);
      } else {
        // For longer lines, only place chords where there are clear chord changes
        const timePerWord = (lineEndTime - lineStartTime) / words.length;
        let lastUsedChord = '';
        
        words.forEach((word, wordIdx) => {
          const wordStartTime = lineStartTime + (wordIdx * timePerWord);
          const wordMidTime = wordStartTime + (timePerWord * 0.5);
          
          // Find the most appropriate chord for this word timing
          const wordChord = activeChords.find(chord => 
            chord.startTime <= wordMidTime && chord.endTime > wordMidTime
          ) || activeChords.find(chord =>
            Math.abs(chord.startTime - wordStartTime) < timePerWord * 1.5
          );
          
          if (wordChord && normalizeChordFormat(wordChord.chord) !== lastUsedChord) {
            mapping[`${originalIndex}_${wordIdx}`] = normalizeChordFormat(wordChord.chord);
            lastUsedChord = normalizeChordFormat(wordChord.chord);
          }
        });
        
        // Ensure at least the first word has a chord
        if (!mapping[`${originalIndex}_0`] && activeChords.length > 0) {
          mapping[`${originalIndex}_0`] = normalizeChordFormat(activeChords[0].chord);
        }
      }
    });
    
    console.log('🎵 Enhanced chord mapping created:', {
      totalMappings: Object.keys(mapping).length,
      sampleMappings: Object.entries(mapping).slice(0, 8).map(([key, chord]) => [key, chord]),
      likelyVocalStartTime,
      linesWithChords: nonEmptyLines.length,
      uniqueChords: [...new Set(Object.values(mapping))]
    });
    
    return mapping;
  };

  if (loading) {
    return (
      <div className="lyrics-loading">
        <div className="loading-spinner"></div>
        <h3>Loading Lyrics</h3>
        <p>Fetching lyrics and chord mappings...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="lyrics-error">
        <div className="error-icon">⚠️</div>
        <h3>Error Loading Lyrics</h3>
        <p>{error}</p>
        <button className="retry-button" onClick={fetchLyrics}>
          Try Again
        </button>
      </div>
    );
  }

  if (!lyrics.length) {
    // If we have detected chords but no lyrics, show simple message
    // The ChordProgressionBar will handle chord visualization
    if (detectedChords.length > 0) {
      return (
        <div className="lyrics-empty">
          <div className="empty-icon">🎼</div>
          <h3>Lyrics Not Available</h3>
          <p>Lyrics could not be found for this song, but chord progression is shown above.</p>
          <p className="suggestion">The chord progression is displayed in the analysis section above.</p>
        </div>
      );
    }
    
    return (
      <div className="lyrics-empty">
        <div className="empty-icon">🎵</div>
        <h3>No Lyrics Available</h3>
        <p>Lyrics could not be found for this song.</p>
        <p className="suggestion">Try running chord detection to see the musical progression.</p>
      </div>
    );
  }

  const uniqueChords = [...new Set(
    processedLyrics.flatMap(line => 
      line.words.map(word => word.chord).filter(Boolean)
    )
  )];

  return (
    <div className={`lyrics-with-chords ${isHebrew ? 'hebrew' : ''}`}>
      {/* Lyrics Content with Chords Above Words - Two Column Layout */}
      <div className="lyrics-content">
        {processedLyrics.map((line, lineIdx) => {
          // Debug logging
          if (lineIdx < 3) { // Only log first 3 lines to avoid spam
            console.log(`Line ${lineIdx}:`, {
              words: line.words.map(w => ({ text: w.text, chord: w.chord })),
              hasWords: line.words.length
            });
          }
          
          return (
            <div key={lineIdx} className="lyric-line">
              {line.words.map((word, wordIdx) => (
                <span
                  key={`${lineIdx}-${wordIdx}`}
                  className="word-with-chord"
                >
                  {word.chord && (
                    <span className="chord-label">{word.chord}</span>
                  )}
                  <span className="word-text">{typeof word.text === 'string' ? word.text : JSON.stringify(word.text)}</span>
                </span>
              ))}
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="lyrics-footer">
        <p className="lyrics-info">
          Synchronized with {detectedChords.length} chord changes
          {detectedChords.length > 0 && (
            <span style={{ marginLeft: '10px', fontSize: '0.8em', opacity: 0.7 }}>
              • First chord: {detectedChords[0]?.chord} • Last chord: {detectedChords[detectedChords.length - 1]?.chord}
            </span>
          )}
          {Object.keys(lyricToChordMapping).length > 0 && (
            <span style={{ marginLeft: '10px', fontSize: '0.8em', opacity: 0.7 }}>
              • {Object.keys(lyricToChordMapping).length} chord mappings
            </span>
          )}
        </p>
      </div>
    </div>
  );
};

export default LyricsWithChords;