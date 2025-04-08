import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import SessionPlayer from './SessionPlayer';
import './HeatmapViewer.css';

const HeatmapViewer = () => {
  const { id } = useParams();
  console.log('HeatmapViewer initialized with id:', id);
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  
  const [heatmap, setHeatmap] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showPlayer, setShowPlayer] = useState(true); // Add state to control player visibility

  useEffect(() => {
    const fetchHeatmap = async () => {
      console.log('Fetching heatmap data for id:', id);
      try {
        // Fetch heatmap data by ID using the configured api instance
        const response = await api.get(`/api/sessions/${id}/heatmap`);
        console.log('Heatmap data received:', response.data);
        setHeatmap(response.data);
        setError(null);
      } catch (err) {
        console.error('Error fetching heatmap:', err);
        setError('Failed to load heatmap data. The ID may be invalid or the resource does not exist.');
      } finally {
        setLoading(false);
        console.log('Heatmap loading state set to false');
      }
    };

    fetchHeatmap();
  }, [id]);

  // For demo purposes, we'll use a placeholder image and stats
  const placeholderImage = `/api/placeholder.jpg`;
  const placeholderStats = {
    focus_areas: 5,
    attention_score: 78,
    coverage: 0.65,
    avg_fixation_time: '0.8s'
  };

  // Log when component is rendering different sections
  console.log('HeatmapViewer rendering with state:', { loading, error, hasHeatmap: !!heatmap, showPlayer });

  // Toggle player visibility for debugging
  const togglePlayer = () => {
    console.log('Toggling player visibility');
    setShowPlayer(prev => !prev);
  };

  return (
    <div className="heatmap-container">
      <div className="heatmap-header">
        <h1>Heatmap Viewer</h1>
        <button className="back-button" onClick={() => navigate('/dashboard')}>Back to Dashboard</button>
      </div>

      {loading ? (
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading heatmap data...</p>
        </div>
      ) : error ? (
        <div className="error-message">{error}</div>
      ) : (
        <div className="heatmap-content">
          <div className="heatmap-info">
            <h2>Session ID: {id}</h2>
            <p>Created: {new Date().toLocaleString()}</p>
            <p>User: {currentUser?.username}</p>
          </div>

          <div className="heatmap-image-container">
            {heatmap ? (
              <img 
                src={`data:image/png;base64,${heatmap.image}`} 
                alt="Eye tracking heatmap" 
                className="heatmap-image" 
              />
            ) : (
              <img src={placeholderImage} alt="Eye tracking heatmap" className="heatmap-image" />
            )}
          </div>

          <div className="stats-container">
            <h3>Heatmap Statistics</h3>
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-value">{heatmap?.focus_areas || placeholderStats.focus_areas}</div>
                <div className="stat-label">Focus Areas</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{heatmap?.attention_score || placeholderStats.attention_score}%</div>
                <div className="stat-label">Attention Score</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{Math.round((heatmap?.coverage || placeholderStats.coverage) * 100)}%</div>
                <div className="stat-label">Page Coverage</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{heatmap?.avg_fixation_time || placeholderStats.avg_fixation_time}</div>
                <div className="stat-label">Avg. Fixation Time</div>
              </div>
            </div>
          </div>

          <div className="action-buttons">
            <button className="action-button">Download as PNG</button>
            <button className="action-button">Export Data</button>
            <button className="action-button">Generate Report</button>
            <button className="action-button" onClick={togglePlayer}>
              {showPlayer ? 'Hide Player' : 'Show Player'}
            </button>
          </div>

          {showPlayer && (
            <div className="session-player-section">
              <h3>Session Playback</h3>
              {console.log('About to render SessionPlayer with sessionId:', id)}
              <SessionPlayer sessionId={id} />
              {console.log('SessionPlayer rendered')}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default HeatmapViewer; 