/* global GazeCloudAPI */
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigation } from '../context/NavigationContext';
import axios from 'axios';
import './SessionRecording.css';

const SessionRecording = () => {
  const { currentUser } = useAuth();
  const { hideNav, showNav } = useNavigation();
  const [sessionName, setSessionName] = useState('');
  const [isStarted, setIsStarted] = useState(false);
  const [isCalibrating, setIsCalibrating] = useState(false);
  const [error, setError] = useState(null);
  const [isOfflineMode, setIsOfflineMode] = useState(false);
  const [cleanupFunction, setCleanupFunction] = useState(null);

  // Hide nav when calibration starts, show when recording stops
  useEffect(() => {
    if (isCalibrating || isStarted) {
      hideNav();
    } else {
      showNav();
    }

    return () => {
      showNav();
    };
  }, [isCalibrating, isStarted, hideNav, showNav]);

  const initializeGazeTracking = () => {
    // Check if GazeCloudAPI is available
    if (typeof GazeCloudAPI === 'undefined') {
      setError('Библиотека отслеживания глаз недоступна. Проверьте подключение.');
      return false;
    }
    
    // Configure error handling
    GazeCloudAPI.OnError = (msg) => {
      console.error('GazeCloud Error:', msg);
      setError(`Ошибка отслеживания глаз: ${msg}. Попробуйте обновить страницу.`);
      setIsCalibrating(false);
    };
    
    // Configure callbacks
    GazeCloudAPI.OnCalibrationComplete = () => {
      console.log('Calibration completed successfully');
      setIsCalibrating(false);
      setIsStarted(true);
    };
    
    // Handle connection status
    GazeCloudAPI.OnConnected = () => {
      console.log('Connected to GazeCloud');
      setError(null);
    };
    
    return true;
  };

  const startOfflineMode = async (sessionId) => {
    console.log("Starting offline fallback mode");
    
    // Temporary local queue for this function's scope
    let localQueue = [];
    
    // Function to send a batch of gaze data
    const sendGazeDataBatch = async () => {
      if (localQueue.length === 0) return;
      
      try {
        await axios.post('/api/batch', localQueue);
        localQueue = []; // Clear queue after successful send
      } catch (err) {
        console.error('Failed to send gaze data batch:', err);
      }
    };
    
    // Function to add a data point to the queue
    const addGazeDataPoint = (x, y) => {
      const dataPoint = {
        session_id: sessionId,
        timestamp: Date.now(),
        x: x,
        y: y,
        pupil_left: null,
        pupil_right: null
      };
      
      localQueue.push(dataPoint);
      
      // Send batch when we reach 10 points
      if (localQueue.length >= 10) {
        sendGazeDataBatch();
      }
    };
    
    // Use mouse position as a simple fallback for eye tracking
    const trackMouseMovement = (e) => {
      // Get mouse coordinates relative to viewport
      const x = e.clientX;
      const y = e.clientY;
      
      // Add as gaze data point
      addGazeDataPoint(x, y);
    };
    
    // Set up interval to regularly send batches
    const batchInterval = setInterval(sendGazeDataBatch, 2000);
    
    // Start tracking mouse movements
    document.addEventListener('mousemove', trackMouseMovement);
    
    // Update UI state
    setIsOfflineMode(true);
    setIsCalibrating(false);
    setIsStarted(true);
    
    // Return cleanup function
    return () => {
      document.removeEventListener('mousemove', trackMouseMovement);
      clearInterval(batchInterval);
      sendGazeDataBatch(); // Send any remaining data
      setIsOfflineMode(false);
    };
  };

  const handleStartRecording = async () => {
    if (!sessionName.trim()) {
      setError('Пожалуйста, введите название сессии');
      return;
    }

    try {
      // Create a new session
      const response = await axios.post('/api/sessions', {
        name: sessionName,
        deviceInfo: navigator.userAgent
      });
      
      const sessionId = response.data.id;
      
      // Try to initialize GazeCloudAPI
      let gazeCloudAvailable = false;
      if (typeof GazeCloudAPI !== 'undefined') {
        gazeCloudAvailable = initializeGazeTracking();
      }
      
      if (gazeCloudAvailable) {
        // Use GazeCloudAPI for tracking
        setIsCalibrating(true);
        GazeCloudAPI.StartEyeTracking();
      } else {
        // Fall back to offline mode
        setError('Сервис отслеживания глаз недоступен. Используется режим отслеживания мыши.');
        const cleanupOfflineMode = await startOfflineMode(sessionId);
        setCleanupFunction(() => cleanupOfflineMode);
      }
    } catch (err) {
      console.error('Error starting session:', err);
      setError('Не удалось начать запись сессии. Пожалуйста, попробуйте снова.');
    }
  };

  const handleStopRecording = () => {
    if (typeof GazeCloudAPI !== 'undefined' && !isOfflineMode) {
      GazeCloudAPI.StopEyeTracking();
    }
    
    // Run cleanup if in offline mode
    if (cleanupFunction) {
      cleanupFunction();
      setCleanupFunction(null);
    }
    
    setIsStarted(false);
  };

  return (
    <div className="recording-container">
      <div className="recording-header">
        <h1>Сессия отслеживания глаз</h1>
        <p>Записывайте движения глаз и создавайте тепловые карты</p>
      </div>

      {error && <div className="error-message">{error}</div>}

      {!isStarted ? (
        <div className="setup-container">
          <div className="form-group">
            <label htmlFor="sessionName">Название сессии</label>
            <input
              type="text"
              id="sessionName"
              value={sessionName}
              onChange={(e) => setSessionName(e.target.value)}
              placeholder="Введите название для этой сессии"
              disabled={isCalibrating}
            />
          </div>

          <button 
            className="start-button" 
            onClick={handleStartRecording}
            disabled={isCalibrating}
          >
            {isCalibrating ? 'Калибровка...' : 'Начать запись'}
          </button>

          {isCalibrating && (
            <div className="calibration-container">
              <div className="loading-spinner"></div>
              <p>Калибровка отслеживания глаз. Пожалуйста, смотрите на экран...</p>
            </div>
          )}
        </div>
      ) : (
        <div className="recording-active">
          <div className="recording-indicator">
            <div className="recording-dot"></div>
            <span>Запись</span>
          </div>
          
          <p>Двигайте глазами по экрану. Отслеживание активно.</p>
          
          <div className="status-info">
            <p><strong>Сессия:</strong> {sessionName}</p>
            <p><strong>Пользователь:</strong> {currentUser.username}</p>
            <p><strong>Длительность:</strong> <span id="duration">00:00</span></p>
          </div>
          
          <button className="stop-button" onClick={handleStopRecording}>
            Остановить запись
          </button>
        </div>
      )}
    </div>
  );
};

export default SessionRecording; 