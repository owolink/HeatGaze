import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import SessionPlayer from './SessionPlayer';
import './HeatmapViewer.css';

// Metric helper component with tooltip
const MetricCard = ({ label, value, description, suffix = '', color = '#4a90e2', min = null, max = null, optimal = null, reversed = false }) => {
  const [showTooltip, setShowTooltip] = useState(false);
  
  // Determine color based on value range if min and max are provided
  let dynamicColor = color;
  if (min !== null && max !== null) {
    // Calculate how far the value is from optimal (or center of range if no optimal provided)
    const target = optimal !== null ? optimal : (min + max) / 2;
    const range = max - min;
    const distance = Math.abs(value - target) / (range / 2);
    
    // If reversed is true, lower values are better; otherwise higher values are better
    const normalizedValue = reversed ? 1 - distance : distance;
    
    if (normalizedValue > 0.8) {
      dynamicColor = '#4CAF50';  // Good - green
    } else if (normalizedValue > 0.5) {
      dynamicColor = '#FFC107';  // Warning - yellow
    } else {
      dynamicColor = '#F44336';  // Bad - red
    }
  }
  
  return (
    <div 
      className="stat-card" 
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <div className="stat-value" style={{ color: dynamicColor }}>{value}{suffix}</div>
      <div className="stat-label">{label}</div>
      {description && showTooltip && (
        <div className="stat-tooltip">
          {description}
          {min !== null && max !== null && (
            <div className="range-info">
              <small>Range: {min} - {max}{suffix}</small>
              {optimal !== null && <small>Optimal: ~{optimal}{suffix}</small>}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Advanced metrics visualization component
const AdvancedMetricsViz = ({ stats, vizMode }) => {
  if (vizMode === 'chart') {
    // Simple bar chart for metrics
    const metrics = [
      { key: 'kld', label: 'KL Divergence', max: 2, reversed: true },
      { key: 'nss', label: 'NSS', max: 3 },
      { key: 'similarity', label: 'Similarity', max: 1 },
      { key: 'cc', label: 'Correlation', max: 1 },
      { key: 'auc', label: 'AUC', max: 1 },
      { key: 'mean_intensity', label: 'Mean Intensity', max: 1 },
      { key: 'std_dev', label: 'Std Deviation', max: 0.5 }
    ];
    
    return (
      <div className="metrics-chart">
        {metrics.map(metric => {
          // Determine color based on value range
          let barColor = '#4a90e2';
          const value = stats[metric.key] || 0;
          const optimal = metric.key === 'kld' ? 0 : metric.max * 0.7;
          const normalizedValue = metric.reversed 
            ? 1 - (value / metric.max) 
            : value / metric.max;
            
          if (normalizedValue > 0.8) {
            barColor = '#4CAF50';  // Good - green
          } else if (normalizedValue > 0.5) {
            barColor = '#FFC107';  // Warning - yellow
          } else {
            barColor = '#F44336';  // Bad - red
          }
          
          return (
            <div className="chart-row" key={metric.key}>
              <div className="chart-label">{metric.label}</div>
              <div className="chart-bar-container">
                <div 
                  className="chart-bar" 
                  style={{ 
                    width: `${Math.min(100, (value / metric.max) * 100)}%`,
                    backgroundColor: barColor
                  }}
                />
                <div className="chart-value">{value}</div>
              </div>
            </div>
          );
        })}
      </div>
    );
  }
  
  // Define metric value ranges and descriptions
  const metricConfig = {
    kld: { 
      min: 0, max: 2, optimal: 0.5, 
      description: "Measures difference from uniform distribution. Lower values indicate more uniform attention.",
      reversed: true
    },
    nss: { 
      min: -3, max: 3, optimal: 1.5, 
      description: "Normalized Scanpath Saliency. Higher values indicate better alignment of fixations with salient regions." 
    },
    similarity: { 
      min: 0, max: 1, optimal: 0.7, 
      description: "Histogram intersection with uniform map. Higher values indicate greater similarity to baseline distribution." 
    },
    cc: { 
      min: -1, max: 1, optimal: 0.7, 
      description: "Linear correlation with uniform distribution. Values closer to 1 indicate stronger positive correlation." 
    },
    auc: { 
      min: 0, max: 1, optimal: 0.8, 
      description: "Area Under ROC Curve. Values above 0.5 indicate better-than-chance fixation prediction (max is 1.0)." 
    },
    mean_intensity: { 
      min: 0, max: 1, optimal: 0.5, 
      description: "Average intensity across the heatmap. Higher values indicate stronger overall focus." 
    },
    median_intensity: { 
      min: 0, max: 1, optimal: 0.4, 
      description: "Median intensity value. Less affected by outliers than mean."
    },
    std_dev: { 
      min: 0, max: 0.5, optimal: 0.25, 
      description: "Standard deviation of intensities. Higher values indicate more variation in focus."
    },
    high_activity_proportion: { 
      min: 0, max: 100, optimal: 20, suffix: '%',
      description: "Percentage of areas with high activity (>70% of max intensity)."
    },
    low_activity_proportion: { 
      min: 0, max: 100, optimal: 50, suffix: '%',
      description: "Percentage of areas with low activity (<20% of max intensity)."
    },
    mean_gradient: { 
      min: 0, max: 0.3, optimal: 0.15, 
      description: "Average rate of change in intensity. Higher values indicate more defined focus boundaries."
    }
  };
  
  // Group metrics into categories
  const metricGroups = {
    attention: [
      { key: 'kld', label: 'KL Divergence' },
      { key: 'nss', label: 'NSS' },
      { key: 'similarity', label: 'Similarity' },
      { key: 'cc', label: 'Correlation' },
      { key: 'auc', label: 'AUC' }
    ],
    intensity: [
      { key: 'mean_intensity', label: 'Mean Intensity' },
      { key: 'median_intensity', label: 'Median Intensity' },
      { key: 'std_dev', label: 'Standard Deviation' },
      { key: 'high_activity_proportion', label: 'High Activity', suffix: '%' },
      { key: 'low_activity_proportion', label: 'Low Activity', suffix: '%' },
      { key: 'mean_gradient', label: 'Gradient' }
    ]
  };
  
  // Cards view (default)
  return (
    <div className="advanced-metrics-container">
      <div className="metric-group">
        <h4>Attention Metrics</h4>
        <div className="stat-grid advanced">
          {metricGroups.attention.map(metric => {
            const config = metricConfig[metric.key];
            return (
              <MetricCard 
                key={metric.key}
                label={metric.label}
                value={stats[metric.key] !== undefined ? stats[metric.key] : 0}
                description={config.description}
                suffix={metric.suffix || config.suffix || ''}
                min={config.min}
                max={config.max}
                optimal={config.optimal}
                reversed={config.reversed}
              />
            );
          })}
        </div>
      </div>
      
      <div className="metric-group">
        <h4>Intensity Metrics</h4>
        <div className="stat-grid advanced">
          {metricGroups.intensity.map(metric => {
            const config = metricConfig[metric.key];
            return (
              <MetricCard 
                key={metric.key}
                label={metric.label}
                value={stats[metric.key] !== undefined ? stats[metric.key] : 0}
                description={config.description}
                suffix={metric.suffix || config.suffix || ''}
                min={config.min}
                max={config.max}
                optimal={config.optimal}
                reversed={config.reversed}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
};

// Use React.memo to memoize the entire component
const HeatmapViewer = React.memo(() => {
  const { id } = useParams();
  console.log('HeatmapViewer initialized with id:', id);
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  
  const [heatmap, setHeatmap] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showPlayer, setShowPlayer] = useState(true); 
  const [showAdvancedStats, setShowAdvancedStats] = useState(false);
  const [advancedStatsVizMode, setAdvancedStatsVizMode] = useState('cards'); // 'cards' or 'chart'
  const [activeView, setActiveView] = useState('gaze'); // 'gaze' or 'cursor'
  const [fullscreen, setFullscreen] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1.0);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Use useCallback for event handlers to prevent recreating functions on each render
  const togglePlayer = useCallback(() => {
    console.log('Toggling player visibility');
    setShowPlayer(prev => !prev);
  }, []);

  const toggleAdvancedStats = useCallback(() => {
    setShowAdvancedStats(prev => !prev);
  }, []);
  
  const toggleVizMode = useCallback(() => {
    setAdvancedStatsVizMode(prev => prev === 'cards' ? 'chart' : 'cards');
  }, []);
  
  const toggleView = useCallback(() => {
    setActiveView(prev => prev === 'gaze' ? 'cursor' : 'gaze');
    console.log('Toggling view to:', activeView === 'gaze' ? 'cursor' : 'gaze');
  }, [activeView]);
  
  const navigateToDashboard = useCallback(() => {
    navigate('/dashboard');
  }, [navigate]);

  const openFullscreen = useCallback(() => {
    setFullscreen(true);
    setZoomLevel(1.0); // Reset zoom level when opening fullscreen
    setPosition({ x: 0, y: 0 }); // Reset position when opening fullscreen
  }, []);
  
  const closeFullscreen = useCallback(() => {
    setFullscreen(false);
    setPosition({ x: 0, y: 0 }); // Reset position when closing fullscreen
  }, []);
  
  const increaseZoom = useCallback((e) => {
    e.stopPropagation();
    setZoomLevel(prevZoom => Math.min(3, prevZoom + 0.25));
  }, []);
  
  const decreaseZoom = useCallback((e) => {
    e.stopPropagation();
    setZoomLevel(prevZoom => Math.max(0.5, prevZoom - 0.25));
  }, []);
  
  const resetZoom = useCallback((e) => {
    e.stopPropagation();
    setZoomLevel(1.0);
    setPosition({ x: 0, y: 0 }); // Reset position when resetting zoom
  }, []);
  
  const handleMouseDown = useCallback((e) => {
    if (zoomLevel > 1.0) { // Only allow dragging when zoomed in
      e.stopPropagation();
      setIsDragging(true);
      setDragStart({
        x: e.clientX - position.x,
        y: e.clientY - position.y
      });
    }
  }, [position, zoomLevel]);
  
  const handleMouseMove = useCallback((e) => {
    if (isDragging && zoomLevel > 1.0) {
      e.stopPropagation();
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }
  }, [isDragging, dragStart, zoomLevel]);
  
  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);
  
  // Add cleanup for mouse events
  useEffect(() => {
    if (fullscreen) {
      // Add global event listeners when in fullscreen mode
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [fullscreen, handleMouseMove, handleMouseUp]);

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
    pointCount: 1250,
    kld: 0.42,
    nss: 1.85,
    similarity: 0.65,
    cc: 0.78,
    auc: 0.82
  };

  // Memoize the SessionPlayer component with React.lazy and Suspense for better lazy loading
  const memoizedSessionPlayer = useMemo(() => {
    if (!showPlayer) return null;
    console.log('Creating memoized SessionPlayer with sessionId:', id);

    // Use React's key prop to ensure proper component lifecycle
    return (
      <div className="session-player-section">
        <h3>Session Playback</h3>
        <SessionPlayer key={`session-player-${id}`} sessionId={id} />
      </div>
    );
  }, [id, showPlayer]);

  // Log when component is rendering different sections
  console.log('HeatmapViewer rendering with state:', { loading, error, hasHeatmap: !!heatmap, showPlayer, activeView });

  // Memoize the render parts for better performance
  const renderHeader = useMemo(() => (
    <div className="heatmap-header">
      <h1>Heatmap Viewer</h1>
      <button className="back-button" onClick={navigateToDashboard}>Back to Dashboard</button>
    </div>
  ), [navigateToDashboard]);

  const renderLoading = useMemo(() => (
    <div className="loading-container">
      <div className="loading-spinner"></div>
      <p>Loading heatmap data...</p>
    </div>
  ), []);

  const renderError = useMemo(() => (
    <div className="error-message">{error}</div>
  ), [error]);

  // Split the content render into smaller memoized pieces
  const renderHeatmap = useMemo(() => {
    if (!heatmap) return null;
    
    // Choose which heatmap to display based on activeView
    if (activeView === 'cursor') {
      if (!heatmap.cursorHeatmapUrl) {
        return (
          <div className="no-cursor-data">
            <p>No cursor heatmap data available for this session.</p>
          </div>
        );
      }
      return (
        <img 
          src={`data:image/png;base64,${heatmap.cursorHeatmapUrl}`} 
          alt="Cursor tracking heatmap" 
          className="heatmap-image" 
          onClick={openFullscreen}
        />
      );
    }
    
    // Default to gaze heatmap
    return (
      <img 
        src={`data:image/png;base64,${heatmap.image}`} 
        alt="Eye tracking heatmap" 
        className="heatmap-image" 
        onClick={openFullscreen}
      />
    );
  }, [heatmap, activeView, openFullscreen]);

  const renderPlaceholderImage = useMemo(() => (
    <img src={placeholderImage} alt="Eye tracking heatmap" className="heatmap-image" />
  ), [placeholderImage]);

  const getStatValue = (key, suffix = '') => {
    // Choose which stats to use based on activeView
    const stats = activeView === 'cursor' && heatmap?.cursorStats 
      ? heatmap.cursorStats 
      : heatmap?.stats || placeholderStats;
      
    return stats[key] !== undefined ? stats[key] + suffix : placeholderStats[key] + suffix;
  };

  const renderStats = useMemo(() => {
    // Choose which stats to display based on activeView
    const stats = activeView === 'cursor' && heatmap?.cursorStats 
      ? heatmap.cursorStats 
      : heatmap?.stats || placeholderStats;
    
    return (
      <div className="stats-container">
        <h3>{activeView === 'cursor' ? 'Cursor Movement' : 'Eye Tracking'} Statistics</h3>
        <div className="stats-header">
          <span>Basic Metrics</span>
          <button className="toggle-stats-button" onClick={toggleAdvancedStats}>
            {showAdvancedStats ? 'Hide Advanced Metrics' : 'Show Advanced Metrics'}
          </button>
        </div>
        
        <div className="stats-grid">
          <MetricCard 
            label="Data Points" 
            value={getStatValue('pointCount')} 
            description={`Total number of ${activeView === 'cursor' ? 'cursor' : 'gaze'} points captured in this session`} 
          />
          <MetricCard 
            label="Focus Areas" 
            value={getStatValue('focus_areas')} 
            description={`Number of distinct areas that received significant ${activeView === 'cursor' ? 'cursor' : 'eye'} attention`} 
            min={0}
            max={10}
            optimal={3}
          />
          <MetricCard 
            label="Attention Score" 
            value={getStatValue('attention_score')} 
            suffix="%" 
            description="Overall score based on focus quality and quantity" 
            min={0}
            max={100}
            optimal={75}
          />
          <MetricCard 
            label="Page Coverage" 
            value={Math.round(getStatValue('coverage') * 100)} 
            suffix="%" 
            description={`Percentage of the screen that received ${activeView === 'cursor' ? 'cursor' : 'eye'} attention`} 
            min={0}
            max={100}
            optimal={60}
          />
        </div>
        
        {showAdvancedStats && (
          <>
            <div className="advanced-stats-header">
              <h4 className="advanced-stats-title">Advanced Metrics</h4>
              <button className="viz-toggle-button" onClick={toggleVizMode}>
                {advancedStatsVizMode === 'cards' ? 'Show as Chart' : 'Show as Cards'}
              </button>
            </div>
            <div className="advanced-stats">
              <AdvancedMetricsViz stats={stats} vizMode={advancedStatsVizMode} />
              
              <div className="metrics-explanation">
                <h5>Understanding These Metrics</h5>
                <p>These metrics are color-coded to indicate performance:</p>
                <ul className="color-legend">
                  <li><span className="color-dot green"></span> <strong>Good</strong> - Value is near optimal range</li>
                  <li><span className="color-dot yellow"></span> <strong>Warning</strong> - Value is slightly outside optimal range</li>
                  <li><span className="color-dot red"></span> <strong>Poor</strong> - Value is significantly outside optimal range</li>
                </ul>
                <p>Hover over any metric for a detailed explanation and expected range.</p>
              </div>
            </div>
          </>
        )}
      </div>
    );
  }, [heatmap, activeView, placeholderStats, showAdvancedStats, toggleAdvancedStats, toggleVizMode, advancedStatsVizMode, getStatValue]);

  const renderActionButtons = useMemo(() => {
    const hasCursorData = heatmap && heatmap.cursorHeatmapUrl;
    
    return (
      <div className="action-buttons">
        {hasCursorData && (
          <button 
            className={`action-button view-toggle ${activeView === 'cursor' ? 'active' : ''}`} 
            onClick={toggleView}
          >
            {activeView === 'gaze' ? 'View Cursor Heatmap' : 'View Gaze Heatmap'}
          </button>
        )}
        <button className="action-button">Download as PNG</button>
        <button className="action-button">Export Data</button>
        <button className="action-button">Generate Report</button>
        <button className="action-button" onClick={togglePlayer}>
          {showPlayer ? 'Hide Player' : 'Show Player'}
        </button>
      </div>
    );
  }, [togglePlayer, showPlayer, heatmap, activeView, toggleView]);

  return (
    <div className="heatmap-container">
      {renderHeader}

      {loading ? renderLoading : error ? renderError : (
        <div className="heatmap-content">
          <div className="heatmap-info">
            <h2>Session ID: {id}</h2>
            <p>Created: {new Date().toLocaleString()}</p>
            <p>User: {currentUser?.username}</p>
            {heatmap && heatmap.cursorHeatmapUrl && (
              <p className="heatmap-type">
                Currently viewing: <strong>{activeView === 'gaze' ? 'Eye Tracking' : 'Cursor Movement'}</strong> heatmap
              </p>
            )}
          </div>

          <div className="heatmap-image-container">
            {heatmap ? renderHeatmap : renderPlaceholderImage}
          </div>

          {renderStats}

          {renderActionButtons}

          {showPlayer && memoizedSessionPlayer}
          
          {fullscreen && (
            <div className="fullscreen-overlay" onClick={closeFullscreen}>
              <div className="fullscreen-image-container" onClick={(e) => e.stopPropagation()}>
                <img 
                  src={`data:image/png;base64,${activeView === 'cursor' ? heatmap.cursorHeatmapUrl : heatmap.image}`} 
                  alt={activeView === 'cursor' ? "Cursor tracking heatmap" : "Eye tracking heatmap"} 
                  className="fullscreen-image"
                  onClick={(e) => e.stopPropagation()}
                  onMouseDown={handleMouseDown}
                  style={{ 
                    transform: `translate(${position.x}px, ${position.y}px) scale(${zoomLevel})`,
                    cursor: zoomLevel > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default'
                  }}
                />
                <button className="close-fullscreen-button" onClick={closeFullscreen}>✖</button>
                
                <div className="zoom-controls">
                  <button onClick={decreaseZoom} className="zoom-button">−</button>
                  <span className="zoom-level">{Math.round(zoomLevel * 100)}%</span>
                  <button onClick={increaseZoom} className="zoom-button">+</button>
                  <button onClick={resetZoom} className="zoom-reset">Reset</button>
                </div>
                {zoomLevel > 1 && (
                  <div className="drag-instructions">
                    <span>🖱️ Click and drag to move the image</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
});

export default HeatmapViewer; 