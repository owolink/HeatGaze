import React, { useState } from 'react';
import SessionPlayer from './SessionPlayer';

// Component for a single heatmap item in comparison view
const HeatmapCompareItem = ({ heatmap, onRemove }) => {
  const [mapType, setMapType] = useState('gaze'); // 'gaze' or 'cursor'
  const [showFullscreen, setShowFullscreen] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  
  if (!heatmap) return (
    <div className="empty-heatmap-slot">
      <div className="placeholder-text">Выберите запись для сравнения</div>
    </div>
  );
  
  const handleImageClick = () => {
    setShowFullscreen(true);
    setZoomLevel(1); // Reset zoom level when opening fullscreen
  };
  
  const closeFullscreen = () => {
    setShowFullscreen(false);
  };
  
  const increaseZoom = (e) => {
    e.stopPropagation();
    setZoomLevel(prevZoom => Math.min(3, prevZoom + 0.25));
  };
  
  const decreaseZoom = (e) => {
    e.stopPropagation();
    setZoomLevel(prevZoom => Math.max(0.5, prevZoom - 0.25));
  };
  
  const resetZoom = (e) => {
    e.stopPropagation();
    setZoomLevel(1);
  };
  
  const currentHeatmapUrl = mapType === 'gaze' ? heatmap.gazeHeatmapUrl : heatmap.cursorHeatmapUrl;
  
  return (
    <div className="heatmap-compare-item">
      <div className="heatmap-header">
        <div className="heatmap-info">
          <div className="heatmap-date">{new Date(heatmap.created_at).toLocaleString('ru-RU')}</div>
          <div className="heatmap-id">ID: {heatmap.id}</div>
        </div>
        <button className="remove-button" onClick={() => onRemove(heatmap.id)}>✖</button>
      </div>
      
      <div className="heatmap-content">
        <div className="map-type-selector">
          <label className="map-type-option">
            <input 
              type="radio" 
              name={`map-type-${heatmap.id}`} 
              value="gaze" 
              checked={mapType === 'gaze'} 
              onChange={() => setMapType('gaze')}
            />
            <span>Взгляд</span>
          </label>
          <label className="map-type-option">
            <input 
              type="radio" 
              name={`map-type-${heatmap.id}`} 
              value="cursor" 
              checked={mapType === 'cursor'} 
              onChange={() => setMapType('cursor')}
            />
            <span>Курсор</span>
          </label>
        </div>
        
        <div className="heatmap-image-container">
          {mapType === 'gaze' && heatmap.gazeHeatmapUrl ? (
            <img 
              src={heatmap.gazeHeatmapUrl} 
              alt="Тепловая карта взгляда" 
              className="heatmap-image"
              onClick={handleImageClick}
            />
          ) : mapType === 'cursor' && heatmap.cursorHeatmapUrl ? (
            <img 
              src={heatmap.cursorHeatmapUrl} 
              alt="Тепловая карта курсора" 
              className="heatmap-image"
              onClick={handleImageClick}
            />
          ) : (
            <div className="heatmap-placeholder">
              {mapType === 'gaze' ? 'Карта взгляда недоступна' : 'Карта курсора недоступна'}
            </div>
          )}
        </div>
        
        {showFullscreen && (
          <div className="fullscreen-overlay" onClick={closeFullscreen}>
            <div className="fullscreen-image-container" onClick={(e) => e.stopPropagation()}>
              <img 
                src={currentHeatmapUrl} 
                alt={mapType === 'gaze' ? "Тепловая карта взгляда" : "Тепловая карта курсора"} 
                className="fullscreen-image"
                onClick={(e) => e.stopPropagation()}
                style={{ transform: `scale(${zoomLevel})` }}
              />
              <button className="close-fullscreen-button" onClick={closeFullscreen}>✖</button>
              
              <div className="zoom-controls">
                <button onClick={decreaseZoom} className="zoom-button">−</button>
                <span className="zoom-level">{Math.round(zoomLevel * 100)}%</span>
                <button onClick={increaseZoom} className="zoom-button">+</button>
                <button onClick={resetZoom} className="zoom-reset">Reset</button>
              </div>
            </div>
          </div>
        )}
        
        <div className="player-container">
          <SessionPlayer 
            sessionId={heatmap.id}
            videoUrl={heatmap.videoUrl}
            compact={true}
            gazeData={heatmap.gazeData}
            cursorData={heatmap.cursorData}
            session={heatmap.session}
          />
        </div>
        
        <div className="metrics-container">
          <div className="metrics-header">
            Метрики ({mapType === 'gaze' ? 'взгляд' : 'курсор'})
          </div>
          <div className="compact-metrics-grid">
            {mapType === 'gaze' && heatmap.stats && 
              Object.entries(heatmap.stats)
                .filter(([key]) => ['kld', 'nss', 'similarity', 'cc', 'auc', 'std_dev'].includes(key))
                .map(([key, value]) => {
                  let label;
                  let color = '#4a90e2';
                  
                  // Map key to readable label
                  switch(key) {
                    case 'kld': label = 'KL Divergence'; break;
                    case 'nss': label = 'NSS'; break;
                    case 'similarity': label = 'Similarity'; break;
                    case 'cc': label = 'Correlation'; break;
                    case 'auc': label = 'AUC'; break;
                    case 'std_dev': label = 'Std Dev'; break;
                    default: label = key;
                  }
                  
                  // Simple color coding
                  if (key === 'kld') {
                    if (value < 0.5) color = '#4CAF50';
                    else if (value < 1.0) color = '#FFC107';
                    else color = '#F44336';
                  } else if (['nss', 'auc', 'similarity', 'cc'].includes(key)) {
                    if (value > 0.7) color = '#4CAF50';
                    else if (value > 0.4) color = '#FFC107';
                    else color = '#F44336';
                  }
                  
                  return (
                    <div className="compact-stat-card" key={key}>
                      <div className="compact-stat-label">{label}</div>
                      <div className="compact-stat-value" style={{ color }}>{typeof value === 'number' ? value.toFixed(2) : 'N/A'}</div>
                    </div>
                  );
                })
            }
            
            {mapType === 'cursor' && heatmap.cursorStats && 
              Object.entries(heatmap.cursorStats)
                .filter(([key]) => ['kld', 'nss', 'similarity', 'cc', 'auc', 'std_dev'].includes(key))
                .map(([key, value]) => {
                  let label;
                  let color = '#4a90e2';
                  
                  // Map key to readable label
                  switch(key) {
                    case 'kld': label = 'KL Divergence'; break;
                    case 'nss': label = 'NSS'; break;
                    case 'similarity': label = 'Similarity'; break;
                    case 'cc': label = 'Correlation'; break;
                    case 'auc': label = 'AUC'; break;
                    case 'std_dev': label = 'Std Dev'; break;
                    default: label = key;
                  }
                  
                  // Simple color coding
                  if (key === 'kld') {
                    if (value < 0.5) color = '#4CAF50';
                    else if (value < 1.0) color = '#FFC107';
                    else color = '#F44336';
                  } else if (['nss', 'auc', 'similarity', 'cc'].includes(key)) {
                    if (value > 0.7) color = '#4CAF50';
                    else if (value > 0.4) color = '#FFC107';
                    else color = '#F44336';
                  }
                  
                  return (
                    <div className="compact-stat-card" key={key}>
                      <div className="compact-stat-label">{label}</div>
                      <div className="compact-stat-value" style={{ color }}>{typeof value === 'number' ? value.toFixed(2) : 'N/A'}</div>
                    </div>
                  );
                })
            }
            
            {(!mapType === 'gaze' && !heatmap.stats) || (mapType === 'cursor' && !heatmap.cursorStats) ? (
              <div className="no-metrics">Нет данных метрик</div>
            ) : null}
          </div>
          
          <div className="chart-container">
            {mapType === 'gaze' && heatmap.stats ? (
              <div className="compact-metrics-chart">
                {Object.entries(heatmap.stats)
                  .filter(([key]) => ['kld', 'nss', 'similarity', 'cc', 'auc'].includes(key))
                  .map(([key, value]) => {
                    let label;
                    let max = 1;
                    let reversed = false;
                    
                    // Map key to readable label
                    switch(key) {
                      case 'kld': label = 'KLD'; max = 2; reversed = true; break;
                      case 'nss': label = 'NSS'; max = 3; break;
                      case 'similarity': label = 'SIM'; max = 1; break;
                      case 'cc': label = 'CC'; max = 1; break;
                      case 'auc': label = 'AUC'; max = 1; break;
                      default: label = key;
                    }
                    
                    const normalizedValue = reversed 
                      ? 1 - (value / max) 
                      : value / max;
                      
                    let barColor = '#4a90e2';
                    if (normalizedValue > 0.7) barColor = '#4CAF50';
                    else if (normalizedValue > 0.4) barColor = '#FFC107';
                    else barColor = '#F44336';
                    
                    return (
                      <div className="compact-chart-row" key={key}>
                        <div className="compact-chart-label">{label}</div>
                        <div className="compact-chart-bar-container">
                          <div 
                            className="compact-chart-bar" 
                            style={{ 
                              width: `${Math.min(100, (value / max) * 100)}%`,
                              backgroundColor: barColor
                            }}
                          />
                          <span className="compact-chart-value">{typeof value === 'number' ? value.toFixed(2) : 'N/A'}</span>
                        </div>
                      </div>
                    );
                  })
                }
              </div>
            ) : mapType === 'cursor' && heatmap.cursorStats ? (
              <div className="compact-metrics-chart">
                {Object.entries(heatmap.cursorStats)
                  .filter(([key]) => ['kld', 'nss', 'similarity', 'cc', 'auc'].includes(key))
                  .map(([key, value]) => {
                    let label;
                    let max = 1;
                    let reversed = false;
                    
                    // Map key to readable label
                    switch(key) {
                      case 'kld': label = 'KLD'; max = 2; reversed = true; break;
                      case 'nss': label = 'NSS'; max = 3; break;
                      case 'similarity': label = 'SIM'; max = 1; break;
                      case 'cc': label = 'CC'; max = 1; break;
                      case 'auc': label = 'AUC'; max = 1; break;
                      default: label = key;
                    }
                    
                    const normalizedValue = reversed 
                      ? 1 - (value / max) 
                      : value / max;
                      
                    let barColor = '#4a90e2';
                    if (normalizedValue > 0.7) barColor = '#4CAF50';
                    else if (normalizedValue > 0.4) barColor = '#FFC107';
                    else barColor = '#F44336';
                    
                    return (
                      <div className="compact-chart-row" key={key}>
                        <div className="compact-chart-label">{label}</div>
                        <div className="compact-chart-bar-container">
                          <div 
                            className="compact-chart-bar" 
                            style={{ 
                              width: `${Math.min(100, (value / max) * 100)}%`,
                              backgroundColor: barColor
                            }}
                          />
                          <span className="compact-chart-value">{typeof value === 'number' ? value.toFixed(2) : 'N/A'}</span>
                        </div>
                      </div>
                    );
                  })
                }
              </div>
            ) : (
              <div className="no-metrics">Нет данных для графиков</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default HeatmapCompareItem; 