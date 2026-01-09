# FastAPI + React deployment
# Compatible with: Railway, Render, Fly.io, Google Cloud Run, HuggingFace Spaces
# Build v2.3.8 - 2026-01-09 - Multi-platform deployment support
FROM node:18-slim AS frontend-builder

WORKDIR /app/frontend

# Copy frontend files
COPY frontend/package*.json ./
RUN npm cache clean --force && npm install

COPY frontend/ ./
# Force fresh build without cache (remove any existing dist)
RUN rm -rf dist && npm run build && echo "Frontend build timestamp: 2026-01-03-YouTube-v2.3" > dist/.build-timestamp

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
cd /app && PYTHONPATH=/app:/app/backend python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000' > /app/start.sh

RUN chmod +x /app/start.sh

# Expose port 7860 (HuggingFace default)
# Railway/Render will auto-detect from nginx config
EXPOSE 7860

# Health check for Railway/platforms that support it
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:7860/api/health || exit 1

CMD ["/app/start.sh"]