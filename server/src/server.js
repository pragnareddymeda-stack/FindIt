import http from 'node:http';
import { validateEnv, config } from './config/env.js';
import { connectDB } from './config/db.js';
import { createApp } from './app.js';
import { initSocket } from './socket.js';

async function main() {
  try {
    validateEnv();
  } catch (err) {
    console.error(`Configuration error: ${err.message}`);
    console.error('Copy server/.env.example to server/.env and fill in the values.');
    process.exit(1);
  }

  try {
    await connectDB();
    console.log('MongoDB connected');
  } catch (err) {
    console.error(`MongoDB connection failed: ${err.message}`);
    process.exit(1);
  }

  const app = createApp();
  const server = http.createServer(app);
  initSocket(server);
  server.listen(config.port, () => {
    console.log(`FindIt API listening on http://localhost:${config.port}/api/v1 (Socket.IO enabled)`);
  });
}

main();
