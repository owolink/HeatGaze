/* global GazeCloudAPI */
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigation } from '../context/NavigationContext';
import axios from 'axios';
import './SessionRecording.css';
import { generateCoordMap } from '../utils/heatmapper';
import { testCursorEndpoints, inspectCursorData } from '../utils/debugging';

const SessionRecording = () => {
  const { currentUser } = useAuth();
  const { hideNav, showNav } = useNavigation();
  const [sessionName, setSessionName] = useState('');
  const [isStarted, setIsStarted] = useState(false);
  const [isCalibrating, setIsCalibrating] = useState(false);
  const [error, setError] = useState(null);
  const [isOfflineMode, setIsOfflineMode] = useState(false);
  const [cleanupFunction, setCleanupFunction] = useState(null);
  const [cursorTracking, setCursorTracking] = useState(null);
  const [sessionId, setSessionId] = useState(null);

  // Hide nav when calibration starts, show when recording stops
  useEffect(() => {
    if (isCalibrating || isStarted) {
      hideNav();
    } else {
      showNav();
    }

    return () => {
      showNav();
      // Clean up cursor tracking if component unmounts
      if (cursorTracking) {
        cursorTracking.cleanup();
      }
    };
  }, [isCalibrating, isStarted, hideNav, showNav, cursorTracking]);

  // Timer for recording duration
  useEffect(() => {
    let durationInterval;
    const durationElement = document.getElementById('duration');
    
    if (isStarted && durationElement) {
      const startTime = Date.now();
      
      durationInterval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        const minutes = Math.floor(elapsed / 60);
        const seconds = elapsed % 60;
        durationElement.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
      }, 1000);
    }
    
    return () => {
      if (durationInterval) {
        clearInterval(durationInterval);
      }
    };
  }, [isStarted]);

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
    
    // Setup callback for gaze data
    GazeCloudAPI.OnGazeData = handleGazeData;
    
    return true;
  };

  // Handler for gaze data from GazeCloudAPI
  const handleGazeData = (gazeData) => {
    if (!sessionId) return;
    
    // Queue for batching gaze data
    const gazePoint = {
      timestamp: Date.now(),
      x: gazeData.GazeX,
      y: gazeData.GazeY,
      pupilLeftSize: gazeData.LeftPupilSize,
      pupilRightSize: gazeData.RightPupilSize
    };
    
    // Send gaze data to backend
    sendGazeDataPoint(gazePoint);
  };

  // Send a single gaze data point to the backend
  const sendGazeDataPoint = async (point) => {
    try {
      await axios.post(`/api/sessions/${sessionId}/gaze/batch`, [point]);
    } catch (err) {
      console.error('Failed to send gaze data point:', err);
    }
  };

  // Start tracking cursor movements and sending batches to backend
  const startCursorTracking = async (sessionId) => {
    if (!sessionId) return null;
    
    console.log('Starting cursor tracking for session:', sessionId);
    
    // Initialize cursor tracking with heatmapper
    const cursor = generateCoordMap('cursor-' + sessionId);
    
    // Set up cursor data batch sending
    let cursorBatch = [];
    let isTrackingActive = true; // Add a flag to track if tracking is active
    const sessionStartTime = Date.now(); // Record when the session started
    
    // Validate and sanitize timestamp to prevent future dates
    const getSafeTimestamp = () => {
      const now = Date.now();
      // If client clock is wrong (in the future), use epoch time plus elapsed session time
      if (now > sessionStartTime + (365 * 24 * 60 * 60 * 1000)) { // More than a year in the future
        console.warn('Detected potentially incorrect system clock (timestamp too far in future)');
        return sessionStartTime + (now - sessionStartTime); // Elapsed time since session start
      }
      return now;
    };
    
    const batchInterval = setInterval(async () => {
      if (cursorBatch.length === 0) {
        console.log('No cursor data to send in this batch interval');
        return;
      }
      
      const batchToSend = [...cursorBatch];
      cursorBatch = [];
      
      console.log(`Sending batch of ${batchToSend.length} cursor points to server`);
      
      try {
        const response = await axios.post(`/api/sessions/${sessionId}/cursor/batch`, batchToSend);
        console.log('Cursor batch response:', response.data);
      } catch (err) {
        console.error('Failed to send cursor batch:', err);
        // Log more detailed error information
        console.error('Error details:', err.response ? err.response.data : 'No response data');
        console.error('Status code:', err.response ? err.response.status : 'Unknown');
        
        // Add points back to the batch if there was an error
        cursorBatch = [...batchToSend, ...cursorBatch];
      }
    }, 2000);
    
    // Set up the mousemove event listener
    const trackCursor = (e) => {
      if (!isTrackingActive) {
        console.log('Cursor tracking is not active, ignoring mouse movement');
        return;
      }
      
      const timestamp = getSafeTimestamp();
      const x = e.clientX;
      const y = e.clientY;
      
      // Enhanced debugging - log every 10th point to avoid flooding console
      if (cursorBatch.length % 10 === 0) {
        console.log(`Cursor position: x=${x}, y=${y}, timestamp=${timestamp}`);
        console.log(`Current batch size: ${cursorBatch.length}, session ID: ${sessionId}`);
        console.log(`Document is active: ${document.hasFocus()}, visible: ${document.visibilityState === 'visible'}`);
      }
      
      // Add to cursor mapping
      cursor.addCoord({
        x: x,
        y: y,
        timestamp: timestamp
      });
      
      // Add to batch for server
      cursorBatch.push({
        x: x,
        y: y,
        timestamp: timestamp
      });
      
      // If batch gets too large, send immediately
      if (cursorBatch.length >= 50) {
        console.log(`Batch limit reached, sending ${cursorBatch.length} cursor points immediately`);
        const batchToSend = [...cursorBatch];
        cursorBatch = [];
        
        axios.post(`/api/sessions/${sessionId}/cursor/batch`, batchToSend)
          .then(response => console.log('Immediate cursor batch response:', response.data))
          .catch(err => {
            console.error('Failed to send immediate cursor batch:', err);
            console.error('Error details:', err.response ? err.response.data : 'No response data');
            console.error('Status code:', err.response ? err.response.status : 'Unknown');
            
            // Add points back to the batch if there was an error
            cursorBatch = [...batchToSend, ...cursorBatch];
          });
      }
    };
    
    // Add our custom handler
    document.addEventListener('mousemove', trackCursor);
    console.log('Successfully added mousemove event listener to document');
    
    // Create a test event to verify tracking works
    setTimeout(() => {
      const testEvent = new MouseEvent('mousemove', {
        clientX: 100,
        clientY: 100,
        bubbles: true,
        cancelable: true
      });
      document.dispatchEvent(testEvent);
      console.log('Dispatched test mouse event');
    }, 500);
    
    // Return cleanup function
    return {
      cleanup: () => {
        isTrackingActive = false; // Signal to stop tracking
        clearInterval(batchInterval);
        document.removeEventListener('mousemove', trackCursor);
        
        // Send any remaining data
        if (cursorBatch.length > 0) {
          console.log(`Sending ${cursorBatch.length} remaining cursor points before cleanup`);
          axios.post(`/api/sessions/${sessionId}/cursor/batch`, cursorBatch)
            .then(response => console.log('Final cursor batch response:', response.data))
            .catch(err => console.error('Failed to send final cursor batch:', err));
        }
        
        // Also clean up the heatmapper tracking
        cursor.cleanup();
        console.log('Cursor tracking cleaned up');
      }
    };
  };

  const startOfflineMode = async (sessionId) => {
    console.log("Starting offline fallback mode");
    
    // Temporary local queue for this function's scope
    let localQueue = [];
    
    // Function to send a batch of gaze data
    const sendGazeDataBatch = async () => {
      if (localQueue.length === 0) return;
      
      try {
        await axios.post(`/api/sessions/${sessionId}/gaze/batch`, localQueue);
        localQueue = []; // Clear queue after successful send
      } catch (err) {
        console.error('Failed to send gaze data batch:', err);
      }
    };
    
    // Function to add a data point to the queue
    const addGazeDataPoint = (x, y) => {
      const dataPoint = {
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
    
    // Start cursor tracking separately (for heatmap)
    const cursorTracker = await startCursorTracking(sessionId);
    setCursorTracking(cursorTracker);
    
    // Update UI state
    setIsOfflineMode(true);
    setIsCalibrating(false);
    setIsStarted(true);
    
    // Return cleanup function
    return () => {
      document.removeEventListener('mousemove', trackMouseMovement);
      clearInterval(batchInterval);
      sendGazeDataBatch(); // Send any remaining data
      
      // Clean up cursor tracking
      if (cursorTracker) {
        cursorTracker.cleanup();
      }
      
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
      
      const newSessionId = response.data.id;
      console.log('Created new session with ID:', newSessionId);
      setSessionId(newSessionId);
      
      // Run diagnostic tests on cursor endpoints
      const { token } = await axios.get('/api/check-auth');
      if (token) {
        console.log('Running cursor endpoint diagnostic tests...');
        const testResults = await testCursorEndpoints(newSessionId, token);
        console.log('Cursor endpoint test results:', testResults);
        
        if (testResults.status !== 'success') {
          console.warn('Cursor endpoint tests failed. Check network and backend logs.');
        }
      }
      
      // Start cursor tracking regardless of gaze tracking availability
      console.log('Initializing cursor tracking module...');
      const cursorTracker = await startCursorTracking(newSessionId);
      
      if (cursorTracker) {
        console.log('Cursor tracking module initialized successfully');
        setCursorTracking(cursorTracker);
      } else {
        console.error('Failed to initialize cursor tracking module');
        setError('Не удалось инициализировать модуль отслеживания курсора');
      }
      
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
        const cleanupOfflineMode = await startOfflineMode(newSessionId);
        setCleanupFunction(() => cleanupOfflineMode);
      }

      // Extra check to verify cursor tracking is working
      setTimeout(() => {
        console.log('Cursor tracking active check - cursorTracking object:', cursorTracking !== null);
        // Move mouse to test tracking
        const event = new MouseEvent('mousemove', {
          clientX: 100,
          clientY: 100,
          bubbles: true,
          cancelable: true
        });
        document.dispatchEvent(event);
        console.log('Dispatched test mouse event');
      }, 2000);

    } catch (err) {
      console.error('Error starting session:', err);
      setError('Не удалось начать запись сессии. Пожалуйста, попробуйте снова.');
      if (err.response) {
        console.error('Response status:', err.response.status);
        console.error('Response data:', err.response.data);
      }
    }
  };

  const handleStopRecording = async () => {
    // Stop eye tracking if active
    if (typeof GazeCloudAPI !== 'undefined' && !isOfflineMode) {
      GazeCloudAPI.StopEyeTracking();
    }
    
    // Run cleanup for offline mode
    if (cleanupFunction) {
      cleanupFunction();
      setCleanupFunction(null);
    }
    
    // Clean up cursor tracking
    if (cursorTracking) {
      cursorTracking.cleanup();
      setCursorTracking(null);
    }
    
    // Mark the session as ended in the backend
    if (sessionId) {
      try {
        await axios.put(`/api/sessions/${sessionId}/end`);
      } catch (err) {
        console.error('Error ending session:', err);
      }
    }
    
    setIsStarted(false);
  };

  return (
    <div className="recording-container">
      <div className="recording-header">
        <h1>Сессия отслеживания</h1>
        <p>Записывайте движения глаз и курсора для создания тепловых карт</p>
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
          
          <p>Двигайте глазами и курсором по экрану. Отслеживание активно.</p>
          
          <div className="status-info">
            <p><strong>Сессия:</strong> {sessionName}</p>
            <p><strong>Пользователь:</strong> {currentUser.username}</p>
            <p><strong>Длительность:</strong> <span id="duration">00:00</span></p>
            <p><strong>Режимы:</strong> {isOfflineMode ? 'Курсор (мышь)' : 'Глаза + Курсор'}</p>
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