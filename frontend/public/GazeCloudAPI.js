// GazeCloudAPI.js
// This is a placeholder for the actual GazeCloudAPI implementation
// The real implementation should be downloaded from https://api.gazerecorder.com/GazeCloudAPI.js

const GazeCloudAPI = {
  StartEyeTracking: function() {
    console.log('Starting eye tracking...');
    // Implementation will be added when we have access to the actual API
  },
  
  StopEyeTracking: function() {
    console.log('Stopping eye tracking...');
    // Implementation will be added when we have access to the actual API
  },
  
  OnResult: function(GazeData) {
    // Callback for gaze data
    console.log('Gaze data received:', GazeData);
  },
  
  OnCalibrationComplete: function() {
    // Callback for calibration completion
    console.log('Calibration completed');
  },
  
  OnCamDenied: function() {
    // Callback for camera access denial
    console.log('Camera access denied');
  },
  
  OnError: function(msg) {
    // Callback for errors
    console.error('GazeCloud Error:', msg);
  },
  
  UseClickRecalibration: true
};

window.GazeCloudAPI = GazeCloudAPI; 