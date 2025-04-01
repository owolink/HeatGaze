import axios from 'axios';

// This is a wrapper for the GazeCloudAPI
class EyeTrackingService {
  constructor() {
    this.isInitialized = false;
    this.currentSession = null;
    this.gazeData = [];
    this.isRecording = false;
    this.initRetries = 0;
    this.maxRetries = 10;
  }

  async initialize() {
    if (this.isInitialized) return;

    // Check if GazeCloudAPI is available with retry logic
    if (typeof window.GazeCloudAPI === 'undefined') {
      if (this.initRetries >= this.maxRetries) {
        throw new Error('GazeCloudAPI failed to load after multiple attempts. Please refresh the page.');
      }
      
      // Wait for API to be available - it might be still loading
      console.log('Waiting for GazeCloudAPI to load...', this.initRetries);
      this.initRetries++;
      
      // Wait and try again
      await new Promise(resolve => setTimeout(resolve, 500));
      return this.initialize();
    }

    // Set up event handlers
    window.GazeCloudAPI.OnCalibrationComplete = this.handleCalibrationComplete.bind(this);
    window.GazeCloudAPI.OnCamDenied = this.handleCamDenied.bind(this);
    window.GazeCloudAPI.OnError = this.handleError.bind(this);
    window.GazeCloudAPI.OnGazeEvent = this.handleGazeEvent.bind(this);

    this.isInitialized = true;
    console.log('Eye tracking service initialized');
  }

  async startSession() {
    try {
      // Create a session in the backend
      const response = await axios.post('/api/sessions', {
        name: `Session ${new Date().toLocaleString()}`,
        deviceInfo: navigator.userAgent
      });

      this.currentSession = response.data;
      return this.currentSession;
    } catch (error) {
      console.error('Failed to create session:', error);
      throw new Error('Failed to create session');
    }
  }

  async startTracking() {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      // Start a new session if not already started
      if (!this.currentSession) {
        await this.startSession();
      }

      // Clear previous gaze data
      this.gazeData = [];
      this.isRecording = true;

      // Start the GazeCloud tracking
      window.GazeCloudAPI.StartEyeTracking();

      return this.currentSession;
    } catch (error) {
      console.error('Error starting tracking:', error);
      throw error;
    }
  }

  stopTracking() {
    if (this.isRecording) {
      // Stop the GazeCloud tracking
      window.GazeCloudAPI.StopEyeTracking();
      this.isRecording = false;

      // Send the collected data to the server
      this.saveGazeData();
    }
  }

  async saveGazeData() {
    if (!this.currentSession || this.gazeData.length === 0) return;

    try {
      await axios.post(`/api/sessions/${this.currentSession.id}/data`, {
        gazeData: this.gazeData
      });
      console.log('Gaze data saved successfully');
    } catch (error) {
      console.error('Failed to save gaze data:', error);
    }
  }

  // GazeCloudAPI event handlers
  handleCalibrationComplete() {
    console.log('Calibration complete');
  }

  handleCamDenied() {
    console.error('Camera access denied');
    this.isRecording = false;
  }

  handleError(error) {
    console.error('GazeCloudAPI error:', error);
    this.isRecording = false;
  }

  handleGazeEvent(gazeData) {
    // Store gaze data with timestamp
    if (this.isRecording && this.currentSession) {
      const dataPoint = {
        timestamp: Date.now(),
        x: gazeData.GazeX,
        y: gazeData.GazeY,
        pupilLeftSize: gazeData.LeftPupilSize,
        pupilRightSize: gazeData.RightPupilSize,
        sessionId: this.currentSession.id
      };
      
      this.gazeData.push(dataPoint);
      
      // Periodically save data to avoid memory issues
      if (this.gazeData.length >= 100) {
        this.saveGazeData();
        this.gazeData = [];
      }
    }
  }
}

export default new EyeTrackingService(); 