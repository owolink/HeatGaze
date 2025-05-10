import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useNavigation } from '../context/NavigationContext';
import api from '../utils/api';
import HeatmapCompareItem from './HeatmapCompareItem';
import './DataAnalysis.css';

// Compact version of MetricCard for comparison view
const CompactMetricCard = ({ label, value, suffix = '', color = '#4a90e2' }) => {
  let dynamicColor = color;
  
  // Simple color coding based on common metric ranges
  if (label === 'KL Divergence') {
    if (value < 0.5) dynamicColor = '#4CAF50';
    else if (value < 1.0) dynamicColor = '#FFC107';
    else dynamicColor = '#F44336';
  } else if (['NSS', 'AUC', 'Similarity', 'Correlation'].includes(label)) {
    if (value > 0.7) dynamicColor = '#4CAF50';
    else if (value > 0.4) dynamicColor = '#FFC107';
    else dynamicColor = '#F44336';
  }
  
  return (
    <div className="compact-stat-card">
      <div className="compact-stat-label">{label}</div>
      <div className="compact-stat-value" style={{ color: dynamicColor }}>{value}{suffix}</div>
    </div>
  );
};

// Compact version of the metrics for comparison view
const CompactMetricsView = ({ stats }) => {
  if (!stats) return <div className="no-metrics">Нет данных метрик</div>;
  
  const metrics = [
    { key: 'kld', label: 'KL Divergence' },
    { key: 'nss', label: 'NSS' },
    { key: 'similarity', label: 'Similarity' },
    { key: 'cc', label: 'Correlation' },
    { key: 'auc', label: 'AUC' },
    { key: 'std_dev', label: 'Std Dev' }
  ];
  
  return (
    <div className="compact-metrics-grid">
      {metrics.map(metric => (
        <CompactMetricCard 
          key={metric.key}
          label={metric.label}
          value={stats[metric.key] !== undefined ? stats[metric.key].toFixed(2) : 'N/A'}
        />
      ))}
    </div>
  );
};

// Compact chart for metrics in comparison view
const CompactMetricsChart = ({ stats }) => {
  if (!stats) return <div className="no-metrics">Нет данных метрик</div>;
  
  const metrics = [
    { key: 'kld', label: 'KLD', max: 2, reversed: true },
    { key: 'nss', label: 'NSS', max: 3 },
    { key: 'similarity', label: 'SIM', max: 1 },
    { key: 'cc', label: 'CC', max: 1 },
    { key: 'auc', label: 'AUC', max: 1 }
  ];
  
  return (
    <div className="compact-metrics-chart">
      {metrics.map(metric => {
        const value = stats[metric.key] || 0;
        const normalizedValue = metric.reversed 
          ? 1 - (value / metric.max) 
          : value / metric.max;
          
        let barColor = '#4a90e2';
        if (normalizedValue > 0.7) barColor = '#4CAF50';
        else if (normalizedValue > 0.4) barColor = '#FFC107';
        else barColor = '#F44336';
        
        return (
          <div className="compact-chart-row" key={metric.key}>
            <div className="compact-chart-label">{metric.label}</div>
            <div className="compact-chart-bar-container">
              <div 
                className="compact-chart-bar" 
                style={{ 
                  width: `${Math.min(100, (value / metric.max) * 100)}%`,
                  backgroundColor: barColor
                }}
              />
              <span className="compact-chart-value">{value.toFixed(2)}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
};

const DataAnalysis = () => {
  const { currentUser } = useAuth();
  const { showNav } = useNavigation();
  const navigate = useNavigate();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedHeatmaps, setSelectedHeatmaps] = useState([null, null]);
  const [showSelector, setShowSelector] = useState(false);
  const [currentSlotIndex, setCurrentSlotIndex] = useState(null);

  useEffect(() => {
    showNav();
    fetchSessions();
  }, [showNav]);

  const fetchSessions = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get('/api/sessions');
      setSessions(response.data);
    } catch (err) {
      console.error('Error fetching sessions:', err);
      setError('Не удалось загрузить сессии. Пожалуйста, попробуйте позже.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddHeatmap = (index) => {
    setCurrentSlotIndex(index);
    setShowSelector(true);
  };

  const handleSelectSession = async (session) => {
    try {
      // First get basic session info
      const sessionResponse = await api.get(`/api/sessions/${session.id}`);
      
      // Request combined view to get both gaze and cursor data
      const response = await api.get(`/api/sessions/${session.id}/heatmap?type=combined`);
      
      // Extract gaze heatmap (default)
      const gazeHeatmapUrl = response.data.image 
        ? `data:image/png;base64,${response.data.image}` 
        : null;
      
      // Extract cursor heatmap
      const cursorHeatmapUrl = response.data.cursorHeatmapUrl 
        ? `data:image/png;base64,${response.data.cursorHeatmapUrl}` 
        : null;
      
      // Prepare both stats
      const gazeStats = response.data.stats || {};
      const cursorStats = response.data.cursorStats || {
        kld: 0,
        nss: 0,
        similarity: 0,
        cc: 0,
        auc: 0,
        std_dev: 0
      };
      
      // Try to find video URL from different potential sources
      let videoUrl = null;
      
      // Check if there's a video_url in the session data
      if (sessionResponse.data && sessionResponse.data.video_url) {
        videoUrl = sessionResponse.data.video_url;
      }
      // Check if there's a recording_url field
      else if (sessionResponse.data && sessionResponse.data.recording_url) {
        videoUrl = sessionResponse.data.recording_url;
      }
      // Check if the heatmap response contains a videoUrl field
      else if (response.data && response.data.videoUrl) {
        videoUrl = response.data.videoUrl;
      }
      
      console.log("Found video URL:", videoUrl);
      
      // Fetch gaze and cursor data for the session player
      let gazeData = [];
      let cursorData = [];
      
      try {
        // Get gaze data
        const gazeResponse = await api.get(`/api/sessions/${session.id}/gaze`);
        if (gazeResponse.data && Array.isArray(gazeResponse.data)) {
          gazeData = gazeResponse.data;
          console.log(`Loaded ${gazeData.length} gaze data points`);
        }
        
        // Get cursor data
        let cursorResponse;
        try {
          // Try the standard cursor endpoint first
          cursorResponse = await api.get(`/api/sessions/${session.id}/cursor`);
          console.log('Cursor response:', cursorResponse.data);
          console.log('Cursor response type:', typeof cursorResponse.data);
        } catch (error) {
          console.warn('Error fetching from /cursor endpoint:', error);
          cursorResponse = { data: null };
        }
        
        // If no cursor data from first endpoint or empty result, try the cursor-data endpoint
        if (!cursorResponse.data || 
            (typeof cursorResponse.data === 'object' && Object.keys(cursorResponse.data).length === 0) ||
            (Array.isArray(cursorResponse.data) && cursorResponse.data.length === 0)) {
          try {
            console.log('Trying alternative cursor-data endpoint...');
            cursorResponse = await api.get(`/api/sessions/${session.id}/cursor-data`);
            console.log('Cursor-data response:', cursorResponse.data);
          } catch (error) {
            console.warn('Error fetching from /cursor-data endpoint:', error);
          }
        }
        
        if (cursorResponse.data) {
          // If cursorResponse.data is already an array, use it
          if (Array.isArray(cursorResponse.data)) {
            cursorData = cursorResponse.data;
          } 
          // If it has points property, use that (structured response)
          else if (cursorResponse.data.points && Array.isArray(cursorResponse.data.points)) {
            cursorData = cursorResponse.data.points;
            console.log('Using points array from cursor data response');
          }
          // Check for cursor_data property that might contain cursor points
          else if (cursorResponse.data.cursor_data && Array.isArray(cursorResponse.data.cursor_data)) {
            cursorData = cursorResponse.data.cursor_data;
            console.log('Using cursor_data array from cursor data response');
          }
          // If it has data property with points, use that (nested structure)
          else if (cursorResponse.data.data && Array.isArray(cursorResponse.data.data)) {
            cursorData = cursorResponse.data.data;
            console.log('Using nested data array from cursor data response');
          }
          // Try to handle cursor data wrapped in an object
          else if (typeof cursorResponse.data === 'object' && !Array.isArray(cursorResponse.data)) {
            const foundArray = Object.values(cursorResponse.data).find(val => Array.isArray(val));
            if (foundArray) {
              cursorData = foundArray;
              console.log('Found cursor data in object property:', 
                Object.keys(cursorResponse.data).find(key => Array.isArray(cursorResponse.data[key])));
            } else {
              console.warn('Cursor data response is not in expected format:', cursorResponse.data);
              cursorData = []; // Fallback to empty array
            }
          } else {
            console.warn('Cursor data response is not in expected format:', cursorResponse.data);
            cursorData = []; // Fallback to empty array
          }
          console.log(`Loaded ${cursorData.length} cursor data points`);
        }
      } catch (dataError) {
        console.error('Error loading session data:', dataError);
      }
      
      // Create heatmap data object
      const heatmapData = {
        id: session.id,
        created_at: session.created_at,
        name: session.name,
        gazeHeatmapUrl: gazeHeatmapUrl,
        cursorHeatmapUrl: cursorHeatmapUrl,
        stats: gazeStats,
        cursorStats: cursorStats,
        videoUrl: videoUrl,
        gazeData: gazeData,
        cursorData: cursorData,
        session: sessionResponse.data
      };
      
      const updatedHeatmaps = [...selectedHeatmaps];
      updatedHeatmaps[currentSlotIndex] = heatmapData;
      setSelectedHeatmaps(updatedHeatmaps);
      setShowSelector(false);
    } catch (err) {
      console.error('Error loading heatmap:', err);
      setError('Не удалось загрузить тепловую карту. Пожалуйста, попробуйте позже.');
    }
  };

  const handleRemoveHeatmap = (id) => {
    const updatedHeatmaps = selectedHeatmaps.map(heatmap => 
      heatmap && heatmap.id === id ? null : heatmap
    );
    setSelectedHeatmaps(updatedHeatmaps);
  };

  const handleAddMore = () => {
    if (selectedHeatmaps.length < 4) {
      setSelectedHeatmaps([...selectedHeatmaps, null]);
    }
  };

  if (loading) {
    return (
      <div className="data-analysis-container">
        <div className="loading-spinner"></div>
        <p>Загрузка...</p>
      </div>
    );
  }

  return (
    <div className="data-analysis-container">
      <div className="analysis-header">
        <h1>Анализ данных</h1>
        <p>Сравнение тепловых карт и метрик</p>
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="heatmap-comparison-grid">
        {selectedHeatmaps.map((heatmap, index) => (
          <div key={index} className="heatmap-slot">
            {heatmap ? (
              <HeatmapCompareItem 
                heatmap={heatmap} 
                onRemove={handleRemoveHeatmap}
              />
            ) : (
              <div className="empty-heatmap-slot">
                <button 
                  className="add-heatmap-button"
                  onClick={() => handleAddHeatmap(index)}
                >
                  + Добавить для сравнения
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {selectedHeatmaps.length < 4 && selectedHeatmaps.filter(h => h !== null).length >= 2 && (
        <div className="add-more-container">
          <button className="add-more-button" onClick={handleAddMore}>
            + Добавить еще
          </button>
        </div>
      )}

      {showSelector && (
        <div className="session-selector-overlay">
          <div className="session-selector-modal">
            <div className="selector-header">
              <h2>Выберите запись</h2>
              <button className="close-button" onClick={() => setShowSelector(false)}>✖</button>
            </div>
            <div className="session-list">
              {sessions.map(session => (
                <div 
                  key={session.id} 
                  className="session-item"
                  onClick={() => handleSelectSession(session)}
                >
                  <div className="session-name">{session.name}</div>
                  <div className="session-date">
                    {new Date(session.created_at).toLocaleString('ru-RU')}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DataAnalysis; 