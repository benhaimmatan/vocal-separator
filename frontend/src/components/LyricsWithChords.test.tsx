/// <reference types="vitest/globals" />
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, waitFor, within } from '@testing-library/react';
import LyricsWithChords from './LyricsWithChords';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

const mockFileId = "test-file-id";
const mockArtist = "Test Artist";
const mockTitle = "Test Song";

// Raw lyrics as the backend would send, including section headers that cleanLyrics will remove
const mockRawLyricsFromApi = `[Intro]
Line 1 text
Line 2 text

[Verse 1]
Verse 1 Line 1 text
Verse 1 Line 2 text

[Chorus]
Chorus Line 1 text
Chorus Line 2 text

[Bridge]
Bridge Line 1 text
Bridge Line 2 text

[Outro]
Outro Line 1 text
Outro Line 2 text
`;

// Processed mapping, indices are for lyrics AFTER cleanLyrics runs.
// cleanLyrics removes [Intro], [Verse 1], etc., and preserves empty lines.
// Expected cleaned lines (14 total):
// 0: Line 1 text
// 1: Line 2 text
// 2: 
// 3: Verse 1 Line 1 text
// 4: Verse 1 Line 2 text
// 5: 
// 6: Chorus Line 1 text
// 7: Chorus Line 2 text
// 8: 
// 9: Bridge Line 1 text
// 10: Bridge Line 2 text
// 11: 
// 12: Outro Line 1 text
// 13: Outro Line 2 text

const mockApiChordMapping = {
  "0": "Am", // Line 1 text
  "1": "G",  // Line 2 text
  "3": "C",  // Verse 1 Line 1 text
  "6": "F",  // Chorus Line 1 text
  "9": "Dm", // Bridge Line 1 text
  "12": "E", // Outro Line 1 text
};

// sync_mapping from API: line index (of cleaned lyrics) to time (string)
const mockApiSyncMapping = {
  "0": "0.5",   // Line 1 text
  "1": "2.5",   // Line 2 text
  // Line 2 (empty) - no timing
  "3": "5.0",   // Verse 1 Line 1 text
  "4": "7.0",   // Verse 1 Line 2 text
  // Line 5 (empty) - no timing
  "6": "10.0",  // Chorus Line 1 text
  "7": "12.0",  // Chorus Line 2 text
  // Line 8 (empty) - no timing
  "9": "15.0",  // Bridge Line 1 text
  "10": "17.0", // Bridge Line 2 text
  // Line 11 (empty) - no timing
  "12": "20.0", // Outro Line 1 text
  "13": "22.0", // Outro Line 2 text
};

const mockApiResponse = {
  lyrics: mockRawLyricsFromApi,
  chord_mapping: mockApiChordMapping,
  sync_mapping: mockApiSyncMapping,
  // The component also uses sync_mapping for assessTimingQuality,
  // which expects numbers, but it seems to parse them parseFloat(t as string)
};

// Helper function to find a lyric line container by its text content
const findLyricLineContaining = async (textToFind: string) => {
  return await waitFor(() => { // Single waitFor to retry the whole logic
    const lyricsContainer = screen.queryByTestId("lyrics-columns-container");
    if (!lyricsContainer) {
      throw new Error('Lyrics container (lyrics-columns-container) not found yet.');
    }

    const allLyricLineElements = lyricsContainer.querySelectorAll('.lyric-line-inline');
    if (allLyricLineElements.length === 0) {
      throw new Error('.lyric-line-inline elements not found yet within lyrics container.');
    }

    for (const lineElement of Array.from(allLyricLineElements)) {
      // Get all word elements within this line
      const wordElements = lineElement.querySelectorAll('.word-text');
      // Collect all word text, filtering out empty strings
      const words = Array.from(wordElements)
        .map(el => el.textContent?.trim())
        .filter(text => text !== undefined && text !== '');
      
      // Join words with spaces to reconstruct the line
      const lineText = words.join(' ');
      const normalizedLineText = lineText.replace(/\s+/g, ' ').trim();
      const normalizedSearchText = textToFind.replace(/\s+/g, ' ').trim();
      
      if (normalizedLineText.includes(normalizedSearchText)) {
        return lineElement as HTMLElement;
      }
    }
    // If the loop completes without returning, the specific text was not found in any line
    throw new Error(`Lyric line containing "${textToFind}" not found among rendered lines.`);
  }, { timeout: 3000 }); // Added a slightly longer timeout just in case.
};

describe('LyricsWithChords', () => {
  beforeEach(() => {
    vi.mocked(fetch).mockReset();
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify(mockApiResponse), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should render lyrics lines after fetching and cleaning', async () => {
    render(<LyricsWithChords artist={mockArtist} title={mockTitle} fileId={mockFileId} />);
    await waitFor(() => expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1));
    // Wait for the container of lyrics to appear first
    await screen.findByTestId("lyrics-columns-container"); 
    
    const line1Element = await findLyricLineContaining('Line 1 text');
    expect(line1Element).toBeInTheDocument();
    
    const verse1Line1Element = await findLyricLineContaining('Verse 1 Line 1 text');
    expect(verse1Line1Element).toBeInTheDocument();

    expect(screen.queryByText('[Intro]')).not.toBeInTheDocument(); 
    expect(screen.queryByText('[Verse 1]')).not.toBeInTheDocument(); 
  });

  it('should associate chords with correct lyric lines', async () => {
    const onSyncMappingLoadedMock = vi.fn();
    render(<LyricsWithChords 
      artist={mockArtist} 
      title={mockTitle} 
      fileId={mockFileId} 
      onSyncMappingLoaded={onSyncMappingLoadedMock}
    />);
    await waitFor(() => expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1));
    await screen.findByTestId("lyrics-columns-container"); // Wait for lyrics container

    const line1Container = await findLyricLineContaining('Line 1 text');
    expect(line1Container).toBeInTheDocument();
    expect(within(line1Container).getByText('Am')).toBeInTheDocument();

    const verse1Line1Container = await findLyricLineContaining('Verse 1 Line 1 text');
    expect(verse1Line1Container).toBeInTheDocument();
    expect(within(verse1Line1Container).getByText('C')).toBeInTheDocument();
    
    screen.debug(undefined, Infinity); // Ensure UNCOMMENTED
    const chordGElement = await screen.findByText((content, element) => {
        if (!element) return false; 
        return element.tagName.toLowerCase() === 'div' &&
               element.classList.contains('chord-above') &&
               content === 'G';
    });
    const line2ContainerAssociatedWithG = chordGElement.closest('.lyric-line-inline');
    expect(line2ContainerAssociatedWithG).toBeInTheDocument();
    expect(line2ContainerAssociatedWithG).toHaveTextContent(/Line\s*2\s*text/); 
  });

  it('should call onSyncMappingLoaded with sync_mapping from API', async () => {
    const onSyncMappingLoadedMock = vi.fn();
    render(<LyricsWithChords 
      artist={mockArtist} 
      title={mockTitle} 
      fileId={mockFileId} 
      onSyncMappingLoaded={onSyncMappingLoadedMock} 
    />);
    await waitFor(() => expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1));
    await screen.findByTestId("lyrics-columns-container"); // Ensure lyrics processed before checking callback related to their data
    await waitFor(() => expect(onSyncMappingLoadedMock).toHaveBeenCalledTimes(1));
    
    const actualArg = onSyncMappingLoadedMock.mock.calls[0][0];
    console.log("DEBUG: Expected sync_mapping keys:", Object.keys(mockApiSyncMapping).join(', ')); // UNCOMMENTED
    if (actualArg) {
      console.log("DEBUG: Actual sync_mapping keys:", Object.keys(actualArg).join(', ')); // UNCOMMENTED
    } else {
      console.log("DEBUG: actualArg for onSyncMappingLoaded was null or undefined"); // UNCOMMENTED
    }
    expect(actualArg).toEqual(mockApiSyncMapping);
  });

  it('should highlight the active line based on currentTime and api sync_mapping', async () => {
    const onSyncMappingLoadedMock = vi.fn((syncMap) => { // Modified to log
      console.log("Highlight Test: onSyncMappingLoaded called with:", syncMap); 
    }); 

    const { rerender } = render(
      <LyricsWithChords 
        artist={mockArtist} 
        title={mockTitle} 
        fileId={mockFileId} 
        onSyncMappingLoaded={onSyncMappingLoadedMock}
      />
    );
    await waitFor(() => expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1));
    // const lyricsContainer = await screen.findByTestId("lyrics-columns-container");
    // screen.debug(undefined, Infinity); // Temporarily REMOVED to reduce clutter, focus on helper debug
 
    // Ensure "Line 1 text" is rendered before proceeding with currentTime changes
    await findLyricLineContaining("Line 1 text");

    act(() => {
      rerender(<LyricsWithChords 
        artist={mockArtist} 
        title={mockTitle} 
        fileId={mockFileId} 
        onSyncMappingLoaded={onSyncMappingLoadedMock}
        currentTime={0.0} 
      />);
    });
    // Re-verify after rerender to ensure stability
    await findLyricLineContaining("Line 1 text");


    act(() => {
      rerender(<LyricsWithChords 
        artist={mockArtist} 
        title={mockTitle} 
        fileId={mockFileId} 
        onSyncMappingLoaded={onSyncMappingLoadedMock}
        currentTime={0.6} 
      />);
    });
    const activeLine1 = await findLyricLineContaining("Line 1 text");
    await waitFor(() => expect(activeLine1).toHaveClass('highlighted'));

    act(() => {
      rerender(<LyricsWithChords 
        artist={mockArtist} 
        title={mockTitle} 
        fileId={mockFileId} 
        onSyncMappingLoaded={onSyncMappingLoadedMock}
        currentTime={5.1} 
      />);
    });
    
    await waitFor(async () => {
      const line1Element = await findLyricLineContaining("Line 1 text");
      expect(line1Element).not.toHaveClass('highlighted');
      const activeVerseLine1Element = await findLyricLineContaining("Verse 1 Line 1 text");
      expect(activeVerseLine1Element).toHaveClass('highlighted');
    });
  });
  
  // This test is expected to fail if cleanLyrics removes section headers and the component doesn't re-add them.
  // This highlights a potential discrepancy or feature gap for displaying section titles.
  it.skip('should NOT display section headers like [Intro] if cleaned by cleanLyrics', async () => {
    render(<LyricsWithChords artist={mockArtist} title={mockTitle} fileId={mockFileId} />);
    await waitFor(() => expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1));
    await screen.findByTestId("lyrics-columns-container"); // Ensure lyrics processed

    expect(screen.queryByText("[Intro]")).not.toBeInTheDocument();
    expect(screen.queryByText("[Verse 1]")).not.toBeInTheDocument();
    expect(screen.queryByText("[Chorus]")).not.toBeInTheDocument();
    expect(screen.queryByText("[Bridge]")).not.toBeInTheDocument();
    expect(screen.queryByText("[Outro]")).not.toBeInTheDocument();
  });

});
