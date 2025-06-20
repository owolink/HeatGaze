import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import SessionPlayer from './SessionPlayer';
import './HeatmapViewer.css';
import { inspectStructure, checkForZeroValues } from '../utils/debug';
import { detectHotspots, convertImageToIntensityMap, findCommonHotspots } from '../utils/heatmapAnalysis';

// Metric helper component with tooltip
const MetricCard = ({ label, value, description, suffix = '', color = '#4a90e2', min = null, max = null, optimal = null, reversed = false, colorClass = '' }) => {
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
      <div className={`stat-value ${colorClass}`} style={{ color: dynamicColor }}>{value}{suffix}</div>
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
const AdvancedMetricsViz = ({ stats, vizMode, correlationMetrics }) => {
  // Log what's being passed to the component
  console.log("AdvancedMetricsViz received:", {
    stats: stats ? Object.keys(stats) : "none",
    correlationMetrics: correlationMetrics ? Object.keys(correlationMetrics) : "none"
  });
  
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
    
    // Add correlation metrics to chart if available
    if (correlationMetrics) {
      const correlationMetricItems = [
        { key: 'correlation_coefficient', label: 'PCC', max: 1 },
        { key: 'histogram_intersection', label: 'HI', max: 1 },
        { key: 'kl_divergence', label: 'KLD', max: 2, reversed: true },
        { key: 'iou', label: 'IoU', max: 1 },
        { key: 'common_hotspots', label: 'Hotspots', max: 10 }
      ];
      
      // Only add metrics that exist in correlationMetrics
      correlationMetricItems.forEach(item => {
        if (correlationMetrics[item.key] !== undefined) {
          metrics.push(item);
        }
      });
    }
    
    return (
      <div className="metrics-chart">
        {metrics.map(metric => {
          // Determine where to get the value from
          let value = stats[metric.key];
          
          // If this is a correlation metric and we have correlation metrics, use that value
          if (correlationMetrics && correlationMetrics[metric.key] !== undefined) {
            value = correlationMetrics[metric.key];
          }
          
          // Skip if no value
          if (value === undefined) return null;
          
          // Determine color based on value range
          let barColor = '#4a90e2';
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
                <div className="chart-value">{typeof value === 'number' ? value.toFixed(2) : value}</div>
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
      description: "Определяет разницу от равномерного распределения. Меньшие значения указывают на более равномерное внимание.",
      reversed: true
    },
    nss: { 
      min: -2, max: 3, optimal: 1.5, 
      description: "Нормализованная сканирующая салективность (NSS). Типичный диапазон: -2 до 3. Значения > 1 указывают на высокую релевантность фиксаций, значения < 0 указывают на фиксации в нерелевантных областях.",
      label: "NSS"
    },
    similarity: { 
      min: 0, max: 1, optimal: 0.7, 
      description: "Пересечение гистограммы с равномерной картой. Большие значения указывают на большую схожесть с базовым распределением." 
    },
    cc: { 
      min: -1, max: 1, optimal: 0.7, 
      description: "Линейная корреляция с равномерным распределением. Значения ближе к 1 указывают на более сильную положительную корреляцию." 
    },
    auc: { 
      min: 0, max: 1, optimal: 0.8, 
      description: "Площадь под кривой ROC. Значения выше 0.5 указывают на лучшие результаты предсказания фиксаций (максимальное значение - 1.0)." 
    },
    mean_intensity: { 
      min: 0, max: 1, optimal: 0.5, 
      description: "Средняя интенсивность по всей тепловой карте. Большие значения указывают на более сильное общее внимание." 
    },
    median_intensity: { 
      min: 0, max: 1, optimal: 0.4, 
      description: "Медианная интенсивность. Менее подвержена влиянию выбросов, чем средняя интенсивность."
    },
    std_dev: { 
      min: 0, max: 0.5, optimal: 0.25, 
      description: "Стандартное отклонение интенсивностей. Большие значения указывают на большую вариацию в фокусе."
    },
    high_activity_proportion: { 
      min: 0, max: 100, optimal: 20, suffix: '%',
      description: "Процент областей с высокой активностью (>70% от максимальной интенсивности)."
    },
    low_activity_proportion: { 
      min: 0, max: 100, optimal: 50, suffix: '%',
      description: "Процент областей с низкой активностью (<20% от максимальной интенсивности)."
    },
    mean_gradient: { 
      min: 0, max: 0.3, optimal: 0.15, 
      description: "Средняя скорость изменения интенсивности. Большие значения указывают на более четко определенные границы фокуса."
    },
    correlation_coefficient: { 
      min: -1, max: 1, optimal: 0.7, 
      description: "Коэффициент корреляции Пирсона (PCC). Диапазон: -1 до 1. 1 указывает на идеальную положительную корреляцию, 0 указывает на отсутствие линейной связи, -1 указывает на идеальную отрицательную корреляцию.",
      label: "Коэффициент корреляции"
    },
    histogram_intersection: { 
      min: 0, max: 1, optimal: 0.7, 
      description: "Пересечение гистограмм. Диапазон: 0 до 1. Большие значения указывают на большую схожесть между картами взгляда и курсора.",
      label: "Пересечение гистограмм"
    },
    kl_divergence: { 
      min: 0, max: 2, optimal: 0.5, reversed: true,
      description: "Расхождение Кульбака-Лейблера между распределениями взгляда и курсора. Меньшие значения указывают на более схожие распределения.",
      label: "Расхождение Кульбака-Лейблера"
    },
    iou: { 
      min: 0, max: 1, optimal: 0.7, 
      description: "Пересечение над объединением (IoU). Диапазон: 0 до 1. 1 указывает на идеальное перекрытие бинарных карт, 0 указывает на отсутствие перекрытия.",
      label: "IoU"
    },
    common_hotspots: { 
      min: 0, max: 10, optimal: 3, 
      description: "Количество значимых областей внимания, которые появляются в обоих картах взгляда и курсора. Определяется путем пороговой обработки и нахождения перекрывающихся областей с высокой интенсивностью.",
      label: "Общие области внимания"
    },
    gaze_hotspots: {
      min: 0, max: 10, optimal: 3,
      description: "Количество отдельных областей с высокой активностью в карте взгляда, определяемых с помощью пороговой обработки и анализа связных компонентов.",
      label: "Область внимания взгляда"
    },
    cursor_hotspots: {
      min: 0, max: 10, optimal: 3,
      description: "Количество отдельных областей с высокой активностью в карте курсора, определяемых с помощью пороговой обработки и анализа связных компонентов.",
      label: "Область внимания курсора"
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
    ],
    correlation: correlationMetrics ? [
      { key: 'correlation_coefficient', label: 'PCC' },
      { key: 'histogram_intersection', label: 'HI' },
      { key: 'kl_divergence', label: 'KLD' },
      { key: 'iou', label: 'IoU' },
      { key: 'common_hotspots', label: 'Hotspots' }
    ] : []
  };
  
  // Cards view (default)
  return (
    <div className="advanced-metrics-container">
      <div className="metric-group">
        <h4>Метрики внимания</h4>
        <div className="stat-grid advanced">
          {metricGroups.attention.map(metric => {
            // Skip metrics that don't exist in stats
            if (stats[metric.key] === undefined && 
                (!correlationMetrics || correlationMetrics[metric.key] === undefined)) {
              return null;
            }
            
            const config = metricConfig[metric.key];
            // Determine which source to use for the value
            const value = correlationMetrics && correlationMetrics[metric.key] !== undefined 
              ? correlationMetrics[metric.key] 
              : stats[metric.key];
            
            return (
              <MetricCard 
                key={metric.key}
                label={metric.label}
                value={value !== undefined ? value : 0}
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
        <h4>Метрики интенсивности</h4>
        <div className="stat-grid advanced">
          {metricGroups.intensity.map(metric => {
            // Skip metrics that don't exist in stats
            if (stats[metric.key] === undefined) {
              return null;
            }
            
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
      
      {correlationMetrics && Object.values(correlationMetrics).some(value => value !== 0) && (
        <div className="metric-group correlation">
          <h4>Метрики корреляции тепловых карт</h4>
          <div className="stat-grid advanced correlation">
            {metricGroups.correlation.map(metric => {
              const config = metricConfig[metric.key];
              // Skip metrics that don't exist in correlationMetrics
              if (correlationMetrics[metric.key] === undefined) {
                return null;
              }
              
              const value = correlationMetrics[metric.key];
              // Determine the color class based on the value
              let colorClass = '';
              if (value !== undefined) {
                const normalizedValue = config.reversed 
                  ? 1 - (value / config.max)
                  : value / config.max;
                
                if (normalizedValue > 0.8) {
                  colorClass = 'good';
                } else if (normalizedValue > 0.5) {
                  colorClass = 'warning';
                } else {
                  colorClass = 'poor';
                }
              }
              
              return (
                <MetricCard 
                  key={metric.key}
                  label={metric.label}
                  value={value !== undefined ? typeof value === 'number' ? value.toFixed(3) : value : 'N/A'}
                  description={config.description}
                  suffix={metric.suffix || config.suffix || ''}
                  min={config.min}
                  max={config.max}
                  optimal={config.optimal}
                  reversed={config.reversed}
                  colorClass={colorClass}
                />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

// Use React.memo to memoize the entire component
const HeatmapViewer = React.memo(({ currentUser }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [heatmap, setHeatmap] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showPlayer, setShowPlayer] = useState(true);
  const [activeView, setActiveView] = useState('gaze');
  const [showAdvancedStats, setShowAdvancedStats] = useState(false);
  const [advancedStatsVizMode, setAdvancedStatsVizMode] = useState('cards');
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
        
        // Debug the response structure
        inspectStructure(response.data, 'Heatmap API Response');
        
        // ADDED: More detailed logging for correlation metrics
        console.log('Correlation metrics in response:', response.data.correlationMetrics);
        console.log('Response structure keys:', Object.keys(response.data));
        
        // Variable to hold our final data
        let finalHeatmapData = response.data;
        
        // Check if correlation metrics contain only zeros 
        if (response.data.correlationMetrics) {
          checkForZeroValues(response.data.correlationMetrics, 'Correlation Metrics');
          console.log('Correlation metrics available:', Object.keys(response.data.correlationMetrics));
        } else {
          console.warn('No correlation metrics found in the response');
          
          // Try to fetch correlation metrics directly if they're not in the main response
          console.log('Attempting to fetch correlation metrics directly...');
          try {
            const metricsResponse = await api.get(`/api/sessions/${id}/correlation_metrics`);
            console.log('Direct correlation metrics response:', metricsResponse.data);
            
            if (metricsResponse.data && Object.keys(metricsResponse.data).length > 0) {
              // Add the metrics to the final data
              finalHeatmapData = {
                ...response.data,
                correlationMetrics: metricsResponse.data
              };
              console.log('Updated heatmap data with correlation metrics:', finalHeatmapData);
            }
          } catch (metricsErr) {
            console.error('Failed to fetch correlation metrics directly:', metricsErr);
          }
        }
        
        // Try to calculate hotspots if not already provided
        try {
          // Only calculate hotspot metrics if they're not already present
          const needsHotspotMetrics = finalHeatmapData.image && finalHeatmapData.cursorHeatmapUrl && (
            !finalHeatmapData.correlationMetrics || 
            finalHeatmapData.correlationMetrics.gaze_hotspots === undefined || 
            finalHeatmapData.correlationMetrics.cursor_hotspots === undefined ||
            finalHeatmapData.correlationMetrics.common_hotspots === undefined
          );
          
          if (needsHotspotMetrics) {
            console.log('Calculating hotspot metrics...');
            
            // Start performance measurement
            if (window.performance) {
              performance.mark('hotspot-detection-start');
            }
            
            // Convert base64 images to intensity maps
            const [gazeIntensityMap, cursorIntensityMap] = await Promise.all([
              convertImageToIntensityMap(finalHeatmapData.image),
              convertImageToIntensityMap(finalHeatmapData.cursorHeatmapUrl)
            ]);
            
            // Detect hotspots in both heatmaps with optimized parameters for large datasets
            const hotspotOptions = {
              downsamplingFactor: 4,  // More aggressive downsampling for large datasets
              usePercentileThreshold: true,
              percentile: 93,  // Slightly higher percentile threshold
              minClusterSize: 25,  // Increase minimum cluster size
              mergeDistance: 30  // Larger merge distance
            };
            
            console.log('Using optimized hotspot detection parameters:', hotspotOptions);
            
            // Progressive fallback strategy for extremely large datasets
            const detectHotspotsWithFallback = async (intensityMap, options) => {
              try {
                // Try with current settings
                return detectHotspots(intensityMap, options);
              } catch (err) {
                console.warn('Initial hotspot detection failed, trying with more aggressive downsampling:', err);
                
                // First fallback: More aggressive downsampling
                try {
                  const fallbackOptions = {
                    ...options,
                    downsamplingFactor: options.downsamplingFactor * 2,  // Double the downsampling
                    minClusterSize: Math.max(5, Math.floor(options.minClusterSize / 2))  // Adjust for smaller map
                  };
                  console.log('Fallback attempt with options:', fallbackOptions);
                  return detectHotspots(intensityMap, fallbackOptions);
                } catch (err2) {
                  console.error('Fallback hotspot detection also failed:', err2);
                  
                  // Last resort: Return empty result
                  return { hotspotCount: 0, hotspots: [] };
                }
              }
            };
            
            // Use the fallback strategy for both heatmaps
            const [gazeHotspots, cursorHotspots] = await Promise.all([
              detectHotspotsWithFallback(gazeIntensityMap, hotspotOptions),
              detectHotspotsWithFallback(cursorIntensityMap, hotspotOptions)
            ]);
            
            console.log(`Detected ${gazeHotspots.hotspotCount} gaze hotspots and ${cursorHotspots.hotspotCount} cursor hotspots`);
            
            // Find common hotspots with increased max distance
            const commonHotspots = findCommonHotspots(gazeHotspots.hotspots, cursorHotspots.hotspots, {
              maxDistance: 60  // Increased from default of 50
            });
            
            // Update the correlation metrics with hotspot information - metrics only
            const updatedCorrelationMetrics = {
              ...(finalHeatmapData.correlationMetrics || {}),
              gaze_hotspots: gazeHotspots.hotspotCount,
              cursor_hotspots: cursorHotspots.hotspotCount,
              common_hotspots: commonHotspots.commonCount
            };
            
            // Log performance details
            console.log('Hotspot detection completed. Performance details:', {
              gazeMapSize: `${gazeIntensityMap[0]?.length || 0}x${gazeIntensityMap.length || 0}`,
              cursorMapSize: `${cursorIntensityMap[0]?.length || 0}x${cursorIntensityMap.length || 0}`,
              downsampledSize: `${Math.ceil((gazeIntensityMap[0]?.length || 0) / hotspotOptions.downsamplingFactor)}x${Math.ceil((gazeIntensityMap.length || 0) / hotspotOptions.downsamplingFactor)}`,
              processingTime: 'See console performance.measure logs'
            });

            finalHeatmapData = {
              ...finalHeatmapData,
              correlationMetrics: updatedCorrelationMetrics
            };
            
            console.log('Updated correlation metrics with hotspot counts:', updatedCorrelationMetrics);
            
            // End performance measurement
            if (window.performance) {
              performance.mark('hotspot-detection-end');
              performance.measure('Hotspot Detection', 'hotspot-detection-start', 'hotspot-detection-end');
              const measurements = performance.getEntriesByName('Hotspot Detection');
              if (measurements.length > 0) {
                console.log(`Hotspot detection took ${measurements[0].duration.toFixed(2)}ms`);
              }
              // Clean up marks
              performance.clearMarks('hotspot-detection-start');
              performance.clearMarks('hotspot-detection-end');
              performance.clearMeasures('Hotspot Detection');
            }
          }
        } catch (hotspotErr) {
          console.error('Error calculating hotspots:', hotspotErr);
          
          // Provide more specific error messages for common issues with large datasets
          let errorMessage = hotspotErr.message || 'Unknown error during hotspot calculation';
          
          // Check if this is a memory error
          if (errorMessage.includes('out of memory') || 
              errorMessage.includes('allocation failed') || 
              errorMessage.includes('heap') ||
              (hotspotErr.stack && hotspotErr.stack.includes('RangeError'))) {
            console.error('Memory error detected during hotspot calculation for large dataset');
            
            // Still add placeholder metrics to avoid UI issues
            const placeholderMetrics = {
              ...(finalHeatmapData.correlationMetrics || {}),
              gaze_hotspots: 0,
              cursor_hotspots: 0,
              common_hotspots: 0,
              hotspot_error: 'Memory error processing large dataset'
            };
            
            finalHeatmapData = {
              ...finalHeatmapData,
              correlationMetrics: placeholderMetrics
            };
            
            console.log('Added placeholder metrics due to processing error:', placeholderMetrics);
          }
        }
        
        // Set the state with our final data
        setHeatmap(finalHeatmapData);
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
      <h1>Просмотр тепловой карты</h1>
      <button className="back-button" onClick={navigateToDashboard}>Вернуться на дашборд</button>
    </div>
  ), [navigateToDashboard]);

  const renderLoading = useMemo(() => (
    <div className="loading-container">
      <div className="loading-spinner"></div>
      <p>Загрузка данных тепловой карты...</p>
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
    const stats = activeView === 'cursor' && heatmap?.cursorStats 
      ? heatmap.cursorStats 
      : heatmap?.stats || placeholderStats;
    
    // Log available metrics for debugging
    if (heatmap) {
      console.log("Available stats for rendering:", {
        stats: stats ? Object.keys(stats) : "none",
        correlationMetrics: heatmap.correlationMetrics ? Object.keys(heatmap.correlationMetrics) : "none"
      });
    }
    
    // Check if correlation metrics exist and log values
    if (heatmap?.correlationMetrics) {
      console.log("Correlation metrics values:", heatmap.correlationMetrics);
    }
    
    // Combine stats with correlation metrics if available
    const combinedStats = {
      ...stats,
      ...(heatmap?.correlationMetrics || {})
    };
    
    return (
      <div className="stats-container">
        <h3>{activeView === 'cursor' ? 'Статистика движений курсора' : 'Статистика отслеживания взгляда'}</h3>
        <div className="stats-header">
          <span>Основные метрики</span>
          <button className="toggle-stats-button" onClick={toggleAdvancedStats}>
            {showAdvancedStats ? 'Скрыть расширенные метрики' : 'Показать расширенные метрики'}
          </button>
        </div>
        
        <div className="stats-grid">
          <MetricCard 
            label="Точки данных" 
            value={getStatValue('pointCount')} 
            description={`Общее количество ${activeView === 'cursor' ? 'точек курсора' : 'точек взгляда'}, зарегистрированных в этой сессии`} 
          />
          <MetricCard 
            label="Области фокуса" 
            value={getStatValue('focus_areas')} 
            description={`Количество различных областей, получивших значительное ${activeView === 'cursor' ? 'внимание курсора' : 'внимание взгляда'}`} 
            min={0}
            max={10}
            optimal={3}
          />
          <MetricCard 
            label="Оценка внимания" 
            value={getStatValue('attention_score')} 
            suffix="%" 
            description="Общая оценка на основе качества и количества фокуса" 
            min={0}
            max={100}
            optimal={75}
          />
          <MetricCard 
            label="Покрытие страницы" 
            value={Math.round(getStatValue('coverage') * 100)} 
            suffix="%" 
            description={`Процент экрана, получивший ${activeView === 'cursor' ? 'внимание курсора' : 'внимание взгляда'}`} 
            min={0}
            max={100}
            optimal={60}
          />
        </div>
        
        {showAdvancedStats && (
          <>
            <div className="advanced-stats-header">
              <h4 className="advanced-stats-title">Расширенные метрики</h4>
              <button className="viz-toggle-button" onClick={toggleVizMode}>
                {advancedStatsVizMode === 'cards' ? 'Показать как график' : 'Показать как карточки'}
              </button>
            </div>
            <div className="advanced-stats">
              <AdvancedMetricsViz 
                stats={combinedStats} 
                vizMode={advancedStatsVizMode}
                correlationMetrics={heatmap?.correlationMetrics}
              />
              
              <div className="metrics-explanation">
                <h5>Понимание метрик</h5>
                <p>Метрики цветом обозначают производительность:</p>
                <ul className="color-legend">
                  <li><span className="color-dot green"></span> <strong>Хорошо </strong> - Значение близко к оптимальному диапазону</li>
                  <li><span className="color-dot yellow"></span> <strong>Предупреждение </strong> - Значение немного выходит за оптимальный диапазон</li>
                  <li><span className="color-dot red"></span> <strong>Плохо </strong> - Значение значительно выходит за оптимальный диапазон</li>
                </ul>
                <p>Наведите на любую метрику для подробного объяснения и ожидаемого диапазона.</p>
              </div>
            </div>
          </>
        )}
      </div>
    );
  }, [heatmap, activeView, placeholderStats, showAdvancedStats, toggleAdvancedStats, toggleVizMode, advancedStatsVizMode, getStatValue]);

  const testCorrelationMetrics = useCallback(async () => {
    console.log("Testing correlation metrics for session:", id);
    
    try {
      setLoading(true);
      
      // Call the dedicated endpoint
      const response = await api.get(`/api/sessions/${id}/correlation_metrics`);
      console.log("Correlation metrics test response:", response.data);
      
      // Update the heatmap state with the correlation metrics
      if (response.data && !response.data.error) {
        setHeatmap(prev => ({
          ...prev,
          correlationMetrics: response.data
        }));
        
        // Show success message
        alert("Correlation metrics updated! Check the console for details.");
      } else {
        console.error("Error:", response.data.error);
        alert(`Error calculating correlation metrics: ${response.data.error}`);
      }
    } catch (error) {
      console.error("Error testing correlation metrics:", error);
      alert(`Error: ${error.message || "Failed to test correlation metrics"}`);
    } finally {
      setLoading(false);
    }
  }, [id]);

  const renderActionButtons = useMemo(() => (
    <div className="action-buttons">
      <button 
        className="action-button view-toggle" 
        onClick={toggleView}
      >
        Переключить на {activeView === 'gaze' ? 'курсор' : 'взгляд'}
      </button>
      
      <button 
        className="action-button player-toggle" 
        onClick={togglePlayer}
      >
        {showPlayer ? 'Скрыть плеер' : 'Показать плеер'}
      </button>
      
      <button 
        className="action-button fullscreen-button" 
        onClick={openFullscreen}
      >
        На весь экран
      </button>
      
      <button 
        className="action-button test-metrics-button" 
        onClick={testCorrelationMetrics}
        disabled={loading}
      >
        Проверить метрики корреляции
      </button>
    </div>
  ), [toggleView, activeView, togglePlayer, showPlayer, openFullscreen, testCorrelationMetrics, loading]);

  return (
    <div className="heatmap-container">
      {renderHeader}

      {loading ? renderLoading : error ? renderError : (
        <div className="heatmap-content">
          <div className="heatmap-info">
            <h2>ID сессии: {id}</h2>
            <p>Создано: {new Date().toLocaleString()}</p>
            <p>Пользователь: {currentUser?.username}</p>
            {heatmap && heatmap.cursorHeatmapUrl && (
              <p className="heatmap-type">
                Текущий просмотр: <strong>{activeView === 'gaze' ? 'Тепловая карта взгляда' : 'Тепловая карта курсора'}</strong>
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
                  <button onClick={resetZoom} className="zoom-reset">Сбросить</button>
                </div>
                {zoomLevel > 1 && (
                  <div className="drag-instructions">
                    <span>Нажмите и перетащите для перемещения изображения</span>
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