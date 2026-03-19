const axios = require('axios');
const http = require('http');

let server;
let base = process.env.BASE_URL;

async function startLocalServer() {
  const app = require('../src/app');

  server = http.createServer(app);
  await new Promise((resolve) => {
    server.listen(0, '127.0.0.1', resolve);
  });

  const { port } = server.address();
  base = `http://127.0.0.1:${port}/api`;
}

async function stopLocalServer() {
  if (!server) return;

  await new Promise((resolve, reject) => {
    server.close((err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

async function check(path) {
  try {
    const res = await axios.get(`${base}${path}`, { timeout: 3000 });
    console.log(`${path} -> ${res.status}`);
    return true;
  } catch (err) {
    console.error(`${path} failed:`, err.message);
    return false;
  }
}

(async () => {
  try {
    if (!base) {
      await startLocalServer();
    }

    console.log('Running smoke checks against', base);
    const ok1 = await check('/health');
    const ok2 = await check('/metrics');

    if (ok1) console.log('Health OK');
    else console.error('Health check failed');

    if (ok2) console.log('Metrics OK or available');
    else console.log('Metrics not available (optional)');

    process.exit(ok1 ? 0 : 2);
  } finally {
    await stopLocalServer();
  }
})();
