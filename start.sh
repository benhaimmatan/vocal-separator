#!/bin/bash

# Start FastAPI backend on port 8000
cd /app/backend
uvicorn main:app --host 0.0.0.0 --port 8000 &

# Start nginx on port 7860
nginx -g "daemon off;"
