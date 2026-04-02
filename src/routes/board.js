import express from 'express';
import { prisma } from '../utils/prisma.js';

const router = express.Router();

const MAX_CONTENT = 2000;
const COLORS = new Set(['amber', 'rose', 'sky', 'lime', 'violet']);

function clampPercent(n, fallback) {
  const x = Number(n);
  if (!Number.isFinite(x)) return fallback;
  return Math.min(100, Math.max(0, x));
}

function clampRotation(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return 0;
  return Math.min(12, Math.max(-12, x));
}

function clampZ(n) {
  const x = parseInt(n, 10);
  if (!Number.isFinite(x)) return 1;
  return Math.min(9999, Math.max(0, x));
}

// Lista post-it della famiglia
router.get('/post-its', async (req, res) => {
  try {
    const items = await prisma.postIt.findMany({
      where: { familyId: req.user.familyId },
      include: { createdBy: { select: { id: true, name: true } } },
      orderBy: [{ zIndex: 'asc' }, { createdAt: 'asc' }],
    });
    res.json(items);
  } catch (error) {
    console.error('Board list error:', error);
    res.status(500).json({ error: 'Errore nel caricamento della lavagna' });
  }
});

router.post('/post-its', async (req, res) => {
  try {
    const raw = String(req.body.content ?? '').trim();
    const content = raw || 'Nuovo promemoria';
    if (content.length > MAX_CONTENT) {
      return res.status(400).json({ error: `Testo troppo lungo (max ${MAX_CONTENT} caratteri)` });
    }

    const color = COLORS.has(req.body.color) ? req.body.color : 'amber';
    const xPercent = clampPercent(req.body.xPercent, 15 + Math.random() * 25);
    const yPercent = clampPercent(req.body.yPercent, 15 + Math.random() * 25);
    const rotation = clampRotation(req.body.rotation);
    const zIndex = clampZ(req.body.zIndex) || 1;

    const item = await prisma.postIt.create({
      data: {
        content,
        color,
        xPercent,
        yPercent,
        zIndex,
        rotation,
        familyId: req.user.familyId,
        createdById: req.user.id,
      },
      include: { createdBy: { select: { id: true, name: true } } },
    });

    res.status(201).json(item);
  } catch (error) {
    console.error('Board create error:', error);
    res.status(500).json({ error: 'Errore durante la creazione del post-it' });
  }
});

router.patch('/post-its/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await prisma.postIt.findUnique({ where: { id } });
    if (!existing || existing.familyId !== req.user.familyId) {
      return res.status(404).json({ error: 'Post-it non trovato' });
    }

    const data = {};
    if (req.body.content !== undefined) {
      const t = String(req.body.content).trim();
      if (!t) {
        return res.status(400).json({ error: 'Il testo non può essere vuoto' });
      }
      if (t.length > MAX_CONTENT) {
        return res.status(400).json({ error: `Testo troppo lungo (max ${MAX_CONTENT} caratteri)` });
      }
      data.content = t;
    }
    if (req.body.color !== undefined) {
      data.color = COLORS.has(req.body.color) ? req.body.color : existing.color;
    }
    if (req.body.xPercent !== undefined) {
      data.xPercent = clampPercent(req.body.xPercent, existing.xPercent);
    }
    if (req.body.yPercent !== undefined) {
      data.yPercent = clampPercent(req.body.yPercent, existing.yPercent);
    }
    if (req.body.zIndex !== undefined) {
      data.zIndex = clampZ(req.body.zIndex);
    }
    if (req.body.rotation !== undefined) {
      data.rotation = clampRotation(req.body.rotation);
    }

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ error: 'Nessun campo da aggiornare' });
    }

    const item = await prisma.postIt.update({
      where: { id },
      data,
      include: { createdBy: { select: { id: true, name: true } } },
    });

    res.json(item);
  } catch (error) {
    console.error('Board update error:', error);
    res.status(500).json({ error: 'Errore durante l\'aggiornamento' });
  }
});

router.delete('/post-its/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await prisma.postIt.findUnique({ where: { id } });
    if (!existing || existing.familyId !== req.user.familyId) {
      return res.status(404).json({ error: 'Post-it non trovato' });
    }

    await prisma.postIt.delete({ where: { id } });
    res.json({ message: 'Post-it eliminato' });
  } catch (error) {
    console.error('Board delete error:', error);
    res.status(500).json({ error: 'Errore durante l\'eliminazione' });
  }
});

export default router;
