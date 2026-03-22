import { verifyAccessToken } from '../utils/jwt.js';

export const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: 'Token mancante' });
  }

  const user = verifyAccessToken(token);
  
  if (!user) {
    return res.status(403).json({ error: 'Token non valido o scaduto' });
  }

  req.user = user;
  next();
};

export const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Accesso negato: solo admin' });
  }
  next();
};
