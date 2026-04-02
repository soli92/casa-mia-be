import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { authenticateToken } from '../src/middleware/auth.js';

describe('authenticateToken', () => {
  const prevAccess = process.env.JWT_SECRET;

  beforeEach(() => {
    process.env.JWT_SECRET = 'vitest-access-secret-min-32-chars!!';
  });

  afterEach(() => {
    process.env.JWT_SECRET = prevAccess;
    vi.restoreAllMocks();
  });

  it('401 senza Authorization', async () => {
    const app = express();
    app.use(express.json());
    app.get('/x', authenticateToken, (req, res) => res.json({ ok: true }));
    const res = await request(app).get('/x').expect(401);
    expect(res.body.error).toBeDefined();
  });

  it('403 con token non valido', async () => {
    const app = express();
    app.get('/x', authenticateToken, (req, res) => res.json({ ok: true }));
    const res = await request(app)
      .get('/x')
      .set('Authorization', 'Bearer invalid')
      .expect(403);
    expect(res.body.error).toBeDefined();
  });
});
