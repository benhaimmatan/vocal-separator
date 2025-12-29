# Multi-stage build for React + FastAPI on HuggingFace Spaces
FROM node:18-slim AS frontend-builder

WORKDIR /app/frontend

# Copy frontend files
COPY frontend/package*.json ./
RUN npm install

COPY frontend/ ./
RUN npm run build

# Python backend stage
FROM python:3.10-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    ffmpeg \
    libsndfile1 \
    nginx \
    && rm -rf /var/lib/apt/lists/*

# Copy Python requirements and install
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend files
COPY backend/ ./backend/
COPY --from=frontend-builder /app/frontend/dist ./static/

# Copy nginx config
COPY nginx.conf /etc/nginx/nginx.conf

# Expose port 7860 (HuggingFace default)
EXPOSE 7860

# Start script
COPY start.sh .
RUN chmod +x start.sh

CMD ["./start.sh"]
