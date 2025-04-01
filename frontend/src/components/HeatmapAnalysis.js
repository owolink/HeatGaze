import React from 'react';
import { useParams } from 'react-router-dom';

const HeatmapAnalysis = () => {
  const { id } = useParams();

  return (
    <div className="analysis-container">
      <div className="analysis-header">
        <h1>Анализ тепловой карты #{id}</h1>
      </div>
      
      <div className="analysis-content">
        <div className="card">
          <h2>Общая информация</h2>
          <div className="analysis-details">
            <div className="detail-item">
              <span className="detail-label">ID сессии:</span>
              <span className="detail-value">{id}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Время анализа:</span>
              <span className="detail-value">-</span>
            </div>
          </div>
        </div>
        
        <div className="card">
          <h2>Тепловая карта</h2>
          <div className="heatmap-container">
            <div className="heatmap-placeholder">
              <p>Тепловая карта еще не сгенерирована</p>
            </div>
          </div>
        </div>
        
        <div className="card">
          <h2>Метрики</h2>
          <div className="metrics-grid">
            <div className="metric-card">
              <h3>Активность взгляда</h3>
              <div className="metric-value">-</div>
            </div>
            <div className="metric-card">
              <h3>Фокусировка</h3>
              <div className="metric-value">-</div>
            </div>
            <div className="metric-card">
              <h3>Покрытие экрана</h3>
              <div className="metric-value">-</div>
            </div>
            <div className="metric-card">
              <h3>Время просмотра</h3>
              <div className="metric-value">-</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HeatmapAnalysis; 