# Piano Visualizer Backend

This directory contains the backend server code for the Piano Visualizer component.

## Quick Start

1. Make sure you have Python 3.7+ installed
2. Install the required dependencies:

```bash
pip install -r requirements.txt
```

3. Run the mock server:

```bash
python mock_server.py
```

The server will start on port 8001 by default.

## Troubleshooting

### Port already in use (Error 48)

If you see an error like `[Errno 48] error while attempting to bind on address ('0.0.0.0', 8000): address already in use`, it means another process is already using port 8000.

The mock server uses port 8001 by default to avoid this conflict.

### Connection refused errors in the frontend

If you see "Connection refused" errors in the browser console:

1. Make sure the mock server is running
2. Check that it's running on port 8001
3. If you need to run on a different port, update the `backendUrl` in the PianoVisualizer.tsx file

### Package not found errors

If you get errors about missing packages, install them using pip:

```bash
pip install flask flask-cors midiutil
```

## API Endpoints

The mock server provides the following endpoints:

- `GET /api/ping`: Check if the server is running
- `GET /api/library`: Get a list of processed files
- `GET /api/downloads/midi`: List MIDI files in the Downloads folder
- `POST /api/separate`: Mock endpoint for audio separation
- `GET /downloads/{filepath}`: Serve files from Downloads directory
- `GET /audio/{filepath}`: Serve processed audio files

## Mock Mode

If the backend server is not reachable, the Piano Visualizer will automatically switch to "Mock Mode", which provides demo functionality without requiring the backend server. 