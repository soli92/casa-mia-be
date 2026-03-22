const express = require('express');
const cors = require('cors');
const http = require('http');
const { setupWebSocket } = require('./websocket');

// Routes
const authRoutes = require('./routes/auth');
const shoppingRoutes = require('./routes/shopping');
const pantryRoutes = require('./routes/pantry');
const recipesRoutes = require('./routes/recipes');
const deadlinesRoutes = require('./routes/deadlines');
const iotRoutes = require('./routes/iot');

const app = express();
const server = http.createServer(app);

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true
}));
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/shopping', shoppingRoutes);
app.use('/api/pantry', pantryRoutes);
app.use('/api/recipes', recipesRoutes);
app.use('/api/deadlines', deadlinesRoutes);
app.use('/api/iot', iotRoutes);

// Setup WebSocket
setupWebSocket(server);

// Error handling
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error'
  });
});

const PORT = process.env.PORT || 3001;

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📡 WebSocket ready for IoT connections`);
});
