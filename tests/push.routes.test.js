import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { createApp } from '../src/app.js';

const prismaMock = vi.hoisted(() => ({
  pushSubscription: {
    upsert: vi.fn(),
    findUnique: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('../src/utils/prisma.js', () => ({
  prisma: prismaMock,
}));

const pushRouter = (await import('../src/routes/push.js')).default;
const { pushVapidPublicKeyHandler } = await import('../src/routes/push.js');

function makePushApp() {
  const app = express();
  app.use(express.json());
  app.get('/api/push/vapid-public-key', pushVapidPublicKeyHandler);
  app.use((req, res, next) => {
    req.user = { id: 'user-1', familyId: 'fam-1' };
    next();
  });
  app.use('/api/push', pushRouter);
  return app;
}

describe('push routes (mock Prisma)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.pushSubscription.upsert.mockResolvedValue({});
    prismaMock.pushSubscription.findUnique.mockResolvedValue({
      id: 'sub-1',
      userId: 'user-1',
      endpoint: 'https://push.example/ep',
    });
    prismaMock.pushSubscription.delete.mockResolvedValue({});
  });

  it('POST /api/push/subscribe 400 senza endpoint', async () => {
    const app = makePushApp();
    const res = await request(app)
      .post('/api/push/subscribe')
      .send({ keys: { p256dh: 'x', auth: 'y' } })
      .expect(400);
    expect(res.body.error).toBeDefined();
    expect(prismaMock.pushSubscription.upsert).not.toHaveBeenCalled();
  });

  it('POST /api/push/subscribe 201 con subscription valida', async () => {
    const app = makePushApp();
    const body = {
      endpoint: 'https://fcm.googleapis.com/fcm/send/abc',
      keys: { p256dh: 'dGhpcyBpcyBhIHRlc3Q', auth: 'dGVzdGF1dGg' },
    };
    const res = await request(app).post('/api/push/subscribe').send(body).expect(201);
    expect(res.body).toMatchObject({ ok: true });
    expect(prismaMock.pushSubscription.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { endpoint: body.endpoint },
        create: expect.objectContaining({
          userId: 'user-1',
          endpoint: body.endpoint,
          p256dh: body.keys.p256dh,
          auth: body.keys.auth,
        }),
      })
    );
  });

  it('DELETE /api/push/subscribe 400 senza endpoint', async () => {
    const app = makePushApp();
    await request(app).delete('/api/push/subscribe').send({}).expect(400);
    expect(prismaMock.pushSubscription.delete).not.toHaveBeenCalled();
  });

  it('DELETE /api/push/subscribe 404 se subscription di altro utente', async () => {
    prismaMock.pushSubscription.findUnique.mockResolvedValue({
      id: 'sub-1',
      userId: 'altro',
      endpoint: 'https://x',
    });
    const app = makePushApp();
    await request(app)
      .delete('/api/push/subscribe')
      .send({ endpoint: 'https://x' })
      .expect(404);
    expect(prismaMock.pushSubscription.delete).not.toHaveBeenCalled();
  });

  it('DELETE /api/push/subscribe 200', async () => {
    const app = makePushApp();
    await request(app)
      .delete('/api/push/subscribe')
      .send({ endpoint: 'https://push.example/ep' })
      .expect(200);
    expect(prismaMock.pushSubscription.delete).toHaveBeenCalledWith({
      where: { endpoint: 'https://push.example/ep' },
    });
  });
});

describe('push VAPID su createApp (env)', () => {
  let savedPublic;

  beforeEach(() => {
    savedPublic = process.env.VAPID_PUBLIC_KEY;
  });

  afterEach(() => {
    if (savedPublic === undefined) {
      delete process.env.VAPID_PUBLIC_KEY;
    } else {
      process.env.VAPID_PUBLIC_KEY = savedPublic;
    }
  });

  it('GET /api/push/vapid-public-key 503 se chiave assente', async () => {
    delete process.env.VAPID_PUBLIC_KEY;
    const app = createApp();
    const res = await request(app).get('/api/push/vapid-public-key').expect(503);
    expect(res.body.error).toBe('Notifiche push non configurate sul server');
  });

  it('GET /api/push/vapid-public-key 200 con chiave', async () => {
    process.env.VAPID_PUBLIC_KEY = 'BTestVapidPublicKeyBase64Url';
    const app = createApp();
    const res = await request(app).get('/api/push/vapid-public-key').expect(200);
    expect(res.body).toEqual({ publicKey: 'BTestVapidPublicKeyBase64Url' });
  });
});
