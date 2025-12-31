import React, { useState, useEffect } from 'react';
import { X, Clock, CheckCircle, XCircle, RefreshCw, Music, FileText, Activity } from 'lucide-react';

const JobHistoryModal = ({ isOpen, onClose, authToken }) => {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen && authToken) {
      fetchJobs();
    }
  }, [isOpen, authToken]);

  const fetchJobs = async () => {
    setLoading(true);
    setError('');
    
    try {
      const response = await fetch('/api/user/jobs', {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      
      const data = await response.json();
      
      if (data.success) {
        setJobs(data.jobs || []);
      } else {
        setError('Failed to load job history');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getJobIcon = (jobType) => {
    switch (jobType) {
      case 'vocal_separation':
        return Activity;
      case 'chord_detection':
        return Music;
      case 'lyrics':
        return FileText;
      default:
        return Clock;
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed':
        return CheckCircle;
      case 'failed':
        return XCircle;
      case 'processing':
        return RefreshCw;
      default:
        return Clock;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed':
        return 'text-emerald-400';
      case 'failed':
        return 'text-red-400';
      case 'processing':
        return 'text-yellow-400';
      default:
        return 'text-zinc-400';
    }
  };

  const formatJobType = (jobType) => {
    switch (jobType) {
      case 'vocal_separation':
        return 'Vocal Separation';
      case 'chord_detection':
        return 'Chord Detection';
      case 'lyrics':
        return 'Lyrics Search';
      default:
        return jobType;
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-zinc-900 rounded-2xl border border-zinc-700 p-6 w-full max-w-2xl mx-4 max-h-[80vh] shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-zinc-100">Processing History</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="overflow-y-auto max-h-[60vh]">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {error && (
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          {!loading && !error && jobs.length === 0 && (
            <div className="text-center py-12 text-zinc-400">
              <Clock size={48} className="mx-auto mb-4 opacity-50" />
              <p>No processing jobs yet</p>
              <p className="text-sm">Your job history will appear here after processing files</p>
            </div>
          )}

          {!loading && jobs.length > 0 && (
            <div className="space-y-3">
              {jobs.map((job) => {
                const JobIcon = getJobIcon(job.job_type);
                const StatusIcon = getStatusIcon(job.status);
                const statusColor = getStatusColor(job.status);

                return (
                  <div key={job.id} className="bg-zinc-800/50 border border-zinc-700/50 rounded-lg p-4 hover:bg-zinc-800/70 transition-colors">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-lg bg-violet-500/20 text-violet-400 flex items-center justify-center flex-shrink-0">
                        <JobIcon size={20} />
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-sm font-medium text-zinc-100">
                            {formatJobType(job.job_type)}
                          </h3>
                          <div className={`flex items-center gap-1 ${statusColor}`}>
                            <StatusIcon size={14} className={job.status === 'processing' ? 'animate-spin' : ''} />
                            <span className="text-xs capitalize">{job.status}</span>
                          </div>
                        </div>
                        
                        {job.metadata?.original_filename && (
                          <p className="text-sm text-zinc-400 truncate">
                            {job.metadata.original_filename}
                          </p>
                        )}
                        
                        {job.metadata?.parameters && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {Object.entries(job.metadata.parameters).map(([key, value]) => (
                              <span key={key} className="px-2 py-1 bg-zinc-700/50 rounded text-xs text-zinc-300">
                                {key}: {value.toString()}
                              </span>
                            ))}
                          </div>
                        )}
                        
                        <p className="text-xs text-zinc-500 mt-2">
                          {formatDate(job.created_at)}
                        </p>
                      </div>
                    </div>

                    {job.status === 'failed' && job.metadata?.error_message && (
                      <div className="mt-3 pt-3 border-t border-zinc-700/50">
                        <p className="text-sm text-red-400">
                          Error: {job.metadata.error_message}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {jobs.length > 0 && (
          <div className="mt-6 pt-6 border-t border-zinc-700 flex justify-center">
            <button
              onClick={fetchJobs}
              disabled={loading}
              className="px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200 transition-colors disabled:opacity-50"
            >
              <RefreshCw size={16} className={`inline mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default JobHistoryModal;