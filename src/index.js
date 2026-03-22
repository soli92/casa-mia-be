import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import http from 'http';
import cron from 'node-cron';
import { prisma } from './utils/prisma.js';
import { initWebSocket } from './websocket.js';
import { authenticateToken } from './middleware/auth.js';

// Routes
import authRoutes from './routes/auth.js';
import pantryRoutes from './routes/pantry.js';
import shoppingRoutes from './routes/shopping.js';
import recipeRoutes from './routes/recipes.js';
import iotRoutes from './routes/iot.js';

// Carica variabili d'ambiente
dotenv.config();

const app = express();
const server = http.createServer(app);

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());

// Routes pubbliche
app.use('/api/auth', authRoutes);

// Routes protette
app.use('/api/pantry', authenticateToken, pantryRoutes);
app.use('/api/shopping', authenticateToken, shoppingRoutes);
app.use('/api/recipes', authenticateToken, recipeRoutes);
app.use('/api/iot', authenticateToken, iotRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Setup WebSocket
const wss = initWebSocket(server);

// Cron job per notifiche scadenze (ogni giorno alle 9:00)
cron.schedule('0 9 * * *', async () => {
  console.log('🔔 Controllo scadenze...');
  // TODO: Implementare invio notifiche per scadenze imminenti
});

const PORT = process.env.PORT || 3001;

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server in ascolto su porta ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🌐 Frontend URL: ${process.env.FRONTEND_URL}`);
});

// Gestione errori Prisma
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});

// Gestione errori non gestiti
process.on('unhandledRejection', (err) => {
  console.error('❌ Unhandled rejection:', err);
});
