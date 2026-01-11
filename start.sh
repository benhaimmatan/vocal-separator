#!/bin/bash
set -e

# Railway provides PORT (external), backend runs on different internal port
NGINX_PORT=${PORT:-7860}
BACKEND_PORT=8001

echo "=== Vocal Separator Starting v2.8.0 ==="
echo "Build: 2026-01-11-13:15"
echo "Nginx (external) PORT: $NGINX_PORT"
echo "FastAPI (internal) PORT: $BACKEND_PORT"

echo "Configuring nginx..."
sed -i "s/listen 7860;/listen $NGINX_PORT;/" /etc/nginx/nginx.conf

echo "Testing nginx configuration..."
nginx -t

echo "Starting nginx..."
nginx

echo "Waiting for nginx to start..."
sleep 3

echo "Starting FastAPI backend on port $BACKEND_PORT..."
export PYTHONPATH=/app:/app/backend
exec python -m uvicorn backend.main:app --host 0.0.0.0 --port $BACKEND_PORT
