import express from 'express';
import { prisma } from '../utils/prisma.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Tutte le route richiedono autenticazione
router.use(authenticateToken);

// Ottieni lista della spesa della famiglia
router.get('/', async (req, res) => {
  try {
    const items = await prisma.shoppingItem.findMany({
      where: { familyId: req.user.familyId },
      include: { addedBy: { select: { name: true, email: true } } },
      orderBy: [{ checked: 'asc' }, { createdAt: 'desc' }],
    });

    res.json(items);
  } catch (error) {
    console.error('Get shopping items error:', error);
    res.status(500).json({ error: 'Errore durante il recupero della lista' });
  }
});

// Aggiungi articolo
router.post('/', async (req, res) => {
  try {
    const { name, quantity = 1, category = 'ALTRO' } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Nome prodotto obbligatorio' });
    }

    const item = await prisma.shoppingItem.create({
      data: {
        name,
        quantity,
        category,
        familyId: req.user.familyId,
        addedById: req.user.id,
      },
      include: { addedBy: { select: { name: true, email: true } } },
    });

    res.status(201).json(item);
  } catch (error) {
    console.error('Create shopping item error:', error);
    res.status(500).json({ error: 'Errore durante l\'aggiunta del prodotto' });
  }
});

// Aggiorna articolo (spunta/check)
router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { checked, quantity, name, category } = req.body;

    const item = await prisma.shoppingItem.findUnique({ where: { id } });
    if (!item || item.familyId !== req.user.familyId) {
      return res.status(404).json({ error: 'Articolo non trovato' });
    }

    const updateData = {};
    if (checked !== undefined) {
      updateData.checked = checked;
      if (checked) updateData.purchasedAt = new Date();
    }
    if (quantity !== undefined) updateData.quantity = quantity;
    if (name !== undefined) updateData.name = name;
    if (category !== undefined) updateData.category = category;

    const updated = await prisma.shoppingItem.update({
      where: { id },
      data: updateData,
      include: { addedBy: { select: { name: true, email: true } } },
    });

    res.json(updated);
  } catch (error) {
    console.error('Update shopping item error:', error);
    res.status(500).json({ error: 'Errore durante l\'aggiornamento' });
  }
});

// Elimina articolo
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const item = await prisma.shoppingItem.findUnique({ where: { id } });
    if (!item || item.familyId !== req.user.familyId) {
      return res.status(404).json({ error: 'Articolo non trovato' });
    }

    await prisma.shoppingItem.delete({ where: { id } });
    res.json({ message: 'Articolo eliminato' });
  } catch (error) {
    console.error('Delete shopping item error:', error);
    res.status(500).json({ error: 'Errore durante l\'eliminazione' });
  }
});

// Storico acquisti (articoli checked degli ultimi 30 giorni)
router.get('/history', async (req, res) => {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const history = await prisma.shoppingItem.findMany({
      where: {
        familyId: req.user.familyId,
        checked: true,
        purchasedAt: { gte: thirtyDaysAgo },
      },
      include: { addedBy: { select: { name: true } } },
      orderBy: { purchasedAt: 'desc' },
    });

    res.json(history);
  } catch (error) {
    console.error('Get shopping history error:', error);
    res.status(500).json({ error: 'Errore durante il recupero dello storico' });
  }
});

// Sposta dalla spesa alla dispensa
router.post('/:id/move-to-pantry', async (req, res) => {
  try {
    const { id } = req.params;
    const { expirationDate, unit = 'pz' } = req.body;

    const shoppingItem = await prisma.shoppingItem.findUnique({ where: { id } });
    if (!shoppingItem || shoppingItem.familyId !== req.user.familyId) {
      return res.status(404).json({ error: 'Articolo non trovato' });
    }

    // Crea nella dispensa e elimina dalla spesa
    const pantryItem = await prisma.$transaction(async (tx) => {
      const newPantryItem = await tx.pantryItem.create({
        data: {
          name: shoppingItem.name,
          quantity: shoppingItem.quantity,
          unit,
          category: shoppingItem.category,
          expirationDate: expirationDate ? new Date(expirationDate) : null,
          status: 'OK',
          familyId: req.user.familyId,
          addedById: req.user.id,
        },
      });

      await tx.shoppingItem.delete({ where: { id } });

      return newPantryItem;
    });

    res.status(201).json(pantryItem);
  } catch (error) {
    console.error('Move to pantry error:', error);
    res.status(500).json({ error: 'Errore durante lo spostamento in dispensa' });
  }
});

export default router;
