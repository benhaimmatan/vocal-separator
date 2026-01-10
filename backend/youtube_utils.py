import os
import yt_dlp
import tempfile
import shutil
from pathlib import Path
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from yt_dlp.utils import DownloadError
import logging
from dotenv import load_dotenv

logger = logging.getLogger(__name__)

# Load environment variables from .env file
load_dotenv()

# Debug: Print environment variable status
import sys
YOUTUBE_API_KEY = os.getenv('YOUTUBE_API_KEY')
print(f"[DEBUG] YOUTUBE_API_KEY present: {YOUTUBE_API_KEY is not None}", file=sys.stderr)
print(f"[DEBUG] YOUTUBE_API_KEY length: {len(YOUTUBE_API_KEY) if YOUTUBE_API_KEY else 0}", file=sys.stderr)

# Initialize YouTube API
if not YOUTUBE_API_KEY:
    logger.warning("YOUTUBE_API_KEY not set - YouTube search will not work")
    youtube_api = None
else:
    logger.info(f"YouTube API initialized successfully with key: {YOUTUBE_API_KEY[:10]}...")
    youtube_api = build('youtube', 'v3', developerKey=YOUTUBE_API_KEY)


def search_youtube(query: str, max_results: int = 10) -> dict:
    """
    Search YouTube videos using YouTube Data API v3

    Args:
        query: Search query string
        max_results: Maximum number of results to return (default 10)

    Returns:
        dict with 'success', 'results' (list of video objects), 'error' (optional)

    Raises:
        Exception if API key not configured or quota exceeded
    """
    if not youtube_api:
        return {
            "success": False,
            "error": "YouTube API key not configured"
        }

    try:
        request = youtube_api.search().list(
            q=query,
            part='snippet',
            type='video',
            maxResults=max_results,
            relevanceLanguage='en'
        )
        response = request.execute()

        videos = []
        for item in response['items']:
            # Skip items without videoId (playlists, channels, etc.)
            if 'videoId' not in item['id']:
                logger.warning(f"Skipping item without videoId: {item['id'].get('kind', 'unknown')}")
                continue

            try:
                video = {
                    'id': item['id']['videoId'],
                    'title': item['snippet']['title'],
                    'description': item['snippet']['description'],
                    'thumbnail': item['snippet']['thumbnails']['medium']['url'],
                    'channel': item['snippet']['channelTitle'],
                    'published': item['snippet']['publishedAt']
                }
                videos.append(video)
                logger.info(f"Found video: {video['id']} - {video['title']} ({video['channel']})")
            except KeyError as e:
                logger.warning(f"Skipping item with missing field {e}: {item.get('id', {}).get('videoId', 'unknown')}")
                continue

        return {
            "success": True,
            "results": videos
        }

    except HttpError as e:
        error_msg = str(e)
        if 'quotaExceeded' in error_msg:
            return {
                "success": False,
                "error": "YouTube API quota exceeded. Please try again tomorrow."
            }
        return {
            "success": False,
            "error": f"YouTube API error: {error_msg}"
        }
    except Exception as e:
        logger.error(f"YouTube search error: {e}")
        return {
            "success": False,
            "error": str(e)
        }


def download_youtube_audio(video_id: str, output_dir: str = None) -> dict:
    """
    Download audio from YouTube video using yt-dlp

    Args:
        video_id: YouTube video ID
        output_dir: Directory to save audio file (temp dir if None)

    Returns:
        dict with 'success', 'audio_path', 'duration', 'title', 'error' (optional)
    """
    if output_dir is None:
        output_dir = tempfile.mkdtemp(prefix='youtube_audio_')

    url = f'https://www.youtube.com/watch?v={video_id}'

    ydl_opts = {
        'format': 'bestaudio[ext=m4a]/bestaudio[ext=webm]/bestaudio/best',
        'postprocessors': [{
            'key': 'FFmpegExtractAudio',
            'preferredcodec': 'mp3',
            'preferredquality': '192',
        }],
        'outtmpl': str(Path(output_dir) / '%(id)s.%(ext)s'),
        'quiet': False,  # Show output for debugging
        'no_warnings': False,
        'socket_timeout': 30,
        'nocheckcertificate': True,
        # Try different clients to bypass restrictions
        'extractor_args': {
            'youtube': {
                'player_client': ['android', 'ios', 'web'],
                'skip': ['dash', 'hls']
            }
        },
        # Use age gate bypass
        'age_limit': None,
    }

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=True)

            # Find the downloaded MP3 file
            audio_file = Path(output_dir) / f"{video_id}.mp3"

            if not audio_file.exists():
                return {
                    "success": False,
                    "error": "Audio file not found after download"
                }

            return {
                "success": True,
                "audio_path": str(audio_file),
                "duration": info.get('duration', 0),
                "title": info.get('title', ''),
                "temp_dir": output_dir
            }

    except DownloadError as e:
        error_msg = str(e).lower()

        # Network/DNS errors (HuggingFace Spaces limitation)
        if 'no address associated with hostname' in error_msg or 'errno -5' in error_msg:
            return {
                "success": False,
                "error": "YouTube download is blocked by network restrictions. HuggingFace Spaces may block direct YouTube access. Please upload your audio file directly instead.",
                "error_type": "network_blocked"
            }

        # Connection/timeout errors
        elif 'connection' in error_msg or 'timeout' in error_msg or 'timed out' in error_msg:
            return {
                "success": False,
                "error": "Network connection failed. Please try again or upload your audio file directly.",
                "error_type": "network_error"
            }

        # DRM-protected
        elif 'drm' in error_msg or 'format is not available' in error_msg or 'signature extraction failed' in error_msg:
            return {
                "success": False,
                "error": "This video is DRM-protected and cannot be downloaded. Try searching for:\n• User-uploaded covers\n• Guitar tutorials\n• Karaoke versions\n• Live performances\n\nOfficial music videos are typically protected.",
                "error_type": "drm_protected"
            }

        # Age-restricted
        elif 'age' in error_msg or 'sign in' in error_msg:
            return {
                "success": False,
                "error": "Video is age-restricted and requires authentication",
                "error_type": "age_restricted"
            }

        # Unavailable
        elif 'unavailable' in error_msg or 'deleted' in error_msg:
            return {
                "success": False,
                "error": "Video is unavailable or has been deleted",
                "error_type": "unavailable"
            }

        # Geo-blocked
        elif 'blocked' in error_msg or 'not available' in error_msg:
            return {
                "success": False,
                "error": "Video is not available in your region",
                "error_type": "geo_blocked"
            }

        else:
            return {
                "success": False,
                "error": f"Download failed: {str(e)}",
                "error_type": "unknown"
            }

    except Exception as e:
        logger.error(f"YouTube download error: {e}")
        return {
            "success": False,
            "error": str(e),
            "error_type": "unknown"
        }


def cleanup_temp_directory(temp_dir: str):
    """Safely remove temporary directory and all contents"""
    try:
        if temp_dir and Path(temp_dir).exists():
            shutil.rmtree(temp_dir)
    except Exception as e:
        logger.warning(f"Failed to cleanup temp directory {temp_dir}: {e}")
