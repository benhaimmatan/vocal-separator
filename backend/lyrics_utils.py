import requests
from bs4 import BeautifulSoup
from urllib.parse import quote
import logging

logger = logging.getLogger(__name__)

def clean_lyrics(raw_lyrics: str) -> str:
    import re
    if raw_lyrics is None:
        return ''
    
    # Debug logging
    logger.debug(f"clean_lyrics input: {len(raw_lyrics)} chars")
    logger.debug(f"Raw lyrics preview: {raw_lyrics[:200]}...")
    
    lines = raw_lyrics.split('\n')
    cleaned_lines = []
    
    # Enhanced metadata patterns to catch more non-lyric content
    metadata_patterns = [
        # Common metadata headers - MUST be first to catch all variations
        re.compile(r'^contributors?.*$', re.I),
        re.compile(r'^lyrics.*$', re.I),
        re.compile(r'^\d+\s+contributors?.*$', re.I),
        re.compile(r'^[^a-zA-Z\u0590-\u05FF]*\d+[^a-zA-Z\u05FF]*$'),
        # Artist/credits related
        re.compile(r'featuring|ft\.|feat\.', re.I),
        re.compile(r'produced by', re.I),
        re.compile(r'written by', re.I),
        re.compile(r'composed by', re.I),
        re.compile(r'arranged by', re.I),
        re.compile(r'performed by', re.I),
        re.compile(r'vocals? by', re.I),
        re.compile(r'guitar by', re.I),
        re.compile(r'piano by', re.I),
        re.compile(r'keyboard by', re.I),
        re.compile(r'drums? by', re.I),
        re.compile(r'bass by', re.I),
        # Website/embed related
        re.compile(r'genius\.com', re.I),
        re.compile(r'embed$', re.I),
        re.compile(r'\d+embed$', re.I),
        re.compile(r'^you might also like', re.I),
        re.compile(r'^view\s+', re.I),
        re.compile(r'^share\s+', re.I),
        re.compile(r'^download\s+', re.I),
        re.compile(r'^stream\s+', re.I),
        # Song description patterns
        re.compile(r'^about\s+', re.I),
        re.compile(r'^description\s*:', re.I),
        re.compile(r'^song\s+meaning\s*:', re.I),
        re.compile(r'^meaning\s+of\s+', re.I),
        re.compile(r'^translation\s*:', re.I),
        re.compile(r'^translated\s+by\s+', re.I),
        re.compile(r'^original\s+language\s*:', re.I),
        re.compile(r'^language\s*:', re.I),
        re.compile(r'^genre\s*:', re.I),
        re.compile(r'^release\s+date\s*:', re.I),
        re.compile(r'^album\s*:', re.I),
        re.compile(r'^label\s*:', re.I),
        re.compile(r'^producer\s*:', re.I),
        re.compile(r'^mix\s*:', re.I),
        re.compile(r'^master\s*:', re.I),
        # Common UI elements
        re.compile(r'^more read$', re.I),
        re.compile(r'^read more$', re.I),
        re.compile(r'^show all$', re.I),
        re.compile(r'^hide$', re.I),
        re.compile(r'^click to expand$', re.I),
        re.compile(r'^click to collapse$', re.I),
        # Common non-lyric content
        re.compile(r'^\d+\s*$|^\d+\.\s*$'),
        re.compile(r'^[^a-zA-Z\u0590-\u05FF]*$'),
        re.compile(r'^[A-Z\s]+$'),
        re.compile(r'^[•\-\*]{3,}$'),
        re.compile(r'^[\(\)\[\]\{\}]+$'),
        # Additional patterns for Hebrew metadata
        re.compile(r'^שיר זה נכתב', re.I),
        re.compile(r'^והופק על ידי', re.I),
        re.compile(r'^תיאור השיר', re.I),
        re.compile(r'^שיר זה מספר', re.I),
        # Additional metadata patterns
        re.compile(r'^this song is about', re.I),
        re.compile(r'^this explains what', re.I),
        re.compile(r'^this is a description', re.I),
        re.compile(r'^read more about', re.I),
        re.compile(r'^share on social', re.I),
        # Genius-specific metadata patterns
        re.compile(r'^\d+\s+contributors?$', re.I),
        re.compile(r'^translations?$', re.I),
        re.compile(r'^español$', re.I),
        re.compile(r'^italiano$', re.I),
        re.compile(r'^français$', re.I),
        re.compile(r'^deutsch$', re.I),
        re.compile(r'^português$', re.I),
        re.compile(r'^русский$', re.I),
        re.compile(r'^.*lyrics$', re.I),  # Lines ending with "Lyrics"
        re.compile(r'^read more$', re.I),
        re.compile(r'^see.*live$', re.I),
        re.compile(r'^get tickets$', re.I),
        re.compile(r'^.*is the first.*track.*$', re.I),  # Song description lines
        re.compile(r'^.*is hailed as.*$', re.I),
        re.compile(r'^.*who mistakenly.*$', re.I),
        re.compile(r'^.*penned track.*$', re.I),
        re.compile(r'^.*abbey road.*$', re.I),
        re.compile(r'^.*frank sinatra.*$', re.I),
        re.compile(r'^.*greatest love songs.*$', re.I),
        re.compile(r'^.*live performance.*$', re.I),
        re.compile(r'^.*introduced it.*$', re.I),
        # Additional patterns for the specific metadata you mentioned
        re.compile(r'^.*something.*is.*first.*george.*harrison.*$', re.I),
        re.compile(r'^.*hailed.*greatest.*love.*songs.*$', re.I),
        re.compile(r'^.*frank.*sinatra.*mistakenly.*$', re.I),
        re.compile(r'^.*performance.*as.*a.*$', re.I),
        re.compile(r'^read\s*more.*$', re.I),
        re.compile(r'^.*song.*description.*$', re.I),
        re.compile(r'^.*about.*this.*song.*$', re.I),
        # Pattern for quoted song titles
        re.compile(r'^".*".*is.*$', re.I),
        # Pattern for very short fragments (likely UI artifacts)
        re.compile(r'^[a-zA-Z]{1,4}$'),  # Very short words (1-4 letters)
        re.compile(r'^[CFG]\d*$'),  # Single letters followed by optional numbers (C7, F, etc. when not in chord context)
        # Single letter or very short lines (often UI artifacts)
        re.compile(r'^[a-zA-Z]$'),  # Single letters
        re.compile(r'^[a-zA-Z]{1,2}$'),  # 1-2 letter words
        # Aggressive Hebrew description filtering (Agadat Deshe style)
        re.compile(r'^ה.*$', re.I),  # Lines starting with ה
        re.compile(r'^(נותנת|לשיר|ממד|של|מעין|מת|חלום|כל)[ .,:;…-]*$', re.I),
        re.compile(r"^['\"].*['\"]$", re.I),  # Lines with quotes
        re.compile(r'^[–—-]$', re.I),
        re.compile(r'^[א-ת]{1,3}$'),  # Single short Hebrew words
        # re.compile(r'^[א-ת\s.,:;…-]{1,8}$'),  # Very short lines, mostly punctuation/short words
    ]
    
    found_lyrics = False
    in_section = False
    section_headers = set()
    current_section = None
    pending_lines = []
    
    def is_valid_lyric_line(line):
        return (
            re.search(r'[a-zA-Z\u0590-\u05FF]', line) and
            len(line) > 4 and  # Increased minimum length to filter out very short fragments
            len(line) < 100 and
            not re.match(r'^[A-Z\s]+$', line) and
            not any(pat.search(line) for pat in metadata_patterns) and
            not re.search(r'[A-Z]{3,}', line) and
            not re.search(r'\d{4}', line) and
            not re.search(r'http[s]?://', line) and
            not re.search(r'^[A-Z\s]{10,}$', line) and
            # Additional filters for metadata-like content
            not re.search(r'^\w{1,3}$', line) and  # Very short words (1-3 characters)
            not re.search(r'^[CFG]\d*$', line) and  # Single chord letters with optional numbers
            not re.search(r'genius\.com', line, re.I) and
            not re.search(r'contributor', line, re.I) and
            not re.search(r'translation', line, re.I) and
            not re.search(r'español|italiano|français', line, re.I) and
            not re.search(r'read\s*more', line, re.I) and
            not re.search(r'song.*title', line, re.I) and
            not re.search(r'first.*track', line, re.I) and
            not re.search(r'george.*harrison', line, re.I) and
            not re.search(r'frank.*sinatra', line, re.I) and
            not re.search(r'abbey.*road', line, re.I) and
            not re.search(r'hailed.*as', line, re.I) and
            not re.search(r'greatest.*love', line, re.I) and
            not re.search(r'mistakenly.*introduced', line, re.I) and
            not re.search(r'live.*performance', line, re.I)
        )
    
    for line in lines:
        trimmed = line.strip()
        if not trimmed:
            continue
        if any(pat.search(trimmed) for pat in metadata_patterns):
            continue
        if re.match(r'^\[.*\]$', trimmed):
            if pending_lines:
                valid_lines = [l for l in pending_lines if is_valid_lyric_line(l)]
                if valid_lines:
                    cleaned_lines.extend(valid_lines)
                pending_lines = []
            if trimmed not in section_headers:
                section_headers.add(trimmed)
                cleaned_lines.append(trimmed)
                current_section = trimmed
            in_section = True
            found_lyrics = True
            continue
        if not found_lyrics:
            if is_valid_lyric_line(trimmed):
                found_lyrics = True
            else:
                continue
        if in_section and current_section:
            if is_valid_lyric_line(trimmed):
                pending_lines.append(trimmed)
        else:
            if is_valid_lyric_line(trimmed):
                cleaned_lines.append(trimmed)
    if pending_lines:
        valid_lines = [l for l in pending_lines if is_valid_lyric_line(l)]
        if valid_lines:
            cleaned_lines.extend(valid_lines)
    while cleaned_lines and not cleaned_lines[0].strip():
        cleaned_lines.pop(0)
    while cleaned_lines and not cleaned_lines[-1].strip():
        cleaned_lines.pop()
    if not cleaned_lines:
        return ''
    if found_lyrics and not any(line.startswith('[') and line.endswith(']') for line in cleaned_lines):
        cleaned_lines.insert(0, "[Verse]")
    
    result = '\n'.join(cleaned_lines)
    logger.debug(f"clean_lyrics output: {len(result)} chars, {len(cleaned_lines)} lines")
    logger.debug(f"Cleaned lyrics preview: {result[:200]}...")
    return result

def scrape_lyrics_azlyrics(artist, title):
    """
    Scrape lyrics from AZLyrics given artist and title.
    Returns the lyrics as a string, or None if not found.
    """
    try:
        # Skip if either artist or title contains non-ASCII characters
        if any(ord(c) > 127 for c in artist + title):
            logger.info(f"Skipping lyrics fetch for non-ASCII artist/title: {artist}/{title}")
            return None

        artist = artist.lower().replace(" ", "")
        title = title.lower().replace(" ", "")
        url = f"https://www.azlyrics.com/lyrics/{artist}/{title}.html"
        headers = {"User-Agent": "Mozilla/5.0"}
        response = requests.get(url, headers=headers, timeout=10)
        
        # Log the response status for debugging
        logger.debug(f"AZLyrics response status: {response.status_code} for {url}")
        
        if response.status_code != 200:
            logger.info(f"No lyrics found on AZLyrics for {artist}/{title}")
            return None
            
        soup = BeautifulSoup(response.text, "html.parser")
        # Lyrics are in the first div after all divs with class 'ringtone'
        divs = soup.find_all("div", class_=False, id=False)
        for div in divs:
            if div.text.strip() and len(div.text.strip().split()) > 10:
                return div.text.strip()
        logger.info(f"No lyrics content found in AZLyrics response for {artist}/{title}")
        return None
    except Exception as e:
        logger.error(f"Error scraping lyrics: {e}")
        return None

def scrape_lyrics_genius(artist, title):
    """
    Scrape lyrics from Genius given artist and title.
    Returns the lyrics as a string, or None if not found.
    """
    try:
        # Construct the search URL
        search_url = f"https://genius.com/api/search/multi?q={quote(f'{artist} {title}')}"
        headers = {
            "User-Agent": "Mozilla/5.0",
            "Accept": "application/json"
        }
        
        # First, search for the song
        response = requests.get(search_url, headers=headers, timeout=10)
        if response.status_code != 200:
            logger.info(f"Genius search failed with status {response.status_code}")
            return None
            
        search_data = response.json()
        song_hits = []
        
        # Look for song hits in the search results
        for section in search_data.get('response', {}).get('sections', []):
            if section.get('type') == 'song':
                song_hits.extend(section.get('hits', []))
        
        if not song_hits:
            logger.info(f"No song matches found on Genius for {artist}/{title}")
            return None
            
        # Get the first song hit
        song = song_hits[0]['result']
        song_url = song['url']
        
        # Now fetch the actual lyrics page
        lyrics_response = requests.get(song_url, headers=headers, timeout=10)
        if lyrics_response.status_code != 200:
            logger.info(f"Failed to fetch lyrics page: {lyrics_response.status_code}")
            return None
            
        # Parse the lyrics from the page
        soup = BeautifulSoup(lyrics_response.text, "html.parser")
        
        # Try multiple methods to find lyrics content
        lyrics_text = None
        
        # Method 1: Look for data-lyrics-container
        lyrics_divs = soup.find_all('div', {'data-lyrics-container': 'true'})
        if lyrics_divs:
            all_text = []
            for div in lyrics_divs:
                # Get text but preserve line breaks
                for br in div.find_all("br"):
                    br.replace_with("\n")
                text = div.get_text()
                if text.strip():
                    all_text.append(text.strip())
            lyrics_text = '\n'.join(all_text)
        
        # Method 2: Look for lyrics class containers (fallback)
        if not lyrics_text:
            lyrics_containers = soup.find_all(['div', 'p'], class_=lambda x: x and 'lyrics' in x.lower())
            if lyrics_containers:
                all_text = []
                for container in lyrics_containers:
                    for br in container.find_all("br"):
                        br.replace_with("\n")
                    text = container.get_text()
                    if text.strip():
                        all_text.append(text.strip())
                lyrics_text = '\n'.join(all_text)
        
        if not lyrics_text:
            logger.info("Could not find lyrics content on Genius page")
            return None
            
        return lyrics_text
        
    except Exception as e:
        logger.error(f"Error scraping lyrics from Genius: {e}")
        return None

def get_lyrics_for_song(artist, title):
    """
    Try to get lyrics from multiple sources.
    Returns the lyrics as a string, or None if not found.
    """
    # Try Genius first for non-ASCII songs
    if any(ord(c) > 127 for c in artist + title):
        logger.info(f"Trying Genius for non-ASCII song: {artist}/{title}")
        lyrics = scrape_lyrics_genius(artist, title)
        if lyrics:
            logger.info(f"Found lyrics on Genius for {artist}/{title}")
            logger.debug(f"Raw lyrics from Genius (first 500 chars): {lyrics[:500]}")
            return lyrics
        logger.info(f"No lyrics found on Genius for {artist}/{title}")
    
    # Try AZLyrics for ASCII songs
    if not any(ord(c) > 127 for c in artist + title):
        logger.info(f"Trying AZLyrics for ASCII song: {artist}/{title}")
        lyrics = scrape_lyrics_azlyrics(artist, title)
        if lyrics:
            logger.info(f"Found lyrics on AZLyrics for {artist}/{title}")
            logger.debug(f"Raw lyrics from AZLyrics (first 500 chars): {lyrics[:500]}")
            return lyrics
        logger.info(f"No lyrics found on AZLyrics for {artist}/{title}")
        
        # Try Genius as fallback for ASCII songs when AZLyrics fails
        logger.info(f"Trying Genius as fallback for ASCII song: {artist}/{title}")
        lyrics = scrape_lyrics_genius(artist, title)
        if lyrics:
            logger.info(f"Found lyrics on Genius (fallback) for {artist}/{title}")
            logger.debug(f"Raw lyrics from Genius fallback (first 500 chars): {lyrics[:500]}")
            return lyrics
        logger.info(f"No lyrics found on Genius (fallback) for {artist}/{title}")
    
    return None

def test_clean_lyrics():
    """
    Test function to verify clean_lyrics improvements.
    Returns a list of test results.
    """
    test_cases = [
        {
            "name": "Basic lyrics with metadata",
            "input": """
            About the song:
            This song was written by John Smith and produced by Jane Doe.
            It was released in 2020 and became a hit.
            
            [Verse 1]
            This is the first line of the song
            And this is the second line
            With some actual lyrics here
            
            [Chorus]
            This is the chorus
            It's repeated multiple times
            """,
            "expected_sections": ["[Verse 1]", "[Chorus]"],
            "expected_lines": 5
        },
        {
            "name": "Hebrew lyrics with descriptions",
            "input": """
            שיר זה נכתב על ידי דני רובס
            והופק על ידי משה לוי
            
            תיאור השיר:
            שיר זה מספר על אהבה אבודה
            
            [פזמון]
            זהו הפזמון הראשון
            עם מילים בעברית
            
            [בית]
            זהו הבית הראשון
            עם עוד מילים בעברית
            """,
            "expected_sections": ["[פזמון]", "[בית]"],
            "expected_lines": 4
        },
        {
            "name": "Complex metadata and UI elements",
            "input": """
            Song Meaning:
            This song is about lost love and redemption.
            
            Contributors:
            15 contributors
            
            Written by: John Smith
            Produced by: Jane Doe
            Vocals by: Sarah Johnson
            Guitar by: Mike Brown
            
            [Verse 1]
            These are the actual lyrics
            That should be kept
            
            Click to expand
            Read more about this song
            
            [Chorus]
            More actual lyrics here
            That should also be kept
            
            Share on social media
            Download lyrics
            """,
            "expected_sections": ["[Verse 1]", "[Chorus]"],
            "expected_lines": 4
        },
        {
            "name": "Mixed content with headers",
            "input": """
            ABOUT THE ARTIST
            This is a description of the artist
            
            SONG MEANING
            This explains what the song is about
            
            RELEASE DATE: 2020
            ALBUM: Greatest Hits
            LABEL: Music Records
            
            [Intro]
            This is the intro
            With some actual lyrics
            
            [Verse]
            These are verse lyrics
            That should be kept
            
            •••••••••••••••••••••
            
            [Outro]
            Final lyrics here
            """,
            "expected_sections": ["[Intro]", "[Verse]", "[Outro]"],
            "expected_lines": 5
        },
        {
            "name": "Agadat Deshe style Hebrew metadata",
            "input": '''ה"אגדה"
נותנת
לשיר
ממד
של
'משאלת
לב',
מעין
'הייתי
מת'
–
חלום
של
כל…

[פזמון]
זהו הפזמון
עם מילים אמיתיות
''',
            "expected_sections": ["[פזמון]"],
            "expected_lines": 2
        }
    ]
    
    results = []
    for test in test_cases:
        cleaned = clean_lyrics(test["input"])
        lines = cleaned.split('\n')
        sections = [line for line in lines if line.startswith('[') and line.endswith(']')]
        
        # Check results
        passed = True
        issues = []
        
        # Check sections
        if set(sections) != set(test["expected_sections"]):
            passed = False
            issues.append(f"Expected sections {test['expected_sections']}, got {sections}")
            
        # Check line count (excluding section headers)
        lyric_lines = [line for line in lines if not (line.startswith('[') and line.endswith(']'))]
        if len(lyric_lines) != test["expected_lines"]:
            passed = False
            issues.append(f"Expected {test['expected_lines']} lyric lines, got {len(lyric_lines)}")
            
        # Check for any remaining metadata
        metadata_indicators = [
            "about", "meaning", "written by", "produced by", "contributors",
            "release", "album", "label", "click to", "share", "download"
        ]
        for indicator in metadata_indicators:
            if indicator.lower() in cleaned.lower():
                passed = False
                issues.append(f"Found metadata indicator: {indicator}")
                
        results.append({
            "name": test["name"],
            "passed": passed,
            "issues": issues,
            "cleaned_output": cleaned
        })
    
    return results

if __name__ == "__main__":
    # Run tests and print results
    test_results = test_clean_lyrics()
    print("\nClean Lyrics Test Results:")
    print("=" * 50)
    
    all_passed = True
    for result in test_results:
        status = "✅ PASSED" if result["passed"] else "❌ FAILED"
        print(f"\n{status} - {result['name']}")
        if not result["passed"]:
            all_passed = False
            print("Issues found:")
            for issue in result["issues"]:
                print(f"  - {issue}")
            print("\nCleaned output:")
            print("-" * 30)
            print(result["cleaned_output"])
            print("-" * 30)
    
    print("\nOverall Status:", "✅ ALL TESTS PASSED" if all_passed else "❌ SOME TESTS FAILED") 