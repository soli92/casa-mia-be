import express from 'express';
import { prisma } from '../utils/prisma.js';

const router = express.Router();

// GET /api/deadlines - Tutte le scadenze della famiglia
router.get('/', async (req, res) => {
  try {
    const { familyId } = req.user;

    const deadlines = await prisma.deadline.findMany({
      where: { familyId },
      orderBy: { dueDate: 'asc' },
    });

    res.json(deadlines);
  } catch (error) {
    console.error('Get deadlines error:', error);
    res.status(500).json({ error: 'Errore nel recupero delle scadenze' });
  }
});

// GET /api/deadlines/upcoming - Scadenze prossimi 7 giorni
router.get('/upcoming', async (req, res) => {
  try {
    const { familyId } = req.user;
    const now = new Date();
    const nextWeek = new Date();
    nextWeek.setDate(now.getDate() + 7);

    const deadlines = await prisma.deadline.findMany({
      where: {
        familyId,
        dueDate: {
          gte: now,
          lte: nextWeek,
        },
        isPaid: false,
      },
      orderBy: { dueDate: 'asc' },
    });

    res.json(deadlines);
  } catch (error) {
    console.error('Get upcoming deadlines error:', error);
    res.status(500).json({ error: 'Errore nel recupero delle scadenze imminenti' });
  }
});

// GET /api/deadlines/overdue - Scadenze scadute non pagate
router.get('/overdue', async (req, res) => {
  try {
    const { familyId } = req.user;
    const now = new Date();

    const deadlines = await prisma.deadline.findMany({
      where: {
        familyId,
        dueDate: { lt: now },
        isPaid: false,
      },
      orderBy: { dueDate: 'asc' },
    });

    res.json(deadlines);
  } catch (error) {
    console.error('Get overdue deadlines error:', error);
    res.status(500).json({ error: 'Errore nel recupero delle scadenze scadute' });
  }
});

// GET /api/deadlines/stats/monthly - Statistiche mensili (prima di /:id)
router.get('/stats/monthly', async (req, res) => {
  try {
    const { familyId } = req.user;
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const deadlines = await prisma.deadline.findMany({
      where: {
        familyId,
        dueDate: {
          gte: firstDayOfMonth,
          lte: lastDayOfMonth,
        },
      },
    });

    const stats = {
      total: deadlines.length,
      paid: deadlines.filter(d => d.isPaid).length,
      unpaid: deadlines.filter(d => !d.isPaid).length,
      totalAmount: deadlines.reduce((sum, d) => sum + (d.amount || 0), 0),
      paidAmount: deadlines.filter(d => d.isPaid).reduce((sum, d) => sum + (d.amount || 0), 0),
      byCategory: {},
    };

    deadlines.forEach(d => {
      if (!stats.byCategory[d.category]) {
        stats.byCategory[d.category] = { count: 0, amount: 0 };
      }
      stats.byCategory[d.category].count++;
      stats.byCategory[d.category].amount += d.amount || 0;
    });

    res.json(stats);
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ error: 'Errore nel calcolo delle statistiche' });
  }
});

// GET /api/deadlines/:id - Dettaglio singola scadenza
router.get('/:id', async (req, res) => {
  try {
    const { familyId } = req.user;
    const { id } = req.params;

    const deadline = await prisma.deadline.findFirst({
      where: {
        id,
        familyId,
      },
    });

    if (!deadline) {
      return res.status(404).json({ error: 'Scadenza non trovata' });
    }

    res.json(deadline);
  } catch (error) {
    console.error('Get deadline error:', error);
    res.status(500).json({ error: 'Errore nel recupero della scadenza' });
  }
});

// POST /api/deadlines - Crea nuova scadenza
router.post('/', async (req, res) => {
  try {
    const { familyId, id: userId } = req.user;
    const { title, description, dueDate, amount, category } = req.body;

    if (!title || !dueDate) {
      return res.status(400).json({ error: 'Titolo e data scadenza obbligatori' });
    }

    const deadline = await prisma.deadline.create({
      data: {
        title,
        description,
        dueDate: new Date(dueDate),
        amount: amount ? parseFloat(amount) : null,
        category: category || 'ALTRO',
        isPaid: false,
        familyId,
        createdById: userId,
      },
    });

    res.status(201).json(deadline);
  } catch (error) {
    console.error('Create deadline error:', error);
    res.status(500).json({ error: 'Errore nella creazione della scadenza' });
  }
});

// PATCH /api/deadlines/:id - Aggiorna scadenza
router.patch('/:id', async (req, res) => {
  try {
    const { familyId } = req.user;
    const { id } = req.params;
    const { title, description, dueDate, amount, category, isPaid } = req.body;

    const existing = await prisma.deadline.findFirst({
      where: {
        id,
        familyId,
      },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Scadenza non trovata' });
    }

    const updateData = {};
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (dueDate !== undefined) updateData.dueDate = new Date(dueDate);
    if (amount !== undefined) updateData.amount = amount ? parseFloat(amount) : null;
    if (category !== undefined) updateData.category = category;
    if (isPaid !== undefined) updateData.isPaid = isPaid;

    const updated = await prisma.deadline.update({
      where: { id },
      data: updateData,
    });

    res.json(updated);
  } catch (error) {
    console.error('Update deadline error:', error);
    res.status(500).json({ error: 'Errore nell\'aggiornamento della scadenza' });
  }
});

// DELETE /api/deadlines/:id - Elimina scadenza
router.delete('/:id', async (req, res) => {
  try {
    const { familyId } = req.user;
    const { id } = req.params;

    const existing = await prisma.deadline.findFirst({
      where: {
        id,
        familyId,
      },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Scadenza non trovata' });
    }

    await prisma.deadline.delete({
      where: { id },
    });

    res.json({ message: 'Scadenza eliminata' });
  } catch (error) {
    console.error('Delete deadline error:', error);
    res.status(500).json({ error: 'Errore nell\'eliminazione della scadenza' });
  }
});

export default router;
