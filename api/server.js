const express = require('express');
const DockerManager = require('./dockerManager');

const app = express();
const PORT = 3000;

const dockerManager = new DockerManager();

// Middleware
app.use(express.json());

// Health check endpoint
app.get('/health', async (req, res) => {
  const runnerHealthy = await dockerManager.healthCheck();
  res.json({
    status: 'ok',
    runner: runnerHealthy ? 'healthy' : 'unhealthy',
  });
});

// Execute code endpoint
app.post('/execute', async (req, res) => {
  const { code } = req.body;

  if (!code || typeof code !== 'string') {
    return res.status(400).json({
      error: 'Code is required and must be a string',
    });
  }

  try {
    const result = await dockerManager.executeCode(code);
    res.json(result);
  } catch (err) {
    res.status(500).json({
      error: err.message,
    });
  }
});

// Graceful shutdown
async function shutdown() {
  console.log('\nShutting down...');
  await dockerManager.stopContainer();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// Start server
async function start() {
  try {
    console.log('Initializing code runner...');
    await dockerManager.initialize();

    app.listen(PORT, () => {
      console.log(`API server running on http://localhost:${PORT}`);
      console.log('\nEndpoints:');
      console.log('  POST /execute  - Execute JavaScript code');
      console.log('  GET  /health   - Health check');
      console.log('\nExample:');
      console.log(`  curl -X POST http://localhost:${PORT}/execute -H "Content-Type: application/json" -d '{"code": "console.log(1 + 1)"}'`);
    });
  } catch (err) {
    console.error('Failed to start:', err.message);
    process.exit(1);
  }
}

start();
