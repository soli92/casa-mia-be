import express from 'express';
import { prisma } from '../utils/prisma.js';

const router = express.Router();

/** Chiave pubblica VAPID (sicura da esporre) per iscrizione lato client */
export function pushVapidPublicKeyHandler(req, res) {
  const key = process.env.VAPID_PUBLIC_KEY;
  if (!key) {
    return res.status(503).json({ error: 'Notifiche push non configurate sul server' });
  }
  res.json({ publicKey: key });
}

// POST /api/push/subscribe
router.post('/subscribe', async (req, res) => {
  try {
    const { endpoint, keys } = req.body ?? {};
    const p256dh = keys?.p256dh;
    const auth = keys?.auth;
    if (!endpoint || !p256dh || !auth) {
      return res.status(400).json({ error: 'Subscription non valida' });
    }

    const userId = req.user.id;

    await prisma.pushSubscription.upsert({
      where: { endpoint },
      create: {
        userId,
        endpoint,
        p256dh,
        auth,
      },
      update: {
        userId,
        p256dh,
        auth,
      },
    });

    res.status(201).json({ ok: true });
  } catch (error) {
    console.error('Push subscribe error:', error);
    res.status(500).json({ error: 'Errore durante la registrazione push' });
  }
});

// DELETE /api/push/subscribe  body: { endpoint }
router.delete('/subscribe', async (req, res) => {
  try {
    const { endpoint } = req.body ?? {};
    if (!endpoint) {
      return res.status(400).json({ error: 'Endpoint obbligatorio' });
    }

    const existing = await prisma.pushSubscription.findUnique({
      where: { endpoint },
    });
    if (!existing || existing.userId !== req.user.id) {
      return res.status(404).json({ error: 'Sottoscrizione non trovata' });
    }

    await prisma.pushSubscription.delete({ where: { endpoint } });
    res.json({ ok: true });
  } catch (error) {
    console.error('Push unsubscribe error:', error);
    res.status(500).json({ error: 'Errore durante la disiscrizione' });
  }
});

export default router;
