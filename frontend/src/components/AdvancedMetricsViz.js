const renderMetricCard = (metric) => {
  const value = stats[metric.key];
  const { label, description, min, max, optimal } = metric;
  const quality = getMetricQuality(value, min, max, optimal);
  
  return (
    <div className={`metric-card ${quality}`} key={metric.key}>
      <div className="metric-header">
        <h4>{label}</h4>
        <span className="metric-value">{value?.toFixed(2) || '0.00'}</span>
      </div>
      <p className="metric-description">{description}</p>
      <div className="metric-range">
        <span>Оптимальный диапазон: {min} - {max}</span>
        {optimal !== undefined && <span>Оптимальное значение: {optimal}</span>}
      </div>
    </div>
  );
};

const renderMetricBar = (metric) => {
  const value = stats[metric.key];
  const { label, description, min, max, optimal } = metric;
  const quality = getMetricQuality(value, min, max, optimal);
  
  return (
    <div className={`metric-bar ${quality}`} key={metric.key}>
      <div className="metric-bar-header">
        <h4>{label}</h4>
        <span className="metric-value">{value?.toFixed(2) || '0.00'}</span>
      </div>
      <div className="metric-bar-chart">
        <div className="metric-bar-fill" style={{ width: `${((value - min) / (max - min)) * 100}%` }}></div>
        {optimal !== undefined && (
          <div 
            className="metric-bar-optimal" 
            style={{ left: `${((optimal - min) / (max - min)) * 100}%` }}
          ></div>
        )}
      </div>
      <p className="metric-description">{description}</p>
      <div className="metric-range">
        <span>Оптимальный диапазон: {min} - {max}</span>
        {optimal !== undefined && <span>Оптимальное значение: {optimal}</span>}
      </div>
    </div>
  );
};

const renderCorrelationMetrics = () => {
  if (!correlationMetrics) return null;

  const metrics = [
    {
      key: 'kl_divergence',
      label: 'KL Дивергенция',
      description: 'Мера различия между распределениями взгляда и курсора',
      min: 0,
      max: 2,
      optimal: 0.5
    },
    {
      key: 'nss',
      label: 'NSS (Нормализованная сканирующая оценка)',
      description: 'Мера корреляции между взглядом и курсором',
      min: 0,
      max: 3,
      optimal: 1.5
    },
    {
      key: 'similarity',
      label: 'Схожесть',
      description: 'Мера схожести между паттернами взгляда и курсора',
      min: 0,
      max: 1,
      optimal: 0.7
    },
    {
      key: 'correlation',
      label: 'Корреляция',
      description: 'Статистическая корреляция между взглядом и курсором',
      min: -1,
      max: 1,
      optimal: 0.8
    },
    {
      key: 'auc',
      label: 'AUC (Площадь под кривой)',
      description: 'Мера точности предсказания взгляда на основе курсора',
      min: 0.5,
      max: 1,
      optimal: 0.8
    }
  ];

  return (
    <div className="correlation-metrics">
      <h4>Метрики корреляции</h4>
      <div className="correlation-metrics-grid">
        {metrics.map(metric => (
          <div key={metric.key} className="correlation-metric-card">
            <h5>{metric.label}</h5>
            <div className="metric-value">{correlationMetrics[metric.key]?.toFixed(3) || '0.000'}</div>
            <p>{metric.description}</p>
            <div className="metric-range">
              <span>Оптимальный диапазон: {metric.min} - {metric.max}</span>
              {metric.optimal !== undefined && <span>Оптимальное значение: {metric.optimal}</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const AdvancedMetricsViz = ({ stats, vizMode, correlationMetrics }) => {
  // Log what's being passed to the component
  console.log("AdvancedMetricsViz received:", {
    stats: stats ? Object.keys(stats) : "none",
    correlationMetrics: correlationMetrics ? Object.keys(correlationMetrics) : "none"
  });
  
  if (vizMode === 'chart') {
    // Simple bar chart for metrics
    const metrics = [
      { key: 'kld', label: 'KL Дивергенция', max: 2, reversed: true },
      { key: 'nss', label: 'NSS', max: 3 },
      { key: 'similarity', label: 'Схожесть', max: 1 },
      { key: 'cc', label: 'Корреляция', max: 1 },
      { key: 'auc', label: 'AUC', max: 1 },
      { key: 'mean_intensity', label: 'Средняя интенсивность', max: 1 },
      { key: 'std_dev', label: 'Стандартное отклонение', max: 0.5 }
    ];
    
    // Add correlation metrics to chart if available
    if (correlationMetrics) {
      const correlationMetricItems = [
        { key: 'correlation_coefficient', label: 'PCC', max: 1 },
        { key: 'histogram_intersection', label: 'HI', max: 1 },
        { key: 'kl_divergence', label: 'KLD', max: 2, reversed: true },
        { key: 'iou', label: 'IoU', max: 1 },
        { key: 'common_hotspots', label: 'Области фокуса', max: 10 }
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
      description: "Измеряет отличие от равномерного распределения. Меньшие значения указывают на более равномерное внимание.",
      reversed: true
    },
    nss: { 
      min: -2, max: 3, optimal: 1.5, 
      description: "Нормализованная сканирующая оценка (NSS). Типичный диапазон: -2 до 3. Значения > 1 указывают на высокую релевантность точек фиксации, значения < 0 указывают на фиксации в нерелевантных областях.",
      label: "NSS"
    },
    similarity: { 
      min: 0, max: 1, optimal: 0.7, 
      description: "Пересечение гистограмм с равномерной картой. Более высокие значения указывают на большее сходство с базовым распределением." 
    },
    cc: { 
      min: -1, max: 1, optimal: 0.7, 
      description: "Линейная корреляция с равномерным распределением. Значения ближе к 1 указывают на более сильную положительную корреляцию." 
    },
    auc: { 
      min: 0, max: 1, optimal: 0.8, 
      description: "Площадь под ROC-кривой. Значения выше 0.5 указывают на предсказание фиксаций лучше случайного (максимум 1.0)." 
    },
    mean_intensity: { 
      min: 0, max: 1, optimal: 0.5, 
      description: "Средняя интенсивность по тепловой карте. Более высокие значения указывают на более сильный общий фокус." 
    },
    median_intensity: { 
      min: 0, max: 1, optimal: 0.4, 
      description: "Медианное значение интенсивности. Менее подвержено влиянию выбросов, чем среднее значение."
    },
    std_dev: { 
      min: 0, max: 0.5, optimal: 0.25, 
      description: "Стандартное отклонение интенсивностей. Более высокие значения указывают на большее варьирование фокуса."
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
      description: "Средняя скорость изменения интенсивности. Более высокие значения указывают на более четкие границы фокуса."
    },
    correlation_coefficient: { 
      min: -1, max: 1, optimal: 0.7, 
      description: "Коэффициент корреляции Пирсона (PCC). Диапазон: -1 до 1. 1 указывает на идеальную положительную корреляцию, 0 указывает на отсутствие линейной связи, -1 указывает на идеальную отрицательную корреляцию.",
      label: "Коэффициент корреляции"
    },
    histogram_intersection: { 
      min: 0, max: 1, optimal: 0.7, 
      description: "Пересечение гистограмм. Диапазон: 0 до 1. Более высокие значения указывают на большее сходство распределений между тепловыми картами взгляда и курсора.",
      label: "Пересечение гистограмм"
    },
    kl_divergence: { 
      min: 0, max: 2, optimal: 0.5, reversed: true,
      description: "Дивергенция Кульбака-Лейблера между распределениями взгляда и курсора. Меньшие значения указывают на более похожие распределения.",
      label: "KL Дивергенция"
    },
    iou: { 
      min: 0, max: 1, optimal: 0.7, 
      description: "Пересечение над объединением (IoU). Диапазон: 0 до 1. 1 указывает на идеальное перекрытие бинарных карт, 0 указывает на отсутствие перекрытия.",
      label: "IoU"
    },
    common_hotspots: { 
      min: 0, max: 10, optimal: 3, 
      description: "Количество значимых областей внимания, которые появляются в обеих тепловых картах взгляда и курсора. Определяется путем пороговой обработки и поиска перекрывающихся областей высокой интенсивности.",
      label: "Общие области фокуса"
    },
    gaze_hotspots: {
      min: 0, max: 10, optimal: 3,
      description: "Количество различных областей высокого внимания в тепловой карте взгляда, обнаруженных с помощью пороговой обработки и анализа связанных компонентов.",
      label: "Области фокуса взгляда"
    },
    cursor_hotspots: {
      min: 0, max: 10, optimal: 3,
      description: "Количество различных областей высокой активности в тепловой карте курсора, обнаруженных с помощью пороговой обработки и анализа связанных компонентов.",
      label: "Области фокуса курсора"
    }
  };
  
  // Group metrics into categories
  const metricGroups = {
    attention: [
      { key: 'kld', label: 'KL Дивергенция' },
      { key: 'nss', label: 'NSS' },
      { key: 'similarity', label: 'Схожесть' },
      { key: 'cc', label: 'Корреляция' },
      { key: 'auc', label: 'AUC' }
    ],
    intensity: [
      { key: 'mean_intensity', label: 'Средняя интенсивность' },
      { key: 'median_intensity', label: 'Медианная интенсивность' },
      { key: 'std_dev', label: 'Стандартное отклонение' },
      { key: 'high_activity_proportion', label: 'Высокая активность', suffix: '%' },
      { key: 'low_activity_proportion', label: 'Низкая активность', suffix: '%' },
      { key: 'mean_gradient', label: 'Градиент' }
    ],
    correlation: correlationMetrics ? [
      { key: 'correlation_coefficient', label: 'PCC' },
      { key: 'histogram_intersection', label: 'HI' },
      { key: 'kl_divergence', label: 'KLD' },
      { key: 'iou', label: 'IoU' },
      { key: 'common_hotspots', label: 'Области фокуса' }
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
          <h4>Метрики корреляции взгляда и курсора</h4>
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

export default AdvancedMetricsViz; 