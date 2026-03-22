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
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    res.json(deadlines);
  } catch (error) {
    console.error('Get deadlines error:', error);
    res.status(500).json({ error: 'Errore nel recupero delle scadenze' });
  }
});

// GET /api/deadlines/upcoming - Scadenze imminenti (prossimi 7 giorni)
router.get('/upcoming', async (req, res) => {
  try {
    const { familyId } = req.user;
    const now = new Date();
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

    const upcomingDeadlines = await prisma.deadline.findMany({
      where: {
        familyId,
        dueDate: {
          gte: now,
          lte: sevenDaysFromNow,
        },
        isPaid: false,
      },
      orderBy: { dueDate: 'asc' },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    res.json(upcomingDeadlines);
  } catch (error) {
    console.error('Get upcoming deadlines error:', error);
    res.status(500).json({ error: 'Errore nel recupero delle scadenze imminenti' });
  }
});

// GET /api/deadlines/overdue - Scadenze scadute e non pagate
router.get('/overdue', async (req, res) => {
  try {
    const { familyId } = req.user;
    const now = new Date();

    const overdueDeadlines = await prisma.deadline.findMany({
      where: {
        familyId,
        dueDate: {
          lt: now,
        },
        isPaid: false,
      },
      orderBy: { dueDate: 'asc' },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    res.json(overdueDeadlines);
  } catch (error) {
    console.error('Get overdue deadlines error:', error);
    res.status(500).json({ error: 'Errore nel recupero delle scadenze scadute' });
  }
});

// GET /api/deadlines/:id - Dettaglio scadenza
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { familyId } = req.user;

    const deadline = await prisma.deadline.findFirst({
      where: {
        id: parseInt(id),
        familyId,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
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
    const { title, description, dueDate, amount, category, isRecurring, recurringPeriod } = req.body;
    const { familyId, id: userId } = req.user;

    if (!title || !dueDate) {
      return res.status(400).json({ error: 'Titolo e data di scadenza sono obbligatori' });
    }

    const deadline = await prisma.deadline.create({
      data: {
        title,
        description,
        dueDate: new Date(dueDate),
        amount: amount ? parseFloat(amount) : null,
        category: category || 'OTHER',
        isRecurring: isRecurring || false,
        recurringPeriod: recurringPeriod || null,
        isPaid: false,
        familyId,
        userId,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
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
    const { id } = req.params;
    const { familyId } = req.user;
    const { title, description, dueDate, amount, category, isPaid, isRecurring, recurringPeriod } = req.body;

    // Verifica che la scadenza appartenga alla famiglia
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
    if (isPaid !== undefined) {
      updateData.isPaid = isPaid;
      if (isPaid) {
        updateData.paidAt = new Date();
      }
    }
    if (isRecurring !== undefined) updateData.isRecurring = isRecurring;
    if (recurringPeriod !== undefined) updateData.recurringPeriod = recurringPeriod;

    const deadline = await prisma.deadline.update({
      where: { id: parseInt(id) },
      data: updateData,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    // Se è ricorrente e viene segnata come pagata, crea la prossima scadenza
    if (isPaid && deadline.isRecurring && deadline.recurringPeriod) {
      const nextDueDate = new Date(deadline.dueDate);
      
      switch (deadline.recurringPeriod) {
        case 'WEEKLY':
          nextDueDate.setDate(nextDueDate.getDate() + 7);
          break;
        case 'MONTHLY':
          nextDueDate.setMonth(nextDueDate.getMonth() + 1);
          break;
        case 'QUARTERLY':
          nextDueDate.setMonth(nextDueDate.getMonth() + 3);
          break;
        case 'YEARLY':
          nextDueDate.setFullYear(nextDueDate.getFullYear() + 1);
          break;
      }

      await prisma.deadline.create({
        data: {
          title: deadline.title,
          description: deadline.description,
          dueDate: nextDueDate,
          amount: deadline.amount,
          category: deadline.category,
          isRecurring: true,
          recurringPeriod: deadline.recurringPeriod,
          isPaid: false,
          familyId: deadline.familyId,
          userId: deadline.userId,
        },
      });
    }

    res.json(deadline);
  } catch (error) {
    console.error('Update deadline error:', error);
    res.status(500).json({ error: 'Errore nell\'aggiornamento della scadenza' });
  }
});

// DELETE /api/deadlines/:id - Elimina scadenza
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { familyId } = req.user;

    // Verifica che la scadenza appartenga alla famiglia
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

    res.json({ message: 'Scadenza eliminata con successo' });
  } catch (error) {
    console.error('Delete deadline error:', error);
    res.status(500).json({ error: 'Errore nell\'eliminazione della scadenza' });
  }
});

// GET /api/deadlines/stats/monthly - Statistiche mensili spese
router.get('/stats/monthly', async (req, res) => {
  try {
    const { familyId } = req.user;
    const { year, month } = req.query;

    const startDate = new Date(year || new Date().getFullYear(), month ? month - 1 : 0, 1);
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + (month ? 1 : 12));

    const deadlines = await prisma.deadline.findMany({
      where: {
        familyId,
        dueDate: {
          gte: startDate,
          lt: endDate,
        },
        amount: {
          not: null,
        },
      },
      select: {
        category: true,
        amount: true,
        isPaid: true,
      },
    });

    // Raggruppa per categoria
    const stats = deadlines.reduce((acc, deadline) => {
      const cat = deadline.category || 'OTHER';
      if (!acc[cat]) {
        acc[cat] = { total: 0, paid: 0, unpaid: 0, count: 0 };
      }
      acc[cat].total += deadline.amount || 0;
      acc[cat].count += 1;
      if (deadline.isPaid) {
        acc[cat].paid += deadline.amount || 0;
      } else {
        acc[cat].unpaid += deadline.amount || 0;
      }
      return acc;
    }, {});

    res.json(stats);
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ error: 'Errore nel calcolo delle statistiche' });
  }
});

export default router;
