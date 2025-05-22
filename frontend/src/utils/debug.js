// Utility for debugging API responses and data structures
import api from './api';

/**
 * Deeply inspects a response structure and logs it to console
 * 
 * @param {Object} data - The data to inspect
 * @param {String} label - A label for the data in the console
 */
export const inspectStructure = (data, label = 'Data Structure') => {
  console.log(`--- ${label} ---`);
  
  if (!data) {
    console.log('Data is null or undefined');
    return;
  }
  
  try {
    // Log the top level keys
    console.log('Top level keys:', Object.keys(data));
    
    // For objects, log their type and structure
    Object.entries(data).forEach(([key, value]) => {
      const type = typeof value;
      
      if (value === null) {
        console.log(`${key}: null`);
      } else if (type === 'object') {
        if (Array.isArray(value)) {
          console.log(`${key}: Array[${value.length}]`);
          if (value.length > 0) {
            console.log(`  Sample item:`, value[0]);
          }
        } else {
          console.log(`${key}: Object {${Object.keys(value).join(', ')}}`);
          
          // For metrics specifically, log more details
          if (key === 'correlationMetrics' || key === 'stats' || key === 'cursorStats') {
            console.log(`  ${key} values:`, value);
          }
        }
      } else {
        console.log(`${key}: ${type} = ${value}`);
      }
    });
  } catch (error) {
    console.error('Error inspecting structure:', error);
  }
  
  console.log(`--- End of ${label} ---`);
};

/**
 * Logs a warning if an object contains only 0 values
 * 
 * @param {Object} obj - The object to check
 * @param {String} label - A label for the console log
 * @returns {Boolean} - Whether the object contains only zeros
 */
export const checkForZeroValues = (obj, label = 'Object') => {
  if (!obj || typeof obj !== 'object') return false;
  
  const keys = Object.keys(obj);
  if (keys.length === 0) {
    console.log(`${label} is empty`);
    return false;
  }
  
  const allZeros = keys.every(key => {
    const value = obj[key];
    return typeof value === 'number' && value === 0;
  });
  
  if (allZeros) {
    console.warn(`Warning: ${label} contains only zero values:`, obj);
  }
  
  return allZeros;
};

/**
 * Directly tests the correlation metrics calculation for a session
 * 
 * @param {String|Number} sessionId - The session ID to test
 * @returns {Promise<Object>} - The correlation metrics data
 */
export const testCorrelationMetrics = async (sessionId) => {
  console.log(`Testing correlation metrics for session ${sessionId}...`);
  
  try {
    // First get the heatmap data to see what's available
    const heatmapResponse = await api.get(`/api/sessions/${sessionId}/heatmap`);
    inspectStructure(heatmapResponse.data, 'Heatmap Response');
    
    // Check if we have both gaze and cursor data
    const hasGazeData = heatmapResponse.data.image !== undefined;
    const hasCursorData = heatmapResponse.data.cursorHeatmapUrl !== undefined;
    
    console.log(`Session ${sessionId} has: Gaze=${hasGazeData}, Cursor=${hasCursorData}`);
    
    // If we have both types of data, check correlation metrics
    if (hasGazeData && hasCursorData) {
      console.log('Both gaze and cursor data available - checking correlation metrics');
      
      // Check if metrics exist in the response
      if (heatmapResponse.data.correlationMetrics) {
        inspectStructure(heatmapResponse.data.correlationMetrics, 'Correlation Metrics');
        checkForZeroValues(heatmapResponse.data.correlationMetrics, 'Correlation Metrics');
        return heatmapResponse.data.correlationMetrics;
      } else {
        console.warn('No correlation metrics in the heatmap response');
        return null;
      }
    } else {
      console.warn(`Cannot calculate correlation metrics - missing ${!hasGazeData ? 'gaze' : 'cursor'} data`);
      return null;
    }
  } catch (error) {
    console.error('Error testing correlation metrics:', error);
    return null;
  }
}; 