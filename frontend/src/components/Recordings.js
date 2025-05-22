import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import './Recordings.css';

const Recordings = () => {
  const [recordings, setRecordings] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const { token } = useAuth();

  useEffect(() => {
    const fetchRecordings = async () => {
      try {
        const response = await api.get('/api/sessions');
        
        const data = response.data;
        console.log('Fetched sessions:', data);
        
        // Filter sessions that have recordings
        const recordingsWithData = data.filter(session => session.has_recording);
        console.log('Sessions with recordings:', recordingsWithData);
        
        // Process the recordings to check for cursor data
        const processedRecordings = await Promise.all(
          recordingsWithData.map(async (recording) => {
            try {
              // Check if this session has cursor data
              const cursorResponse = await api.get(`/api/sessions/${recording.id}/cursor`);
              
              if (cursorResponse.status === 200) {
                const cursorData = cursorResponse.data;
                const hasCursorData = cursorData.points && cursorData.points.length > 0;
                return { ...recording, hasCursorData };
              }
              
              return { ...recording, hasCursorData: false };
            } catch (err) {
              console.error(`Error checking cursor data for session ${recording.id}:`, err);
              return { ...recording, hasCursorData: false };
            }
          })
        );
        
        setRecordings(processedRecordings);
      } catch (err) {
        console.error('Error fetching recordings:', err);
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchRecordings();
  }, [token]);

  if (isLoading) {
    return (
      <div className="recordings-container">
        <div className="loading-spinner">Loading recordings...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="recordings-container">
        <div className="error-message">{error}</div>
      </div>
    );
  }

  return (
    <div className="recordings-container">
      <h1>Recordings</h1>
      
      {recordings.length === 0 ? (
        <div className="no-recordings-message">
          <h2>No Recordings Available</h2>
          <p>There are no recordings available at this time.</p>
        </div>
      ) : (
        <div className="recordings-grid">
          {recordings.map(recording => (
            <div key={recording.id} className="recording-card">
              <div className="recording-info">
                <h3>{recording.name || 'Untitled Recording'}</h3>
                <p>Date: {new Date(recording.created_at).toLocaleDateString()}</p>
                <p>Duration: {formatDuration(recording.duration)}</p>
                <p>User: {recording.username || 'Unknown'}</p>
                <div className="recording-tags">
                  <span className="tag gaze-tag">Gaze</span>
                  {recording.hasCursorData && <span className="tag cursor-tag">Cursor</span>}
                </div>
              </div>
              <div className="recording-actions">
                <Link 
                  to={`/recordings/${recording.id}`} 
                  className="action-button view-recording"
                >
                  View Recording
                </Link>
                <div className="heatmap-links">
                  <Link 
                    to={`/recordings/${recording.id}/heatmap?type=gaze`} 
                    className="action-button view-heatmap gaze-heatmap"
                  >
                    Gaze Heatmap
                  </Link>
                  {recording.hasCursorData && (
                    <Link 
                      to={`/recordings/${recording.id}/heatmap?type=cursor`} 
                      className="action-button view-heatmap cursor-heatmap"
                    >
                      Cursor Heatmap
                    </Link>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// Helper function to format duration in seconds to MM:SS
const formatDuration = (seconds) => {
  if (!seconds) return 'N/A';
  
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
};

export default Recordings; 