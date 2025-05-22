import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { testCorrelationMetrics } from '../utils/debug';

/**
 * A debug component for testing heatmap metrics
 */
const DebugHeatmap = () => {
  const [sessionId, setSessionId] = useState('');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!sessionId.trim()) {
      setError('Please enter a valid session ID');
      return;
    }
    
    setLoading(true);
    setError(null);
    setResults(null);
    
    try {
      const metrics = await testCorrelationMetrics(sessionId);
      setResults(metrics);
      
      if (!metrics) {
        setError('No metrics data returned. Check console for details.');
      }
    } catch (err) {
      console.error('Error testing metrics:', err);
      setError(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="debug-container" style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <h1>Heatmap Metrics Debug Tool</h1>
      
      <p>
        This tool helps diagnose issues with correlation metrics between gaze and cursor heatmaps.
        Enter a session ID to test the metrics calculation.
      </p>
      
      <form onSubmit={handleSubmit} style={{ marginBottom: '20px' }}>
        <div style={{ marginBottom: '10px' }}>
          <label htmlFor="sessionId" style={{ display: 'block', marginBottom: '5px' }}>Session ID:</label>
          <input 
            type="text" 
            id="sessionId"
            value={sessionId}
            onChange={(e) => setSessionId(e.target.value)}
            style={{ padding: '8px', width: '100%' }}
            placeholder="Enter session ID"
          />
        </div>
        
        <button 
          type="submit" 
          disabled={loading}
          style={{
            padding: '8px 16px',
            backgroundColor: '#4a90e2',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: loading ? 'not-allowed' : 'pointer'
          }}
        >
          {loading ? 'Testing...' : 'Test Metrics'}
        </button>
        
        <button 
          type="button"
          onClick={() => navigate('/dashboard')}
          style={{
            padding: '8px 16px',
            backgroundColor: '#f0f0f0',
            border: 'none',
            borderRadius: '4px',
            marginLeft: '10px',
            cursor: 'pointer'
          }}
        >
          Back to Dashboard
        </button>
      </form>
      
      {error && (
        <div style={{ 
          padding: '10px', 
          backgroundColor: '#ffebee', 
          color: '#c62828',
          borderRadius: '4px',
          marginBottom: '20px'
        }}>
          {error}
        </div>
      )}
      
      {results && (
        <div>
          <h2>Correlation Metrics Results</h2>
          
          <div style={{ border: '1px solid #e0e0e0', borderRadius: '4px', padding: '15px', backgroundColor: '#f9f9f9' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #e0e0e0' }}>
                  <th style={{ textAlign: 'left', padding: '8px', width: '40%' }}>Metric</th>
                  <th style={{ textAlign: 'right', padding: '8px', width: '30%' }}>Value</th>
                  <th style={{ textAlign: 'left', padding: '8px', width: '30%' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(results).map(([key, value]) => {
                  // Skip the hotspot_locations array
                  if (key === 'hotspot_locations') return null;
                  
                  // Determine status
                  let status = 'normal';
                  let statusColor = '#333';
                  
                  if (typeof value === 'number' && value === 0) {
                    status = 'zero';
                    statusColor = '#e53935';
                  } else if (typeof value === 'number' && value > 0) {
                    status = 'ok';
                    statusColor = '#43a047';
                  }
                  
                  return (
                    <tr key={key} style={{ borderBottom: '1px solid #f0f0f0' }}>
                      <td style={{ padding: '8px' }}>{key}</td>
                      <td style={{ padding: '8px', textAlign: 'right', fontFamily: 'monospace' }}>
                        {typeof value === 'number' ? value.toFixed(4) : String(value)}
                      </td>
                      <td style={{ padding: '8px', color: statusColor, fontWeight: 'bold' }}>
                        {status === 'zero' ? 'All Zeros!' : status === 'ok' ? 'OK' : ''}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          
          <p style={{ marginTop: '15px', color: '#666', fontSize: '0.9rem' }}>
            Note: Zero values might indicate issues with the heatmap generation or empty data. Check the console for more details.
          </p>
        </div>
      )}
      
      <div style={{ marginTop: '30px', fontSize: '0.9rem', color: '#666' }}>
        <p>Debugging Tips:</p>
        <ul style={{ paddingLeft: '20px' }}>
          <li>Make sure the session has both gaze and cursor data</li>
          <li>Check the browser console for detailed error messages</li>
          <li>If all metrics are 0, check if the heatmaps are being generated properly</li>
          <li>Metrics calculation happens on the backend - check server logs for errors</li>
        </ul>
      </div>
    </div>
  );
};

export default DebugHeatmap; 