import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Recordings.css';

const Recordings = () => {
  const [recordings, setRecordings] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const { token } = useAuth();

  useEffect(() => {
    const fetchRecordings = async () => {
      try {
        const response = await fetch('/api/sessions', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (!response.ok) {
          throw new Error('Failed to fetch recordings');
        }

        const data = await response.json();
        console.log('Fetched sessions:', data);
        
        // Filter sessions that have recordings
        const recordingsWithData = data.filter(session => session.has_recording);
        console.log('Sessions with recordings:', recordingsWithData);
        
        setRecordings(recordingsWithData);
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
                <p>Date: {new Date(recording.createdAt).toLocaleDateString()}</p>
                <p>Duration: {recording.duration || 'N/A'}</p>
                <p>User: {recording.user?.name || 'Unknown'}</p>
              </div>
              <div className="recording-actions">
                <Link 
                  to={`/recordings/${recording.id}`} 
                  className="action-button view-recording"
                >
                  View Recording
                </Link>
                <Link 
                  to={`/recordings/${recording.id}/heatmap`} 
                  className="action-button view-heatmap"
                >
                  View Heatmap
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Recordings; 