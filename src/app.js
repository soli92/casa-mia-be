import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.js';
import pantryRoutes from './routes/pantry.js';
import shoppingRoutes from './routes/shopping.js';
import recipeRoutes from './routes/recipes.js';
import deadlineRoutes from './routes/deadlines.js';
import iotRoutes, { iotWebhookRouter } from './routes/iot.js';
import { authenticateToken } from './middleware/auth.js';

/**
 * Express app (senza listen). Usato da index.js e dai test.
 */
export function createApp() {
  const app = express();

  app.use(
    cors({
      origin: process.env.FRONTEND_URL || 'http://localhost:3000',
      credentials: true,
    })
  );
  app.use(express.json());

  app.use('/api/auth', authRoutes);
  app.use('/api/pantry', authenticateToken, pantryRoutes);
  app.use('/api/shopping', authenticateToken, shoppingRoutes);
  app.use('/api/recipes', authenticateToken, recipeRoutes);
  app.use('/api/deadlines', authenticateToken, deadlineRoutes);
  app.use('/api/iot', iotWebhookRouter);
  app.use('/api/iot', authenticateToken, iotRoutes);

  app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  return app;
}
