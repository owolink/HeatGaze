const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Simple logger middleware
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

// API requests proxy
app.use('/api', 
  createProxyMiddleware({
    target: 'http://localhost:8000',
    changeOrigin: true
  })
);

// Serve static files from the React build
app.use(express.static(path.join(__dirname, 'build')));

// For any request that doesn't match an API route or static file, send the React app
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
}); 