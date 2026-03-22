import express from 'express';
import { prisma } from '../utils/prisma.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticateToken);

// Ottieni tutti i dispositivi IoT
router.get('/devices', async (req, res) => {
  try {
    const devices = await prisma.ioTDevice.findMany({
      where: { familyId: req.user.familyId },
      orderBy: { createdAt: 'desc' },
    });

    res.json(devices);
  } catch (error) {
    console.error('Get IoT devices error:', error);
    res.status(500).json({ error: 'Errore durante il recupero dei dispositivi' });
  }
});

// Ottieni singolo dispositivo
router.get('/devices/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const device = await prisma.ioTDevice.findUnique({
      where: { id },
      include: {
        events: {
          orderBy: { createdAt: 'desc' },
          take: 50,
        },
      },
    });

    if (!device || device.familyId !== req.user.familyId) {
      return res.status(404).json({ error: 'Dispositivo non trovato' });
    }

    res.json(device);
  } catch (error) {
    console.error('Get IoT device error:', error);
    res.status(500).json({ error: 'Errore durante il recupero del dispositivo' });
  }
});

// Aggiungi dispositivo
router.post('/devices', async (req, res) => {
  try {
    const { name, type, brand, model, webhookUrl, apiKey, metadata } = req.body;

    if (!name || !type) {
      return res.status(400).json({ error: 'Nome e tipo obbligatori' });
    }

    const device = await prisma.ioTDevice.create({
      data: {
        name,
        type,
        brand,
        model,
        webhookUrl,
        apiKey,
        metadata: metadata || {},
        status: 'offline',
        familyId: req.user.familyId,
      },
    });

    res.status(201).json(device);
  } catch (error) {
    console.error('Create IoT device error:', error);
    res.status(500).json({ error: 'Errore durante l\'aggiunta del dispositivo' });
  }
});

// Aggiorna dispositivo
router.patch('/devices/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, type, brand, model, status, webhookUrl, apiKey, metadata } = req.body;

    const device = await prisma.ioTDevice.findUnique({ where: { id } });
    if (!device || device.familyId !== req.user.familyId) {
      return res.status(404).json({ error: 'Dispositivo non trovato' });
    }

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (type !== undefined) updateData.type = type;
    if (brand !== undefined) updateData.brand = brand;
    if (model !== undefined) updateData.model = model;
    if (status !== undefined) {
      updateData.status = status;
      updateData.lastPing = new Date();
    }
    if (webhookUrl !== undefined) updateData.webhookUrl = webhookUrl;
    if (apiKey !== undefined) updateData.apiKey = apiKey;
    if (metadata !== undefined) updateData.metadata = metadata;

    const updated = await prisma.ioTDevice.update({
      where: { id },
      data: updateData,
    });

    res.json(updated);
  } catch (error) {
    console.error('Update IoT device error:', error);
    res.status(500).json({ error: 'Errore durante l\'aggiornamento del dispositivo' });
  }
});

// Elimina dispositivo
router.delete('/devices/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const device = await prisma.ioTDevice.findUnique({ where: { id } });
    if (!device || device.familyId !== req.user.familyId) {
      return res.status(404).json({ error: 'Dispositivo non trovato' });
    }

    await prisma.ioTDevice.delete({ where: { id } });
    res.json({ message: 'Dispositivo eliminato' });
  } catch (error) {
    console.error('Delete IoT device error:', error);
    res.status(500).json({ error: 'Errore durante l\'eliminazione' });
  }
});

// Webhook per ricevere eventi dai dispositivi (senza auth per dispositivi esterni)
router.post('/webhook/:deviceId', async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { apiKey, eventType, payload } = req.body;

    // Verifica dispositivo e API key
    const device = await prisma.ioTDevice.findUnique({ where: { id: deviceId } });
    
    if (!device) {
      return res.status(404).json({ error: 'Dispositivo non trovato' });
    }

    if (device.apiKey && device.apiKey !== apiKey) {
      return res.status(403).json({ error: 'API key non valida' });
    }

    // Crea evento e aggiorna lastPing
    const event = await prisma.$transaction(async (tx) => {
      const newEvent = await tx.ioTEvent.create({
        data: {
          deviceId,
          eventType: eventType || 'state_change',
          payload: payload || {},
        },
      });

      await tx.ioTDevice.update({
        where: { id: deviceId },
        data: {
          status: 'online',
          lastPing: new Date(),
        },
      });

      return newEvent;
    });

    res.status(201).json(event);
  } catch (error) {
    console.error('IoT webhook error:', error);
    res.status(500).json({ error: 'Errore durante la ricezione dell\'evento' });
  }
});

// Ottieni eventi di un dispositivo
router.get('/devices/:id/events', async (req, res) => {
  try {
    const { id } = req.params;
    const { limit = 50 } = req.query;

    const device = await prisma.ioTDevice.findUnique({ where: { id } });
    if (!device || device.familyId !== req.user.familyId) {
      return res.status(404).json({ error: 'Dispositivo non trovato' });
    }

    const events = await prisma.ioTEvent.findMany({
      where: { deviceId: id },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit),
    });

    res.json(events);
  } catch (error) {
    console.error('Get IoT events error:', error);
    res.status(500).json({ error: 'Errore durante il recupero degli eventi' });
  }
});

export default router;
