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

// GET /api/deadlines/:id - Dettaglio singola scadenza
router.get('/:id', async (req, res) => {
  try {
    const { familyId } = req.user;
    const { id } = req.params;

    const deadline = await prisma.deadline.findFirst({
      where: {
        id: parseInt(id),
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
    const { familyId } = req.user;
    const { title, description, dueDate, amount, category, isRecurring, recurringType } = req.body;

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
        isRecurring: isRecurring || false,
        recurringType: recurringType || null,
        isPaid: false,
        familyId,
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
    const { title, description, dueDate, amount, category, isPaid, isRecurring, recurringType } = req.body;

    const existing = await prisma.deadline.findFirst({
      where: {
        id: parseInt(id),
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
    if (isRecurring !== undefined) updateData.isRecurring = isRecurring;
    if (recurringType !== undefined) updateData.recurringType = recurringType;

    const updated = await prisma.deadline.update({
      where: { id: parseInt(id) },
      data: updateData,
    });

    // Se è ricorrente e viene segnata come pagata, crea la prossima scadenza
    if (isPaid === true && existing.isRecurring && existing.recurringType) {
      const nextDueDate = calculateNextDueDate(existing.dueDate, existing.recurringType);
      
      await prisma.deadline.create({
        data: {
          title: existing.title,
          description: existing.description,
          dueDate: nextDueDate,
          amount: existing.amount,
          category: existing.category,
          isRecurring: true,
          recurringType: existing.recurringType,
          isPaid: false,
          familyId,
        },
      });
    }

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
        id: parseInt(id),
        familyId,
      },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Scadenza non trovata' });
    }

    await prisma.deadline.delete({
      where: { id: parseInt(id) },
    });

    res.json({ message: 'Scadenza eliminata' });
  } catch (error) {
    console.error('Delete deadline error:', error);
    res.status(500).json({ error: 'Errore nell\'eliminazione della scadenza' });
  }
});

// GET /api/deadlines/stats/monthly - Statistiche mensili
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

// Helper function per calcolare la prossima scadenza
function calculateNextDueDate(currentDate, recurringType) {
  const next = new Date(currentDate);
  
  switch (recurringType) {
    case 'SETTIMANALE':
      next.setDate(next.getDate() + 7);
      break;
    case 'MENSILE':
      next.setMonth(next.getMonth() + 1);
      break;
    case 'TRIMESTRALE':
      next.setMonth(next.getMonth() + 3);
      break;
    case 'SEMESTRALE':
      next.setMonth(next.getMonth() + 6);
      break;
    case 'ANNUALE':
      next.setFullYear(next.getFullYear() + 1);
      break;
    default:
      next.setMonth(next.getMonth() + 1);
  }
  
  return next;
}

export default router;
