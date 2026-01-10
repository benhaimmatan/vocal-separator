# FastAPI + React deployment - Optimized for Railway
# Compatible with: Railway, Render, Fly.io, Google Cloud Run, HuggingFace Spaces
# Build v2.3.9 - 2026-01-09 - Optimized image size (target: <4GB)
FROM node:18-slim AS frontend-builder

WORKDIR /app/frontend

# Copy frontend files
COPY frontend/package*.json ./
RUN npm cache clean --force && npm install

COPY frontend/ ./
# Force fresh build without cache (remove any existing dist)
RUN rm -rf dist && npm run build && echo "Frontend build timestamp: 2026-01-09-Railway-optimized" > dist/.build-timestamp

# Python backend stage - Optimized
FROM python:3.10-slim

WORKDIR /app

# Install system dependencies in one layer and clean up aggressively
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    libsndfile1 \
    nginx \
    curl \
    sed \
    gcc \
    g++ \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/* \
    && rm -rf /tmp/* /var/tmp/*

# Copy Python requirements and install with aggressive optimization
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt \
    && find /usr/local/lib/python3.10 -type d -name "tests" -exec rm -rf {} + 2>/dev/null || true \
    && find /usr/local/lib/python3.10 -type d -name "test" -exec rm -rf {} + 2>/dev/null || true \
    && find /usr/local/lib/python3.10 -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true \
    && find /usr/local/lib/python3.10 -name "*.pyc" -delete \
    && find /usr/local/lib/python3.10 -name "*.pyo" -delete \
    && rm -rf /root/.cache/pip \
    && rm -rf /tmp/* /var/tmp/*

# Copy backend files and modal functions
COPY backend/ ./backend/
COPY modal_functions.py ./
COPY --from=frontend-builder /app/frontend/dist ./static/

# Copy nginx config
COPY nginx.conf /etc/nginx/nginx.conf

# Create simple, robust startup script
RUN echo '#!/bin/bash\n\
set -e\n\
export PORT=${PORT:-7860}\n\
echo "=== Vocal Separator Starting ==="\n\
echo "PORT: $PORT"\n\
echo "Configuring nginx..."\n\
sed -i "s/listen 7860;/listen $PORT;/" /etc/nginx/nginx.conf\n\
echo "Testing nginx configuration..."\n\
nginx -t\n\
echo "Starting nginx..."\n\
nginx\n\
sleep 2\n\
echo "Starting FastAPI backend..."\n\
cd /app\n\
export PYTHONPATH=/app:/app/backend\n\
exec python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000' > /app/start.sh

RUN chmod +x /app/start.sh

# Final cleanup to minimize image size
RUN apt-get remove -y gcc g++ \
    && apt-get autoremove -y \
    && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/* /root/.cache

# Expose port 7860 (HuggingFace default)
# Railway/Render will auto-detect from nginx config
EXPOSE 7860

# Health check for Railway/platforms that support it
# Uses PORT environment variable (Railway provides this)
HEALTHCHECK --interval=30s --timeout=10s --start-period=120s --retries=5 \
  CMD curl -f http://localhost:${PORT:-7860}/api/health || exit 1

CMD ["/app/start.sh"]