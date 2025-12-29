import React, { useState, useEffect, useCallback } from 'react';

interface Chord {
    timestamp: number;
    chord: string;
}

interface LyricsWithChordsProps {
    fileId: string;
    initialLyrics: string | null | undefined;
    initialChords: Chord[] | undefined;
    initialSyncMapping: Array<{ lyric_line_index: number; chord_index: number }> | undefined;
    onLyricsUpdate: (lyrics: string | null, syncMapping?: Array<{ lyric_line_index: number; chord_index: number }>) => void;
    originalFileName: string; // For display and context
}

const LyricsWithChords: React.FC<LyricsWithChordsProps> = ({ 
    fileId, 
    initialLyrics, 
    initialChords, 
    initialSyncMapping, 
    onLyricsUpdate,
    originalFileName
}) => {
    const [lyrics, setLyrics] = useState(initialLyrics);
    const [chords, setChords] = useState(initialChords);
    const [syncMapping, setSyncMapping] = useState(initialSyncMapping);
    const [fetchingLyrics, setFetchingLyrics] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const API_BASE_URL = '/api';

    // Effect to reset state when initial props change (e.g., new file selected)
    useEffect(() => {
        console.log(`LyricsWithChords: File changed to ${fileId} (${originalFileName}). Initializing...`);
        setLyrics(initialLyrics);
        setChords(initialChords);
        setSyncMapping(initialSyncMapping);
        setError(null); // Clear errors from previous file
        setFetchingLyrics(false); // Reset fetching state

        // If there are no initial lyrics but there are chords, it implies lyrics might be fetchable.
        // However, we shouldn't automatically fetch here without a user action or clearer signal,
        // as the main ChordFinder component might already be handling this initial load logic.
        // This component should primarily react to props or explicit user actions within it.
    }, [fileId, initialLyrics, initialChords, initialSyncMapping, originalFileName]);

    const fetchLyrics = useCallback(async () => {
        if (!fileId) {
            setError("Cannot fetch lyrics: File ID is missing.");
            return;
        }
        console.log(`Fetching lyrics for file ID: ${fileId}`);
        setFetchingLyrics(true);
        setError(null);
        try {
            const response = await fetch(`${API_BASE_URL}/file-lyrics`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ file_id: fileId }),
            });

            if (!response.ok) {
                const errorText = await response.text();
                let detail = errorText;
                try {
                    const errorJson = JSON.parse(errorText);
                    detail = errorJson.detail || errorText;
                } catch (e) { /* Not a JSON error */ }
                console.error(`Error fetching lyrics: ${response.status}`, detail);
                throw new Error(`Failed to fetch lyrics. Server responded with ${response.status}: ${detail}`);
            }

            const data = await response.json();
            console.log("Lyrics fetched successfully:", data);

            if (data.lyrics === null || data.lyrics === undefined || data.lyrics.trim() === "") {
                setLyrics("No lyrics found for this song.");
                setError("No lyrics content returned from server.");
            } else {
                setLyrics(data.lyrics);
            }
            // Chords might also be updated via this endpoint if backend logic changes, but primarily for sync_mapping here.
            if (data.sync_mapping) {
                setSyncMapping(data.sync_mapping);
            }
            // Propagate update to parent
            onLyricsUpdate(data.lyrics, data.sync_mapping);

        } catch (err) {
            console.error('Fetch lyrics error:', err);
            setError((err as Error).message || "An unexpected error occurred while fetching lyrics.");
            setLyrics(prevLyrics => prevLyrics || "Failed to load lyrics."); // Keep existing lyrics if any, or show error
        } finally {
            setFetchingLyrics(false);
        }
    }, [fileId, onLyricsUpdate]);

    const renderContent = () => {
        // Detect Hebrew text
        const isHebrew = lyrics && /[\u0590-\u05FF]/.test(lyrics);
        const contentAreaClass = `lyrics-content-area${isHebrew ? ' hebrew' : ''}`;
        
        console.log('LyricsWithChords renderContent:', {
            hasLyrics: !!lyrics,
            hasChords: !!(chords && chords.length > 0),
            chordsCount: chords?.length || 0,
            hasSyncMapping: !!(syncMapping && syncMapping.length > 0),
            syncMappingCount: syncMapping?.length || 0,
            isHebrew,
            contentAreaClass,
            lyricsPreview: lyrics ? lyrics.substring(0, 50) + '...' : 'null'
        });

        if (!lyrics && (!chords || chords.length === 0)) {
            return (
                <div className="lyrics-status-message">
                    <p>No lyrics or chords available for {originalFileName}.</p>
                    <button onClick={fetchLyrics} disabled={fetchingLyrics || !fileId} className="button">
                        {fetchingLyrics ? 'Fetching Lyrics...' : 'Try Fetching Lyrics'}
                    </button>
                </div>
            );
        }
        if (!lyrics && chords && chords.length > 0) {
             return (
                <div className="lyrics-status-message">
                    <p>Chords are available, but lyrics are missing for {originalFileName}.</p>
                    <button onClick={fetchLyrics} disabled={fetchingLyrics || !fileId} className="button">
                        {fetchingLyrics ? 'Fetching Lyrics...' : 'Fetch Lyrics'}
                    </button>
                     <div className={contentAreaClass} style={{marginTop: 'var(--spacing-unit)'}}>
                        <div className="chords-column">
                            {chords.map((chord, index) => <p key={index} className="chord-line">{chord.chord}</p>)}
                        </div>
                        <div className="lyrics-column">
                            <p className="lyrics-status-message">(Lyrics not available)</p>
                        </div>
                    </div>
                </div>
            );
        }

        if (lyrics && (!chords || chords.length === 0)) {
            return (
                 <div className={contentAreaClass}>
                    <div className="chords-column">
                        <p className="lyrics-status-message">(Chords not available)</p>
                    </div>
                    <div className="lyrics-column">
                        {lyrics.split('\n').map((line, index) => <p key={index} className="lyric-line">{line || '\u00A0'}</p>)} 
                    </div>
                </div>
            );
        }

        // Both lyrics and chords are available
        const lyricLines = lyrics ? lyrics.split('\n') : [];
        const displayLines: Array<{ lyric: string; chord?: string }> = [];

        console.log('Processing lyrics and chords:', {
            lyricLinesCount: lyricLines.length,
            chordsCount: chords?.length || 0,
            hasSyncMapping: !!(syncMapping && syncMapping.length > 0)
        });

        if (syncMapping && chords) {
            console.log('Using sync mapping for chord-lyric alignment');
            let chordIdx = 0;
            lyricLines.forEach((line, lineIdx) => {
                let assignedChordThisLine = "";
                // Check if this lyric line has an assigned chord from sync_mapping
                const mappingEntry = syncMapping.find(m => m.lyric_line_index === lineIdx);
                if (mappingEntry && chords[mappingEntry.chord_index]) {
                    assignedChordThisLine = chords[mappingEntry.chord_index].chord;
                    // Heuristic: If multiple lines map to the same chord, only show it on the first one.
                    // This might need refinement based on how sync_mapping is generated.
                    if (lineIdx > 0 && syncMapping.find(m => m.lyric_line_index === lineIdx -1 && m.chord_index === mappingEntry.chord_index)){
                        // assignedChordThisLine = ""; // Chord already shown on previous line that shares this chord.
                    }
                }
                displayLines.push({ lyric: line || '\u00A0', chord: assignedChordThisLine || '\u00A0' });
            });
            // Add any remaining chords that were not mapped (e.g. if more chords than lyric lines)
            // This part might not be desirable depending on UI preferences.
            // for (let i = chordIdx; i < (chords?.length || 0); i++) {
            // displayLines.push({ lyric: '\u00A0', chord: chords[i].chord });
            // }

        } else {
            console.log('Using fallback chord-lyric alignment');
            // Simple fallback: display lyrics and all chords separately if no sync map
            // Or, attempt a very basic interleaving (less ideal)
            const maxLines = Math.max(lyricLines.length, chords?.length || 0);
            for (let i = 0; i < maxLines; i++) {
                displayLines.push({
                    lyric: lyricLines[i] || '\u00A0',
                    chord: chords && chords[i] ? chords[i].chord : '\u00A0'
                });
            }
        }

        console.log('Display lines generated:', {
            displayLinesCount: displayLines.length,
            firstFewLines: displayLines.slice(0, 3).map(line => ({ lyric: line.lyric.substring(0, 20), chord: line.chord }))
        });

        return (
            <div className={contentAreaClass}>
                <div className="chords-column">
                    {displayLines.map((line, index) => <p key={`chord-${index}`} className="chord-line">{line.chord}</p>)}
                </div>
                <div className="lyrics-column">
                    {displayLines.map((line, index) => <p key={`lyric-${index}`} className="lyric-line">{line.lyric}</p>)}
                </div>
            </div>
        );
    };

    return (
        <div className={`lyrics-with-chords${lyrics && /[\u0590-\u05FF]/.test(lyrics) ? ' hebrew' : ''}`}>
            <div className="lyrics-chords-header">
                <h3>Lyrics & Chords</h3>
                {lyrics && chords && chords.length > 0 && (
                     <button onClick={fetchLyrics} disabled={fetchingLyrics || !fileId} className="button button-secondary" title="Re-fetch lyrics and synchronization">
                        {fetchingLyrics ? 'Fetching...' : 'Refresh Lyrics'}
                    </button>
                )}
            </div>
            {error && <p className="status-message error-text" style={{textAlign: 'center', marginBottom: 'var(--spacing-unit)'}}>{error}</p>}
            {fetchingLyrics && !lyrics && <p className="status-message loading-message" style={{textAlign: 'center'}}>Loading lyrics...</p>}
            
            {renderContent()}
        </div>
    );
};

export default LyricsWithChords; 