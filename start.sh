#!/bin/bash
set -e
export PORT=${PORT:-7860}
echo "=== Vocal Separator Starting v2.7.0 ==="
echo "Build: 2026-01-11-13:00"
echo "PORT: $PORT"
echo "Configuring nginx..."
sed -i "s/listen 7860;/listen $PORT;/" /etc/nginx/nginx.conf
echo "Testing nginx configuration..."
nginx -t
echo "Starting nginx..."
nginx
sleep 2
echo "Starting FastAPI backend..."
export PYTHONPATH=/app:/app/backend
exec python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000
