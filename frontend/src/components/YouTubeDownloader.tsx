import React, { useState } from 'react';
import { OutputOptions } from '../types';
import './YouTubeDownloader.css';
import { FaYoutube } from 'react-icons/fa';

interface YouTubeDownloaderProps {
  onDownloadComplete: (result: any) => void;
  outputOptions: OutputOptions;
  disabled: boolean;
}

const YouTubeDownloader: React.FC<YouTubeDownloaderProps> = ({ 
  onDownloadComplete, 
  outputOptions,
  disabled 
}) => {
  const [url, setUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDownload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url) {
      setError('Please enter a YouTube URL');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Create form data for the API request
      const formData = new FormData();
      formData.append('url', url);
      formData.append('output_options', JSON.stringify(outputOptions));

      const response = await fetch('http://localhost:8000/api/download-youtube', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to download from YouTube');
      }

      const result = await response.json();
      onDownloadComplete(result);
      setUrl('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="youtube-downloader">
      <h3>
        <FaYoutube className="youtube-icon" /> Download from YouTube
      </h3>
      <form onSubmit={handleDownload}>
        <div className="url-input-container">
          <input
            type="text"
            placeholder="Enter YouTube URL"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            disabled={disabled || isLoading}
          />
          <button 
            type="submit" 
            disabled={disabled || isLoading || !url}
            className="download-button"
          >
            {isLoading ? 'Downloading...' : 'Download'}
          </button>
        </div>
        {error && <div className="error-message">{error}</div>}
      </form>
    </div>
  );
};

export default YouTubeDownloader; 