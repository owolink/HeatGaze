import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Box, Typography, Tabs, Tab, Button, Paper, CircularProgress } from '@mui/material';
import api from '../services/api';
import MouseHeatmapViewer from './MouseHeatmapViewer';
import SessionPlayer from './SessionPlayer';

const SessionView = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState(0);
  const [hasCursorData, setHasCursorData] = useState(false);

  useEffect(() => {
    const fetchSessionData = async () => {
      try {
        setLoading(true);
        // Get session details
        const sessionResponse = await api.get(`/api/sessions/${id}`);
        setSession(sessionResponse.data);
        
        // Check if session has cursor data
        const cursorResponse = await api.get(`/api/sessions/${id}/cursor`);
        console.log('Checking for cursor data:', cursorResponse.data);
        setHasCursorData(cursorResponse.data.points && cursorResponse.data.points.length > 0);
        
        setError(null);
      } catch (err) {
        console.error('Error fetching session:', err);
        setError('Failed to load session data. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchSessionData();
  }, [id]);

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3, mt: 4 }}>
        <Paper sx={{ p: 4, bgcolor: 'error.light', color: 'error.contrastText' }}>
          <Typography variant="h5" gutterBottom>Error</Typography>
          <Typography>{error}</Typography>
          <Button 
            variant="contained" 
            sx={{ mt: 2 }} 
            onClick={() => navigate('/dashboard')}
          >
            Back to Dashboard
          </Button>
        </Paper>
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto', p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          Session #{id}: {session?.name || 'Untitled'}
        </Typography>
        <Button variant="outlined" onClick={() => navigate('/dashboard')}>
          Back to Dashboard
        </Button>
      </Box>
      
      <Paper sx={{ mb: 3 }}>
        <Tabs value={activeTab} onChange={handleTabChange} variant="fullWidth">
          <Tab label="Session Playback" />
          <Tab label="Mouse Movement Analysis" disabled={!hasCursorData} />
        </Tabs>
      </Paper>
      
      {activeTab === 0 ? (
        <SessionPlayer sessionId={id} />
      ) : (
        <MouseHeatmapViewer sessionId={id} />
      )}

      {activeTab === 1 && !hasCursorData && (
        <Paper sx={{ p: 3, mt: 3, textAlign: 'center' }}>
          <Typography variant="h6" color="error" gutterBottom>
            No cursor data available
          </Typography>
          <Typography>
            This session doesn't contain any cursor movement data. 
            Try selecting a different session or recording a new session with cursor tracking enabled.
          </Typography>
        </Paper>
      )}
    </Box>
  );
};

export default SessionView; 