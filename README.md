# Vocal Separator with Piano Visualizer

A web application for separating vocals, accompaniment, and piano tracks from audio files, with a piano visualizer for MIDI playback.

## Project Structure

- `frontend/`: React frontend application
- `backend/`: FastAPI backend server

## Setup Instructions

### Backend Setup

**Option 1: Using pip (Recommended for Python 3.9 users)**

1. Navigate to the backend directory:
   ```
   cd backend
   ```

2. Create a virtual environment:
   ```
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. Install dependencies:
   ```
   pip install -r requirements.txt
   ```

4. Run the backend server:
   ```
   python main.py
   ```

**Option 2: Using Conda (Recommended for compatibility issues)**

1. Install Anaconda or Miniconda

2. Navigate to the backend directory:
   ```
   cd backend
   ```

3. Create and activate the conda environment:
   ```
   conda env create -f environment.yml
   conda activate vocal-separator
   ```

4. Run the backend server:
   ```
   python main.py
   ```

### Frontend Setup

1. Navigate to the frontend directory:
   ```
   cd frontend
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Start the development server:
   ```
   npm run dev
   ```

4. Open the application in your browser:
   ```
   http://localhost:5173  # or the port shown in the terminal
   ```

## Troubleshooting

### Backend Dependency Issues

If you encounter issues with NumPy/Numba compatibility:

1. Try using the conda environment setup
2. For pip users, install specific compatible versions:
   ```
   pip install numpy==1.23.5 numba==0.56.4
   ```

### Connection Issues

If the frontend cannot connect to the backend:

1. Make sure the backend server is running on port 8000
2. Check that CORS is properly configured in the backend
3. Verify that the frontend is using the correct backend URL (http://localhost:8000)

## Features

- Audio source separation (vocals, accompaniment, piano)
- Library management for processed audio files
- Piano visualization of MIDI files
- Real-time conversion of audio tracks to MIDI

## License

MIT 