import express from 'express';
import { prisma } from '../utils/prisma.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticateToken);

// Aggiorna lo stato dei prodotti in base alla scadenza
const updatePantryStatus = async (familyId) => {
  const now = new Date();
  const sevenDaysFromNow = new Date();
  sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

  // Aggiorna expired
  await prisma.pantryItem.updateMany({
    where: {
      familyId,
      expirationDate: { lt: now },
      status: { not: 'EXPIRED' },
    },
    data: { status: 'EXPIRED' },
  });

  // Aggiorna expiring soon
  await prisma.pantryItem.updateMany({
    where: {
      familyId,
      expirationDate: { gte: now, lte: sevenDaysFromNow },
      status: 'OK',
    },
    data: { status: 'EXPIRING_SOON' },
  });

  // Riporta a OK quelli con scadenza lontana
  await prisma.pantryItem.updateMany({
    where: {
      familyId,
      expirationDate: { gt: sevenDaysFromNow },
      status: 'EXPIRING_SOON',
    },
    data: { status: 'OK' },
  });
};

// Ottieni dispensa
router.get('/', async (req, res) => {
  try {
    await updatePantryStatus(req.user.familyId);

    const items = await prisma.pantryItem.findMany({
      where: { familyId: req.user.familyId },
      include: { addedBy: { select: { name: true, email: true } } },
      orderBy: [{ status: 'desc' }, { expirationDate: 'asc' }],
    });

    res.json(items);
  } catch (error) {
    console.error('Get pantry error:', error);
    res.status(500).json({ error: 'Errore durante il recupero della dispensa' });
  }
});

// Aggiungi prodotto
router.post('/', async (req, res) => {
  try {
    const { name, quantity, unit = 'pz', category = 'ALTRO', expirationDate } = req.body;

    if (!name || !quantity) {
      return res.status(400).json({ error: 'Nome e quantità obbligatori' });
    }

    let status = 'OK';
    if (expirationDate) {
      const expDate = new Date(expirationDate);
      const now = new Date();
      const sevenDaysFromNow = new Date();
      sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

      if (expDate < now) status = 'EXPIRED';
      else if (expDate <= sevenDaysFromNow) status = 'EXPIRING_SOON';
    }

    const item = await prisma.pantryItem.create({
      data: {
        name,
        quantity: parseFloat(quantity),
        unit,
        category,
        expirationDate: expirationDate ? new Date(expirationDate) : null,
        status,
        familyId: req.user.familyId,
        addedById: req.user.id,
      },
      include: { addedBy: { select: { name: true, email: true } } },
    });

    res.status(201).json(item);
  } catch (error) {
    console.error('Create pantry item error:', error);
    res.status(500).json({ error: 'Errore durante l\'aggiunta del prodotto' });
  }
});

// Aggiorna prodotto
router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, quantity, unit, category, expirationDate } = req.body;

    const item = await prisma.pantryItem.findUnique({ where: { id } });
    if (!item || item.familyId !== req.user.familyId) {
      return res.status(404).json({ error: 'Prodotto non trovato' });
    }

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (quantity !== undefined) updateData.quantity = parseFloat(quantity);
    if (unit !== undefined) updateData.unit = unit;
    if (category !== undefined) updateData.category = category;
    if (expirationDate !== undefined) {
      updateData.expirationDate = expirationDate ? new Date(expirationDate) : null;
      
      // Ricalcola status
      if (expirationDate) {
        const expDate = new Date(expirationDate);
        const now = new Date();
        const sevenDaysFromNow = new Date();
        sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

        if (expDate < now) updateData.status = 'EXPIRED';
        else if (expDate <= sevenDaysFromNow) updateData.status = 'EXPIRING_SOON';
        else updateData.status = 'OK';
      }
    }

    const updated = await prisma.pantryItem.update({
      where: { id },
      data: updateData,
      include: { addedBy: { select: { name: true, email: true } } },
    });

    res.json(updated);
  } catch (error) {
    console.error('Update pantry item error:', error);
    res.status(500).json({ error: 'Errore durante l\'aggiornamento' });
  }
});

// Elimina prodotto
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const item = await prisma.pantryItem.findUnique({ where: { id } });
    if (!item || item.familyId !== req.user.familyId) {
      return res.status(404).json({ error: 'Prodotto non trovato' });
    }

    await prisma.pantryItem.delete({ where: { id } });
    res.json({ message: 'Prodotto eliminato' });
  } catch (error) {
    console.error('Delete pantry item error:', error);
    res.status(500).json({ error: 'Errore durante l\'eliminazione' });
  }
});

// Alert prodotti in scadenza
router.get('/alerts', async (req, res) => {
  try {
    await updatePantryStatus(req.user.familyId);

    const alerts = await prisma.pantryItem.findMany({
      where: {
        familyId: req.user.familyId,
        status: { in: ['EXPIRING_SOON', 'EXPIRED'] },
      },
      orderBy: { expirationDate: 'asc' },
    });

    res.json(alerts);
  } catch (error) {
    console.error('Get pantry alerts error:', error);
    res.status(500).json({ error: 'Errore durante il recupero degli alert' });
  }
});

export default router;
