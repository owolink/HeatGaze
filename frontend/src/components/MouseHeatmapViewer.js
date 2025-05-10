import React, { useEffect, useState } from 'react';
import { 
  Box, 
  Container, 
  Typography, 
  Button, 
  CircularProgress, 
  Tabs, 
  Tab, 
  Card, 
  CardContent, 
  Grid,
  Paper,
  Divider,
  Alert
} from '@mui/material';
import api from '../services/api';

const MouseHeatmapViewer = ({ sessionId }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState(0);
  const [heatmapData, setHeatmapData] = useState(null);
  const [timeBasedData, setTimeBasedData] = useState(null);
  const [trajectoryData, setTrajectoryData] = useState(null);

  const fetchHeatmapData = async () => {
    setLoading(true);
    setError(null);
    console.log(`Fetching cursor density heatmap for session: ${sessionId}`);
    
    try {
      const response = await api.get(`/api/sessions/${sessionId}/cursor/heatmap/plotly`);
      console.log('Cursor heatmap response:', response.data);
      setHeatmapData(response.data);
    } catch (err) {
      console.error('Error fetching cursor heatmap data:', err);
      console.error('Error details:', err.response?.data || err.message);
      setError('Failed to load cursor heatmap. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const fetchTimeBasedHeatmap = async () => {
    setLoading(true);
    setError(null);
    console.log(`Fetching cursor time-based heatmap for session: ${sessionId}`);
    
    try {
      const response = await api.get(`/api/sessions/${sessionId}/cursor/heatmap/time-based`);
      console.log('Time-based cursor heatmap response:', response.data);
      setTimeBasedData(response.data);
    } catch (err) {
      console.error('Error fetching time-based cursor heatmap:', err);
      console.error('Error details:', err.response?.data || err.message);
      setError('Failed to load time-based cursor heatmap. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const fetchTrajectoryPlot = async () => {
    setLoading(true);
    setError(null);
    console.log(`Fetching cursor trajectory for session: ${sessionId}`);
    
    try {
      const response = await api.get(`/api/sessions/${sessionId}/cursor/trajectory`);
      console.log('Cursor trajectory response:', response.data);
      setTrajectoryData(response.data);
    } catch (err) {
      console.error('Error fetching cursor trajectory plot:', err);
      console.error('Error details:', err.response?.data || err.message);
      setError('Failed to load cursor trajectory plot. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (sessionId) {
      console.log(`MouseHeatmapViewer initialized for session: ${sessionId}`);
      
      // First check the debug endpoint to make sure the backend module is working
      api.get('/api/cursor/debug')
        .then(response => {
          console.log('Debug endpoint response:', response.data);
          if (response.data.status === 'success') {
            console.log('Mouse heatmap module loaded successfully');
          } else {
            console.error('Mouse heatmap module failed to load:', response.data.error);
            setError(`Backend error: ${response.data.error}`);
          }
        })
        .catch(err => {
          console.error('Failed to reach debug endpoint:', err);
        });
      
      // Verify that the session has cursor data
      api.get(`/api/sessions/${sessionId}/cursor`)
        .then(response => {
          const hasData = response.data.points && response.data.points.length > 0;
          console.log(`Session has cursor data: ${hasData} (${response.data.points?.length || 0} points)`);
          if (hasData) {
            fetchHeatmapData();
          } else {
            setError('No cursor data available for this session');
          }
        })
        .catch(err => {
          console.error('Error checking cursor data:', err);
          setError('Failed to check cursor data availability');
        });
    }
  }, [sessionId]);

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
    if (newValue === 0 && !heatmapData) {
      fetchHeatmapData();
    } else if (newValue === 1 && !timeBasedData) {
      fetchTimeBasedHeatmap();
    } else if (newValue === 2 && !trajectoryData) {
      fetchTrajectoryPlot();
    }
  };

  const renderStats = (data) => {
    if (!data || !data.stats) return null;
    
    const { stats } = data;
    
    // Different stats based on the visualization type
    if (stats.hotspots) {
      // Density heatmap stats
      return (
        <Card variant="outlined" sx={{ mt: 2 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Heatmap Statistics
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <Typography variant="body2">
                  <strong>Points tracked:</strong> {data.count}
                </Typography>
                <Typography variant="body2">
                  <strong>Max density:</strong> {stats.hotspots.max_value.toFixed(2)}
                </Typography>
                <Typography variant="body2">
                  <strong>Max density location:</strong> x: {stats.hotspots.max_location.x.toFixed(0)}, y: {stats.hotspots.max_location.y.toFixed(0)}
                </Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="body2">
                  <strong>Active coverage:</strong> {stats.coverage.percentage.toFixed(2)}%
                </Typography>
                <Typography variant="body2">
                  <strong>Active areas:</strong> {stats.coverage.active_bins} / {stats.coverage.total_bins}
                </Typography>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      );
    } else if (stats.timing) {
      // Time-based heatmap stats
      return (
        <Card variant="outlined" sx={{ mt: 2 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Dwell Time Statistics
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <Typography variant="body2">
                  <strong>Points tracked:</strong> {data.count}
                </Typography>
                <Typography variant="body2">
                  <strong>Total tracking time:</strong> {stats.timing.total_tracking_time.toFixed(2)}s
                </Typography>
                <Typography variant="body2">
                  <strong>Average dwell time:</strong> {stats.timing.average_dwell_time.toFixed(4)}s
                </Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="body2">
                  <strong>Max dwell time:</strong> {stats.timing.max_dwell_time.toFixed(4)}s
                </Typography>
                <Typography variant="body2">
                  <strong>Max dwell location:</strong> x: {stats.timing.max_dwell_location.x.toFixed(0)}, y: {stats.timing.max_dwell_location.y.toFixed(0)}
                </Typography>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      );
    } else if (stats.trajectory) {
      // Trajectory stats
      return (
        <Card variant="outlined" sx={{ mt: 2 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Trajectory Statistics
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <Typography variant="body2">
                  <strong>Points tracked:</strong> {data.count}
                </Typography>
                <Typography variant="body2">
                  <strong>Total distance:</strong> {stats.trajectory.total_distance.toFixed(2)} pixels
                </Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="body2">
                  <strong>Average speed:</strong> {stats.trajectory.avg_speed.toFixed(2)} pixels/sec
                </Typography>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      );
    }
    
    return null;
  };

  if (!sessionId) {
    return (
      <Alert severity="error">No session specified</Alert>
    );
  }

  return (
    <Container maxWidth="lg">
      <Typography variant="h4" component="h1" gutterBottom>
        Mouse Movement Analysis
      </Typography>
      
      <Tabs value={activeTab} onChange={handleTabChange} variant="fullWidth" sx={{ mb: 2 }}>
        <Tab label="Density Heatmap" />
        <Tab label="Dwell Time Heatmap" />
        <Tab label="Movement Trajectory" />
      </Tabs>
      
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
          <CircularProgress />
        </Box>
      ) : error ? (
        <Paper sx={{ p: 3, bgcolor: 'error.light', color: 'error.contrastText' }}>
          <Typography>{error}</Typography>
          <Button 
            variant="contained" 
            sx={{ mt: 2 }} 
            onClick={() => {
              if (activeTab === 0) fetchHeatmapData();
              else if (activeTab === 1) fetchTimeBasedHeatmap();
              else fetchTrajectoryPlot();
            }}
          >
            Retry
          </Button>
        </Paper>
      ) : (
        <Box>
          {activeTab === 0 && heatmapData && (
            <>
              <Paper sx={{ p: 2, mb: 2 }}>
                <Typography variant="h6" gutterBottom>
                  Mouse Movement Density Heatmap
                </Typography>
                <Typography variant="body2" sx={{ mb: 2 }}>
                  This heatmap shows areas where the cursor appeared most frequently. Brighter areas indicate higher cursor density.
                </Typography>
                <Divider sx={{ mb: 2 }} />
                <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
                  <img 
                    src={`data:image/png;base64,${heatmapData.image}`} 
                    alt="Mouse Movement Heatmap"
                    style={{ maxWidth: '100%', height: 'auto' }}
                  />
                </Box>
              </Paper>
              {renderStats(heatmapData)}
            </>
          )}
          
          {activeTab === 1 && (
            timeBasedData ? (
              <>
                <Paper sx={{ p: 2, mb: 2 }}>
                  <Typography variant="h6" gutterBottom>
                    Dwell Time Heatmap
                  </Typography>
                  <Typography variant="body2" sx={{ mb: 2 }}>
                    This heatmap shows areas where the cursor spent the most time. Brighter areas indicate longer dwell times.
                  </Typography>
                  <Divider sx={{ mb: 2 }} />
                  <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
                    <img 
                      src={`data:image/png;base64,${timeBasedData.image}`} 
                      alt="Dwell Time Heatmap"
                      style={{ maxWidth: '100%', height: 'auto' }}
                    />
                  </Box>
                </Paper>
                {renderStats(timeBasedData)}
              </>
            ) : (
              <Button 
                variant="contained" 
                color="primary" 
                onClick={fetchTimeBasedHeatmap}
                sx={{ my: 4, display: 'block', mx: 'auto' }}
              >
                Load Dwell Time Heatmap
              </Button>
            )
          )}
          
          {activeTab === 2 && (
            trajectoryData ? (
              <>
                <Paper sx={{ p: 2, mb: 2 }}>
                  <Typography variant="h6" gutterBottom>
                    Mouse Movement Trajectory
                  </Typography>
                  <Typography variant="body2" sx={{ mb: 2 }}>
                    This visualization shows the path of cursor movement over time. Colors indicate the time sequence from start (blue) to end (red).
                  </Typography>
                  <Divider sx={{ mb: 2 }} />
                  <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
                    <img 
                      src={`data:image/png;base64,${trajectoryData.image}`} 
                      alt="Mouse Movement Trajectory"
                      style={{ maxWidth: '100%', height: 'auto' }}
                    />
                  </Box>
                </Paper>
                {renderStats(trajectoryData)}
              </>
            ) : (
              <Button 
                variant="contained" 
                color="primary" 
                onClick={fetchTrajectoryPlot}
                sx={{ my: 4, display: 'block', mx: 'auto' }}
              >
                Load Trajectory Plot
              </Button>
            )
          )}
        </Box>
      )}
    </Container>
  );
};

export default MouseHeatmapViewer; 