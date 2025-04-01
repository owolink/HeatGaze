import React from 'react';
import { useParams } from 'react-router-dom';

const SessionView = () => {
  const { id } = useParams();

  return (
    <div className="session-container">
      <div className="session-header">
        <h1>Просмотр сессии #{id}</h1>
      </div>
      
      <div className="session-content">
        <div className="card">
          <h2>Данные сессии</h2>
          <div className="session-details">
            <div className="detail-item">
              <span className="detail-label">ID:</span>
              <span className="detail-value">{id}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Дата создания:</span>
              <span className="detail-value">-</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Статус:</span>
              <span className="detail-value badge">В работе</span>
            </div>
          </div>
        </div>
        
        <div className="card">
          <h2>Тепловая карта</h2>
          <div className="heatmap-placeholder">
            <p>Данные тепловой карты загружаются...</p>
          </div>
          <button className="btn-primary">Анализировать</button>
        </div>
      </div>
    </div>
  );
};

export default SessionView; 