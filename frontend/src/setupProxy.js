const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function(app) {
  // API requests proxy
  app.use(
    '/api',
    createProxyMiddleware({
      target: 'http://localhost:8000',
      changeOrigin: true,
    })
  );

  // Handle WebSocket connections for hot reloading
  // Create React App will keep these local and not proxy them
};