import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import './HeatmapViewer.css';

const HeatmapViewer = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  
  const [heatmap, setHeatmap] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchHeatmap = async () => {
      try {
        // Fetch heatmap data by ID
        const response = await axios.get(`/api/heatmap/${id}`);
        setHeatmap(response.data);
        setError(null);
      } catch (err) {
        console.error('Error fetching heatmap:', err);
        setError('Failed to load heatmap data. The ID may be invalid or the resource does not exist.');
      } finally {
        setLoading(false);
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
            <img src={placeholderImage} alt="Eye tracking heatmap" className="heatmap-image" />
          </div>

          <div className="stats-container">
            <h3>Heatmap Statistics</h3>
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-value">{placeholderStats.focus_areas}</div>
                <div className="stat-label">Focus Areas</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{placeholderStats.attention_score}%</div>
                <div className="stat-label">Attention Score</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{Math.round(placeholderStats.coverage * 100)}%</div>
                <div className="stat-label">Page Coverage</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{placeholderStats.avg_fixation_time}</div>
                <div className="stat-label">Avg. Fixation Time</div>
              </div>
            </div>
          </div>

          <div className="action-buttons">
            <button className="action-button">Download as PNG</button>
            <button className="action-button">Export Data</button>
            <button className="action-button">Generate Report</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default HeatmapViewer; 