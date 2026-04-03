import 'dotenv/config';
import http from 'http';
import cron from 'node-cron';
import { createApp } from './app.js';
import { prisma } from './utils/prisma.js';
import { initWebSocket } from './websocket.js';
import { runDeadlinePushDigest } from './services/deadlinePushDigest.js';

const app = createApp();
const server = http.createServer(app);

initWebSocket(server);

/** Digest push giornaliero (usa TZ del processo, es. Europe/Rome in produzione) */
cron.schedule('0 9 * * *', async () => {
  console.log('🔔 Controllo scadenze (push digest)…');
  try {
    await runDeadlinePushDigest();
  } catch (e) {
    console.error('🔔 Digest push fallito:', e);
  }
});

const PORT = process.env.PORT || 3001;

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server in ascolto su porta ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
});

process.on('beforeExit', async () => {
  await prisma.$disconnect();
});
