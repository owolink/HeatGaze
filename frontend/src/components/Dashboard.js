import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useNavigation } from '../context/NavigationContext';
import axios from 'axios';
import './Dashboard.css';

const Dashboard = () => {
  // eslint-disable-next-line no-unused-vars
  const { currentUser } = useAuth();
  // eslint-disable-next-line no-unused-vars
  const { hideNav, showNav } = useNavigation();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedSession, setSelectedSession] = useState(null);
  const [heatmapData, setHeatmapData] = useState(null);
  const [isGeneratingHeatmap, setIsGeneratingHeatmap] = useState(false);

  useEffect(() => {
    // Call showNav on component mount to show navigation
    showNav();
    
    // Optional: Use hideNav on component unmount if needed
    return () => {
      // hideNav(); // Commented out but showing usage
    };
  }, [showNav]); // Adding hideNav to dependencies would require uncommenting it above
  
  useEffect(() => {
    fetchSessions();
  }, []);

  const fetchSessions = async () => {
    try {
      const response = await axios.get('/api/sessions');
      setSessions(response.data);
    } catch (err) {
      console.error('Error fetching sessions:', err);
      setError('Не удалось загрузить сессии. Пожалуйста, попробуйте позже.');
    } finally {
      setLoading(false);
    }
  };

  const handleSessionClick = async (session) => {
    setSelectedSession(session);
    setIsGeneratingHeatmap(true);
    try {
      const response = await axios.get(`/api/sessions/${session.id}/heatmap`);
      setHeatmapData(response.data);
    } catch (err) {
      console.error('Error generating heatmap:', err);
      setError('Не удалось сгенерировать тепловую карту. Пожалуйста, попробуйте позже.');
    } finally {
      setIsGeneratingHeatmap(false);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('ru-RU', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="dashboard-container">
        <div className="loading-spinner"></div>
        <p>Загрузка...</p>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <h1>Панель управления</h1>
        <p>Управление сессиями отслеживания глаз</p>
      </div>

      <div className="dashboard-actions">
        <Link to="/recording" className="action-card">
          <div className="action-icon">🎥</div>
          <h3>Новая запись</h3>
          <p>Записывайте движения глаз на любом сайте</p>
        </Link>
        
        <div className="action-card">
          <div className="action-icon">📊</div>
          <h3>Создать тепловую карту</h3>
          <p>Генерируйте тепловые карты из ваших сессий</p>
        </div>
        
        <div className="action-card">
          <div className="action-icon">📈</div>
          <h3>Аналитика</h3>
          <p>Просматривайте аналитику данных отслеживания глаз</p>
        </div>
      </div>

      <div className="sessions-container">
        <div className="sessions-header">
          <h2>Ваши сессии</h2>
          <span className="sessions-count">{sessions.length} sessions</span>
        </div>

        {error && <div className="error-message">{error}</div>}

        <div className="sessions-list">
          {sessions.length === 0 ? (
            <div className="no-sessions">
              <p>У вас пока нет записанных сессий</p>
              <Link to="/recording" className="start-button">
                Start Your First Recording
              </Link>
            </div>
          ) : (
            <div className="sessions-grid">
              {sessions.map((session) => (
                <div
                  key={session.id}
                  className={`session-card ${selectedSession?.id === session.id ? 'selected' : ''}`}
                  onClick={() => handleSessionClick(session)}
                >
                  <h3>{session.name}</h3>
                  <p>Создано: {formatDate(session.created_at)}</p>
                  <p>Длительность: {session.duration || '0'} сек</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {selectedSession && (
          <div className="heatmap-section">
            <h2>Тепловая карта</h2>
            {isGeneratingHeatmap ? (
              <div className="loading-container">
                <div className="loading-spinner"></div>
                <p>Генерация тепловой карты...</p>
              </div>
            ) : heatmapData ? (
              <div className="heatmap-container">
                <img
                  src={`data:image/png;base64,${heatmapData.image}`}
                  alt="Тепловая карта"
                  className="heatmap-image"
                />
                <div className="heatmap-info">
                  <p><strong>Сессия:</strong> {selectedSession.name}</p>
                  <p><strong>Дата:</strong> {formatDate(selectedSession.created_at)}</p>
                  <p><strong>Точек данных:</strong> {heatmapData.pointCount}</p>
                </div>
              </div>
            ) : (
              <p className="no-heatmap">Нет данных для тепловой карты</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard; 