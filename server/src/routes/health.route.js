const express = require('express');
const router = express.Router();
let client;
try {
  // prom-client is optional; metrics endpoint will be available if installed
  const promClient = require('prom-client');
  promClient.collectDefaultMetrics();
  client = promClient;
} catch (e) {
  client = null;
}

router.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: Date.now(),
    message: 'API is healthy'
  });
});

if (client) {
  router.get('/metrics', async (req, res) => {
    try {
      res.set('Content-Type', client.register.contentType);
      const metrics = await client.register.metrics();
      res.send(metrics);
    } catch (err) {
      res.status(500).send(err.message);
    }
  });
}

module.exports = router;
