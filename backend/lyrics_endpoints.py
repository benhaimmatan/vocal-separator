import re
import json
from fastapi import APIRouter, HTTPException
from lyrics_utils import clean_lyrics, get_lyrics_for_song, scrape_lyrics_genius
from pathlib import Path
from typing import Dict
from config import VOCALS_DIR, HISTORY_FILE, logger
from analysis import create_lyric_to_chord_mapping
from pydantic import BaseModel

router = APIRouter()

@router.get("/api/test-lyrics-endpoint")
async def test_lyrics_endpoint():
    return {"message": "Updated lyrics endpoint is working", "version": "2.0"}

class FileLyricsRequest(BaseModel):
    file_id: str

@router.post("/api/file-lyrics")
async def get_file_lyrics(request: FileLyricsRequest):
    """
    Fetch lyrics for a specific file by trying multiple sources.
    Returns the lyrics and chord-to-lyrics mapping for display.
    """
    try:
        # Load the file history to get the file info
        history = None
        file_entry = None
        try:
            history = json.load(open(HISTORY_FILE, "r", encoding="utf-8"))
        except Exception as e:
            logger.error(f"Error loading history: {e}")
            history = {"files": []}

        logger.info(f"Received file-lyrics request for file_id: {request.file_id}")
        
        for entry in history.get("files", []):
            if entry.get("id") == request.file_id:
                file_entry = entry
                break

        if not file_entry:
            raise HTTPException(status_code=404, detail=f"File ID not found: {request.file_id}")

        # Check if lyrics already exist in the file entry
        existing_lyrics = file_entry.get("lyrics")
        if existing_lyrics and isinstance(existing_lyrics, list) and any(l.strip() for l in existing_lyrics):
            logger.info(f"[file-lyrics] Using existing lyrics from file entry: {len(existing_lyrics)} lines")
            lyrics = "\n".join(existing_lyrics)
            lyric_lines = existing_lyrics
            
            # Get stored artist/title or parse from filename
            artist = file_entry.get("lyrics_artist", "")
            title = file_entry.get("lyrics_title", "")
            
            if not artist or not title:
                # Parse from filename as fallback
                directory_name = file_entry.get("directory", "")
                original_name = file_entry.get("originalName", "")
                name = directory_name if directory_name else re.sub(r'\.[^/.]+$', '', original_name)
                
                if "-" in name:
                    parts = name.split("-", 1)
                    artist = parts[0].strip()
                    title = parts[1].strip()
                    
                    # Clean up common suffixes
                    title = re.sub(r'\s*\((Audio|Official Video|Official Music Video|Lyric Video|Live|Acoustic|Remastered|HD|4K)\)\s*$', '', title, flags=re.IGNORECASE)
                    title = re.sub(r'\s*\[(Audio|Official Video|Official Music Video|Lyric Video|Live|Acoustic|Remastered|HD|4K)\]\s*$', '', title, flags=re.IGNORECASE)
                    title = title.strip()
            
            detected_chords = file_entry.get("chords")
            logger.info(f"[file-lyrics] Using existing data - artist: '{artist}', title: '{title}', chords: {len(detected_chords) if detected_chords else 0}")

            # Create chord-to-lyrics mapping for display above lyrics
            lyric_to_chord_mapping = {}
            if lyric_lines and detected_chords:
                lyric_to_chord_mapping = create_lyric_to_chord_mapping(lyric_lines, detected_chords)
                file_entry["lyric_to_chord_mapping"] = lyric_to_chord_mapping

            return {
                "fileId": request.file_id,
                "title": title,
                "artist": artist,
                "lyrics": lyrics,
                "chords": detected_chords or [],
                "lyric_to_chord_mapping": lyric_to_chord_mapping,
                "source": "cached"
            }

        # If no existing lyrics, proceed with fetching new ones
        logger.info(f"[file-lyrics] No existing lyrics found, fetching new ones")

        # Get the original filename and parse artist/title
        # Prioritize directory name over originalName since originalName might have "_vocals" appended
        directory_name = file_entry.get("directory", "")
        original_name = file_entry.get("originalName", "")
        
        logger.debug(f"[file-lyrics] directory_name: '{directory_name}'")
        logger.debug(f"[file-lyrics] original_name: '{original_name}'")
        
        # Try directory name first (cleaner, without _vocals suffix)
        name = directory_name if directory_name else re.sub(r'\.[^/.]+$', '', original_name)
        artist = ""
        title = name
        
        logger.debug(f"[file-lyrics] initial name: '{name}'")

        if "-" in name:
            parts = name.split("-", 1)
            artist = parts[0].strip()
            title = parts[1].strip()
            
            logger.debug(f"[file-lyrics] before cleaning - artist: '{artist}', title: '{title}'")
            
            # Clean up common suffixes that prevent lyrics matching
            title = re.sub(r'\s*\((Audio|Official Video|Official Music Video|Lyric Video|Live|Acoustic|Remastered|HD|4K)\)\s*$', '', title, flags=re.IGNORECASE)
            title = re.sub(r'\s*\[(Audio|Official Video|Official Music Video|Lyric Video|Live|Acoustic|Remastered|HD|4K)\]\s*$', '', title, flags=re.IGNORECASE)
            title = title.strip()
            
            logger.debug(f"[file-lyrics] after cleaning - artist: '{artist}', title: '{title}'")

        # Fallback: try parsing from original filename if directory parsing fails
        if not artist or not title or artist == title:
            name = re.sub(r'\.[^/.]+$', '', original_name)
            if "-" in name:
                parts = name.split("-", 1)
                artist = parts[0].strip()
                title = parts[1].strip()
                
                # Clean up common suffixes that prevent lyrics matching
                title = re.sub(r'\s*\((Audio|Official Video|Official Music Video|Lyric Video|Live|Acoustic|Remastered|HD|4K)\)\s*$', '', title, flags=re.IGNORECASE)
                title = re.sub(r'\s*\[(Audio|Official Video|Official Music Video|Lyric Video|Live|Acoustic|Remastered|HD|4K)\]\s*$', '', title, flags=re.IGNORECASE)
                title = title.strip()

        # Fallback: if still not found, try searching Genius with the full folder name
        lyrics = None
        if not artist or not title or artist == title:
            folder_name = file_entry.get("directory", "")
            logger.info(f"Fallback: searching Genius with folder name: {folder_name}")
            lyrics = scrape_lyrics_genius(folder_name, "")
            if lyrics:
                artist = folder_name
                title = folder_name

        if not artist or not title or artist == title:
            if not lyrics:
                raise HTTPException(
                    status_code=400,
                    detail="Could not parse artist and title from filename or folder name, and Genius search fallback failed"
                )

        # Try to fetch lyrics if not already found
        if lyrics is None:
            lyrics = get_lyrics_for_song(artist, title)

        if lyrics is None:
            logger.error(f"Could not find lyrics for {title} by {artist}")
            raise HTTPException(
                status_code=404,
                detail=f"Could not find lyrics for {title} by {artist}"
            )

        lyrics = clean_lyrics(lyrics)
        lyric_lines = lyrics.split('\n')

        if not lyrics:
            raise HTTPException(
                status_code=404,
                detail=f"Could not find lyrics for {title} by {artist}"
            )

        # Update the file entry with the lyrics
        file_entry["lyrics"] = lyric_lines
        file_entry["lyrics_artist"] = artist
        file_entry["lyrics_title"] = title

        logger.info(f"[file-lyrics] Lyrics lines: {len(lyric_lines)}")

        detected_chords = file_entry.get("chords")
        logger.info(f"[file-lyrics] Detected chords: {len(detected_chords) if detected_chords else 0}")

        # Create chord-to-lyrics mapping for display above lyrics
        lyric_to_chord_mapping = {}
        if lyric_lines and detected_chords:
            lyric_to_chord_mapping = create_lyric_to_chord_mapping(lyric_lines, detected_chords)
            file_entry["lyric_to_chord_mapping"] = lyric_to_chord_mapping

        # Save the updated history
        try:
            with open(HISTORY_FILE, "w", encoding='utf-8') as f:
                json.dump(history, f, ensure_ascii=False, indent=2)
        except Exception as save_error:
            logger.error(f"Error saving lyrics to history: {save_error}")

        return {
            "fileId": request.file_id,
            "title": title,
            "artist": artist,
            "lyrics": lyrics,
            "chords": detected_chords or [],
            "lyric_to_chord_mapping": lyric_to_chord_mapping,
            "source": "genius" if any(ord(c) > 127 for c in artist + title) else "azlyrics"
        }

    except Exception as e:
        logger.error(f"Error fetching lyrics: {str(e)}")
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=str(e)) 