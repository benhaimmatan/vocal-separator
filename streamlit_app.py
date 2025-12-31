import streamlit as st
import os
import tempfile
from pathlib import Path
import time
import json
from backend.supabase_client import get_supabase_client
from backend.modal_gpu import process_audio_on_modal, detect_chords_on_modal
from backend.lyrics_utils import get_lyrics
import modal

# Page configuration
st.set_page_config(
    page_title="Vocal Separator Pro",
    page_icon="🎵",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Initialize session state
if 'authenticated' not in st.session_state:
    st.session_state.authenticated = False
if 'user' not in st.session_state:
    st.session_state.user = None
if 'supabase' not in st.session_state:
    try:
        st.session_state.supabase = get_supabase_client()
    except Exception as e:
        st.error(f"Failed to connect to Supabase: {e}")
        st.stop()

def authenticate_user():
    """Handle user authentication"""
    st.title("🎵 Vocal Separator Pro")
    st.subheader("Sign in to get started")
    
    tab1, tab2 = st.tabs(["Sign In", "Sign Up"])
    
    with tab1:
        with st.form("signin_form"):
            email = st.text_input("Email")
            password = st.text_input("Password", type="password")
            signin_button = st.form_submit_button("Sign In")
            
            if signin_button and email and password:
                try:
                    response = st.session_state.supabase.auth.sign_in_with_password({
                        "email": email,
                        "password": password
                    })
                    
                    if response.user:
                        st.session_state.authenticated = True
                        st.session_state.user = response.user
                        st.success("Successfully signed in!")
                        st.rerun()
                except Exception as e:
                    st.error(f"Sign in failed: {e}")
    
    with tab2:
        with st.form("signup_form"):
            email = st.text_input("Email", key="signup_email")
            password = st.text_input("Password", type="password", key="signup_password")
            confirm_password = st.text_input("Confirm Password", type="password")
            signup_button = st.form_submit_button("Sign Up")
            
            if signup_button and email and password:
                if password != confirm_password:
                    st.error("Passwords don't match")
                    return
                
                try:
                    response = st.session_state.supabase.auth.sign_up({
                        "email": email,
                        "password": password
                    })
                    
                    if response.user:
                        st.success("Account created! Please check your email to verify.")
                except Exception as e:
                    st.error(f"Sign up failed: {e}")

def create_processing_job(job_type: str, input_file_name: str) -> str:
    """Create a new processing job in the database"""
    try:
        result = st.session_state.supabase.table("processing_jobs").insert({
            "user_id": st.session_state.user.id,
            "job_type": job_type,
            "status": "pending",
            "metadata": {"input_file_name": input_file_name}
        }).execute()
        
        return result.data[0]["id"]
    except Exception as e:
        st.error(f"Failed to create job: {e}")
        return None

def update_job_status(job_id: str, status: str, output_files: dict = None):
    """Update job status and results"""
    try:
        update_data = {"status": status, "updated_at": "now()"}
        if output_files:
            update_data["output_files"] = output_files
        
        st.session_state.supabase.table("processing_jobs").update(update_data).eq("id", job_id).execute()
    except Exception as e:
        st.error(f"Failed to update job: {e}")

def main_app():
    """Main application interface"""
    st.title("🎵 Vocal Separator Pro")
    
    # Sidebar with user info
    with st.sidebar:
        st.write(f"Welcome, {st.session_state.user.email}")
        if st.button("Sign Out"):
            st.session_state.supabase.auth.sign_out()
            st.session_state.authenticated = False
            st.session_state.user = None
            st.rerun()
        
        st.markdown("---")
        st.markdown("### Features")
        st.markdown("✅ GPU-accelerated vocal separation")
        st.markdown("✅ Advanced chord detection")
        st.markdown("✅ Lyrics fetching")
        st.markdown("✅ Cloud storage & history")
    
    # Main interface
    tab1, tab2, tab3, tab4 = st.tabs(["🎤 Vocal Separation", "🎸 Chord Detection", "📝 Lyrics", "📊 My Jobs"])
    
    with tab1:
        st.header("Vocal Separation")
        st.write("Upload an audio file to separate vocals from instruments using GPU acceleration.")
        
        uploaded_file = st.file_uploader(
            "Choose an audio file",
            type=['mp3', 'wav', 'flac', 'm4a', 'ogg'],
            help="Supported formats: MP3, WAV, FLAC, M4A, OGG"
        )
        
        if uploaded_file:
            col1, col2 = st.columns(2)
            
            with col1:
                st.audio(uploaded_file, format="audio/wav")
                
            with col2:
                model_choice = st.selectbox(
                    "Separation Model",
                    ["htdemucs", "htdemucs_6s"],
                    help="htdemucs: 4 sources (vocals, drums, bass, other)\nhtdemucs_6s: 6 sources (+ piano, guitar)"
                )
                
                if st.button("🚀 Separate Vocals (GPU)", type="primary"):
                    process_vocal_separation(uploaded_file, model_choice)
    
    with tab2:
        st.header("Chord Detection")
        st.write("Detect chords in your audio with timestamps.")
        
        uploaded_file = st.file_uploader(
            "Choose an audio file",
            type=['mp3', 'wav', 'flac', 'm4a', 'ogg'],
            key="chord_upload"
        )
        
        if uploaded_file:
            st.audio(uploaded_file, format="audio/wav")
            
            if st.button("🎸 Detect Chords", type="primary"):
                process_chord_detection(uploaded_file)
    
    with tab3:
        st.header("Lyrics Search")
        st.write("Find lyrics for any song.")
        
        col1, col2 = st.columns(2)
        
        with col1:
            artist = st.text_input("Artist Name")
        with col2:
            song = st.text_input("Song Title")
        
        if st.button("📝 Get Lyrics") and artist and song:
            fetch_lyrics(artist, song)
    
    with tab4:
        st.header("My Processing Jobs")
        display_user_jobs()

def process_vocal_separation(uploaded_file, model_choice):
    """Process vocal separation using Modal GPU"""
    job_id = create_processing_job("vocal_separation", uploaded_file.name)
    if not job_id:
        return
    
    progress_bar = st.progress(0)
    status_text = st.empty()
    
    try:
        status_text.text("Uploading to GPU...")
        progress_bar.progress(20)
        
        # Convert file to bytes
        audio_data = uploaded_file.read()
        
        status_text.text("Processing on GPU...")
        progress_bar.progress(40)
        
        # Call Modal function
        update_job_status(job_id, "processing")
        result = process_audio_on_modal(audio_data, uploaded_file.name, model_choice)
        
        progress_bar.progress(80)
        status_text.text("Preparing downloads...")
        
        # Create download links
        if result:
            st.success("✅ Separation complete!")
            
            output_files = {}
            for source, audio_bytes in result.items():
                output_files[source] = len(audio_bytes)  # Store file size for reference
                
                st.download_button(
                    label=f"Download {source.title()}",
                    data=audio_bytes,
                    file_name=f"{Path(uploaded_file.name).stem}_{source}.wav",
                    mime="audio/wav"
                )
            
            update_job_status(job_id, "completed", output_files)
            
        progress_bar.progress(100)
        
    except Exception as e:
        st.error(f"Processing failed: {e}")
        update_job_status(job_id, "failed")

def process_chord_detection(uploaded_file):
    """Process chord detection"""
    job_id = create_processing_job("chord_detection", uploaded_file.name)
    if not job_id:
        return
    
    with st.spinner("Detecting chords..."):
        try:
            audio_data = uploaded_file.read()
            result = detect_chords_on_modal(audio_data, uploaded_file.name)
            
            if result and 'chords' in result:
                st.success("✅ Chord detection complete!")
                
                # Display chord progression
                st.subheader("Detected Chords")
                
                chords_data = []
                for chord_info in result['chords'][:50]:  # Show first 50 chords
                    chords_data.append({
                        "Time": f"{chord_info['time']:.1f}s",
                        "Chord": chord_info['chord'],
                        "Confidence": f"{chord_info['confidence']:.2f}"
                    })
                
                st.dataframe(chords_data, use_container_width=True)
                
                # Download button for full results
                st.download_button(
                    "Download Full Chord Data (JSON)",
                    data=json.dumps(result, indent=2),
                    file_name=f"{Path(uploaded_file.name).stem}_chords.json",
                    mime="application/json"
                )
                
                update_job_status(job_id, "completed", {"chords_count": len(result['chords'])})
                
        except Exception as e:
            st.error(f"Chord detection failed: {e}")
            update_job_status(job_id, "failed")

def fetch_lyrics(artist, song):
    """Fetch lyrics for a song"""
    job_id = create_processing_job("lyrics", f"{artist} - {song}")
    
    with st.spinner("Fetching lyrics..."):
        try:
            lyrics = get_lyrics(song, artist)
            
            if lyrics:
                st.success("✅ Lyrics found!")
                
                # Display lyrics in a nice format
                st.subheader(f"{song} by {artist}")
                st.text_area("Lyrics", lyrics, height=400)
                
                # Download button
                st.download_button(
                    "Download Lyrics (TXT)",
                    data=lyrics,
                    file_name=f"{artist} - {song}.txt",
                    mime="text/plain"
                )
                
                update_job_status(job_id, "completed", {"lyrics_length": len(lyrics)})
            else:
                st.warning("No lyrics found for this song.")
                update_job_status(job_id, "failed")
                
        except Exception as e:
            st.error(f"Failed to fetch lyrics: {e}")
            update_job_status(job_id, "failed")

def display_user_jobs():
    """Display user's processing history"""
    try:
        response = st.session_state.supabase.table("processing_jobs").select("*").eq("user_id", st.session_state.user.id).order("created_at", desc=True).limit(20).execute()
        
        if response.data:
            jobs_data = []
            for job in response.data:
                jobs_data.append({
                    "Type": job["job_type"].replace("_", " ").title(),
                    "Status": job["status"].title(),
                    "Created": job["created_at"][:19].replace("T", " "),
                    "Input": job.get("metadata", {}).get("input_file_name", "Unknown")
                })
            
            st.dataframe(jobs_data, use_container_width=True)
        else:
            st.info("No jobs yet. Upload a file to get started!")
            
    except Exception as e:
        st.error(f"Failed to load jobs: {e}")

# Main application logic
if not st.session_state.authenticated:
    authenticate_user()
else:
    main_app()