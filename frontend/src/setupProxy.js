const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function(app) {
  // API requests proxy
  app.use(
    '/api',
    createProxyMiddleware({
      target: 'http://localhost:8000',
      changeOrigin: true,
      pathRewrite: { '^/api': '/api' },
      onProxyReq: function(proxyReq, req, res) {
        // Log proxy requests
        console.log(`[Proxy] ${req.method} ${req.url} -> ${proxyReq.path}`);
      },
      onError: function(err, req, res) {
        console.error('[Proxy] Error:', err);
        res.writeHead(500, {
          'Content-Type': 'text/plain',
        });
        res.end('Proxy Error: Unable to connect to the backend server');
      }
    })
  );

  // Handle WebSocket connections for hot reloading
  // Create React App will keep these local and not proxy them
};