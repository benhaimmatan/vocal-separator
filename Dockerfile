# Streamlit deployment for HuggingFace Spaces
FROM python:3.10-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    ffmpeg \
    libsndfile1 \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application files
COPY backend/ ./backend/
COPY streamlit_app.py .
COPY .streamlit/ ./.streamlit/

# Create Streamlit config directory
RUN mkdir -p .streamlit

# Streamlit config for HuggingFace Spaces
RUN echo '[server]' > .streamlit/config.toml && \
    echo 'port = 7860' >> .streamlit/config.toml && \
    echo 'address = "0.0.0.0"' >> .streamlit/config.toml && \
    echo 'headless = true' >> .streamlit/config.toml && \
    echo '[theme]' >> .streamlit/config.toml && \
    echo 'base = "dark"' >> .streamlit/config.toml

# Expose port 7860 (HuggingFace Spaces default)
EXPOSE 7860

# Run Streamlit app
CMD ["streamlit", "run", "streamlit_app.py"]