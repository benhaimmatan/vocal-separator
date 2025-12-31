import streamlit as st
import os
from backend.supabase_client import get_supabase_client
from backend.lyrics_utils import get_lyrics_for_song

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
        st.info("Running in demo mode without authentication")
        st.session_state.supabase = None

def authenticate_user():
    """Handle user authentication"""
    st.title("🎵 Vocal Separator Pro")
    
    # Always show demo mode option prominently
    st.info("💡 **Quick Start**: Skip login and try the app immediately!")
    if st.button("🚀 **Try Demo Mode**", type="primary"):
        st.session_state.authenticated = True
        st.session_state.user = {"email": "demo@example.com", "id": "demo"}
        st.rerun()
    
    st.markdown("---")
    
    if not st.session_state.supabase:
        st.warning("Authentication disabled - Supabase not configured")
        return
    
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

def main_app():
    """Main application interface"""
    st.title("🎵 Vocal Separator Pro")
    
    # Sidebar with user info
    with st.sidebar:
        user_email = st.session_state.user.get('email', 'demo@example.com')
        st.write(f"Welcome, {user_email}")
        
        if st.button("Sign Out"):
            if st.session_state.supabase:
                st.session_state.supabase.auth.sign_out()
            st.session_state.authenticated = False
            st.session_state.user = None
            st.rerun()
        
        st.markdown("---")
        st.markdown("### Coming Soon")
        st.markdown("🚀 GPU-accelerated vocal separation")
        st.markdown("🎸 Advanced chord detection")
        st.markdown("✅ Lyrics fetching")
        st.markdown("📊 Cloud storage & history")
    
    # Main interface
    tab1, tab2 = st.tabs(["📝 Lyrics Search", "ℹ️ About"])
    
    with tab1:
        st.header("Lyrics Search")
        st.write("Find lyrics for any song.")
        
        col1, col2 = st.columns(2)
        
        with col1:
            artist = st.text_input("Artist Name")
        with col2:
            song = st.text_input("Song Title")
        
        if st.button("📝 Get Lyrics") and artist and song:
            fetch_lyrics(artist, song)
    
    with tab2:
        st.header("About Vocal Separator Pro")
        
        st.markdown("""
        ### Modern Architecture
        
        This app uses a cutting-edge stack:
        
        - **Frontend**: Streamlit (deployed on HuggingFace Spaces)
        - **Database**: Supabase (PostgreSQL + Auth)
        - **GPU Processing**: Modal.com (for heavy audio processing)
        
        ### Features (Coming Soon)
        
        1. **GPU-Accelerated Processing**: Audio separation in 30 seconds vs 5+ minutes on CPU
        2. **Professional Authentication**: Real user accounts with forgot password, Google login
        3. **Scalable Database**: PostgreSQL with proper relationships and job tracking  
        4. **Cost Effective**: $0/month for typical usage
        
        ### Current Status
        
        The app is currently in **Phase 1** - basic deployment with authentication and lyrics search.
        
        **Phase 2** will add:
        - Modal.com GPU integration for vocal separation
        - Advanced chord detection
        - File upload and processing
        - Job tracking and history
        """)

def fetch_lyrics(artist, song):
    """Fetch lyrics for a song"""
    with st.spinner("Fetching lyrics..."):
        try:
            lyrics = get_lyrics_for_song(artist, song)
            
            if lyrics and len(lyrics.strip()) > 10:
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
            else:
                st.warning("No lyrics found for this song. Try checking the spelling or try a different song.")
                
        except Exception as e:
            st.error(f"Unable to fetch lyrics. This might be due to:")
            st.write("- Network issues")
            st.write("- Website blocking requests") 
            st.write("- Song not found")
            st.write(f"Technical details: {str(e)[:100]}...")
            
            # Suggest fallback
            st.info("💡 Try searching for lyrics manually on Google or other lyrics sites.")

# Main application logic
if not st.session_state.authenticated:
    authenticate_user()
else:
    main_app()