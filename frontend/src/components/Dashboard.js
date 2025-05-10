import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigation } from '../context/NavigationContext';
import api from '../utils/api';
import './Dashboard.css';
import { useNavigate } from 'react-router-dom';

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
  const navigate = useNavigate();

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
      setLoading(true);
      setError(null);
      
      console.log('Fetching sessions...');
      const response = await api.get('/api/sessions');
      setSessions(response.data);
      console.log('Sessions fetched successfully:', response.data);
    } catch (err) {
      console.error('Error fetching sessions:', err);
      
      // Handle authentication errors
      if (err.response && err.response.status === 401) {
        setError('Authentication error. Please log in again.');
        // Note: The redirect is now handled by the API interceptor
      } else {
        setError('Failed to load sessions. Please try again later.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSessionClick = async (session) => {
    setSelectedSession(session);
    setIsGeneratingHeatmap(true);
    try {
      const response = await api.get(`/api/sessions/${session.id}/heatmap`);
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

  const formatDuration = (seconds) => {
    if (!seconds) return '0 сек';
    
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    
    if (minutes > 0) {
      return `${minutes} мин ${remainingSeconds} сек`;
    } else {
      return `${seconds} сек`;
    }
  };
  
  const calculateSessionDuration = (session) => {
    if (!session.updated_at) return 0;
    
    const startTime = new Date(session.created_at).getTime();
    const endTime = new Date(session.updated_at).getTime();
    return Math.floor((endTime - startTime) / 1000); // Convert ms to seconds
  };

  const handleActionClick = (action) => {
    switch (action) {
      case 'record':
        navigate('/record');
        break;
      case 'heatmap':
        navigate('/recordings');
        break;
      case 'analysis':
        navigate('/analysis');
        break;
      default:
        break;
    }
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
        <p>Анализ данных и тепловых карт отслеживания взгляда</p>
      </div>

      <div className="dashboard-actions">
        <div className="action-cards">
          <a href="http://localhost:8000" target="_blank" rel="noopener noreferrer" className="action-card">
            <div className="action-icon">🎥</div>
            <h3>Создать новую запись</h3>
            <p>Перейдите на сайт записи для создания новых сессий отслеживания взгляда</p>
          </a>
          
          <div className="action-card" onClick={() => handleActionClick('heatmap')}>
            <div className="action-icon">
              <i className="fas fa-fire"></i>
            </div>
            <h3>Создать тепловую карту</h3>
            <p>Просмотреть и проанализировать записи сессий</p>
          </div>
          
          <div className="action-card" onClick={() => handleActionClick('analysis')}>
            <div className="action-icon">
              <i className="fas fa-chart-bar"></i>
            </div>
            <h3>Анализ данных</h3>
            <p>Подробный анализ собранных данных</p>
          </div>
        </div>
      </div>

      <div className="sessions-container">
        <div className="sessions-header">
          <h2>Ваши записанные сессии</h2>
          <span className="sessions-count">{sessions.length} sessions</span>
        </div>

        {error && <div className="error-message">{error}</div>}

        <div className="sessions-list">
          {sessions.length === 0 ? (
            <div className="no-sessions">
              <p>У вас пока нет записанных сессий</p>
              <a href="http://localhost:8000" target="_blank" rel="noopener noreferrer" className="start-button">
                Записать вашу первую сессию
              </a>
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
                  <p>Длительность: {formatDuration(calculateSessionDuration(session))}</p>
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
            ) : heatmapData && heatmapData.image ? (
              <div className="heatmap-container">
                <div className="heatmap-image-wrapper">
                  <img
                    src={`data:image/png;base64,${heatmapData.image}`}
                    alt="Тепловая карта"
                    className="heatmap-image"
                  />
                </div>
                <div className="heatmap-info">
                  <p><strong>Сессия:</strong> {selectedSession.name}</p>
                  <p><strong>Дата:</strong> {formatDate(selectedSession.created_at)}</p>
                  <p><strong>Точек данных:</strong> {heatmapData.stats.pointCount}</p>
                  <p><strong>Области фокуса:</strong> {heatmapData.stats.focus_areas}</p>
                  <p><strong>Оценка внимания:</strong> {heatmapData.stats.attention_score}%</p>
                  <p><strong>Покрытие:</strong> {Math.round(heatmapData.stats.coverage * 100)}%</p>
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