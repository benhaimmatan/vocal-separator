# FastAPI + React deployment for HuggingFace Spaces
# Build v2.1 - 2026-01-02 15:32 - Force complete frontend rebuild
FROM node:18-slim AS frontend-builder

WORKDIR /app/frontend

# Copy frontend files
COPY frontend/package*.json ./
RUN npm cache clean --force && npm install

COPY frontend/ ./
# Force fresh build without cache (remove any existing dist)
RUN rm -rf dist && npm run build && echo "Frontend build timestamp: 2026-01-02-15:32" > dist/.build-timestamp

# Python backend stage
FROM python:3.10-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    ffmpeg \
    libsndfile1 \
    nginx \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy Python requirements and install
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend files and modal functions
COPY backend/ ./backend/
COPY modal_functions.py ./
COPY --from=frontend-builder /app/frontend/dist ./static/

# Copy nginx config
COPY nginx.conf /etc/nginx/nginx.conf

# Create startup script
RUN echo '#!/bin/bash\n\
# Start nginx in background\n\
nginx &\n\
\n\
# Start FastAPI server\n\
cd /app && PYTHONPATH=/app python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000' > /app/start.sh

RUN chmod +x /app/start.sh

# Expose port 7860 (HuggingFace default)
EXPOSE 7860

CMD ["/app/start.sh"]