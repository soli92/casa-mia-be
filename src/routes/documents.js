import express from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../utils/prisma.js';
import {
  isDocumentStorageConfigured,
  getMaxDocumentBytes,
  sanitizeOriginalFilename,
  isAllowedDocumentMime,
  buildStorageKey,
  buildPublicUrl,
  getPresignedPutUrl,
  headObjectMeta,
  deleteObject,
} from '../utils/documentStorage.js';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    if (!isDocumentStorageConfigured()) {
      return res.json({
        items: [],
        storageConfigured: false,
        maxBytes: getMaxDocumentBytes(),
      });
    }

    const items = await prisma.familyDocument.findMany({
      where: { familyId: req.user.familyId },
      orderBy: { createdAt: 'desc' },
      include: { uploadedBy: { select: { id: true, name: true } } },
    });

    res.json({
      items,
      storageConfigured: true,
      maxBytes: getMaxDocumentBytes(),
    });
  } catch (error) {
    console.error('List documents error:', error);
    res.status(500).json({ error: 'Errore nel recupero dei documenti' });
  }
});

router.post('/presign', async (req, res) => {
  try {
    if (!isDocumentStorageConfigured()) {
      return res.status(503).json({
        error: 'Archivio documenti non configurato (variabili S3_* sul server)',
        code: 'STORAGE_DISABLED',
      });
    }

    const { originalName, contentType, sizeBytes } = req.body ?? {};
    const nameSan = sanitizeOriginalFilename(originalName);
    const mime = String(contentType || '').trim();
    const size = Number(sizeBytes);

    if (!nameSan || !mime || !Number.isFinite(size) || size <= 0) {
      return res.status(400).json({ error: 'Nome file, tipo e dimensione sono obbligatori' });
    }

    if (size > getMaxDocumentBytes()) {
      return res.status(400).json({
        error: `File troppo grande (massimo ${getMaxDocumentBytes() / 1024 / 1024} MB)`,
      });
    }

    if (!isAllowedDocumentMime(mime)) {
      return res.status(400).json({ error: 'Tipo file non consentito' });
    }

    const storageKey = buildStorageKey(req.user.familyId, nameSan);
    const uploadUrl = await getPresignedPutUrl(storageKey, mime);

    res.json({
      uploadUrl,
      storageKey,
      contentType: mime,
      maxBytes: getMaxDocumentBytes(),
      expiresIn: 900,
    });
  } catch (error) {
    console.error('Presign document error:', error);
    res.status(500).json({ error: 'Impossibile preparare il caricamento' });
  }
});

router.post('/commit', async (req, res) => {
  try {
    if (!isDocumentStorageConfigured()) {
      return res.status(503).json({
        error: 'Archivio documenti non configurato',
        code: 'STORAGE_DISABLED',
      });
    }

    const { storageKey, originalName, contentType, sizeBytes } = req.body ?? {};
    const key = String(storageKey || '').trim();
    const prefix = `families/${req.user.familyId}/`;

    if (!key.startsWith(prefix) || key.includes('..')) {
      return res.status(400).json({ error: 'Percorso file non valido' });
    }

    const nameSan = sanitizeOriginalFilename(originalName);
    const mime = String(contentType || '').trim();
    const size = Number(sizeBytes);

    if (!nameSan || !mime || !Number.isFinite(size)) {
      return res.status(400).json({ error: 'Dati mancanti o non validi' });
    }

    if (!isAllowedDocumentMime(mime)) {
      return res.status(400).json({ error: 'Tipo file non consentito' });
    }

    let head;
    try {
      head = await headObjectMeta(key);
    } catch {
      return res.status(400).json({
        error:
          'File non trovato nello storage. Attendi fine upload oppure ripeti il caricamento.',
      });
    }

    if (!head.contentLength || head.contentLength <= 0) {
      return res.status(400).json({ error: 'File vuoto o non ancora disponibile' });
    }

    if (head.contentLength > getMaxDocumentBytes()) {
      return res.status(400).json({ error: 'File troppo grande' });
    }

    const drift = Math.max(8192, size * 0.08);
    if (Math.abs(Number(head.contentLength) - size) > drift) {
      return res.status(400).json({ error: 'Dimensione segnalata diversa da quella sullo storage' });
    }

    const publicUrl = buildPublicUrl(key);

    const doc = await prisma.familyDocument.create({
      data: {
        familyId: req.user.familyId,
        uploadedById: req.user.id,
        originalName: nameSan,
        mimeType: mime,
        sizeBytes: Math.round(Number(head.contentLength)),
        storageKey: key,
        publicUrl,
      },
      include: { uploadedBy: { select: { id: true, name: true } } },
    });

    res.status(201).json(doc);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return res.status(409).json({ error: 'Questo file è già stato registrato' });
    }
    console.error('Commit document error:', error);
    res.status(500).json({ error: 'Errore durante la registrazione del documento' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    if (!isDocumentStorageConfigured()) {
      return res.status(503).json({
        error: 'Archivio documenti non configurato',
        code: 'STORAGE_DISABLED',
      });
    }

    const { id } = req.params;
    const doc = await prisma.familyDocument.findUnique({ where: { id } });

    if (!doc || doc.familyId !== req.user.familyId) {
      return res.status(404).json({ error: 'Documento non trovato' });
    }

    try {
      await deleteObject(doc.storageKey);
    } catch (e) {
      console.error('S3 deleteObject:', e);
    }

    await prisma.familyDocument.delete({ where: { id } });
    res.json({ message: 'Documento eliminato' });
  } catch (error) {
    console.error('Delete document error:', error);
    res.status(500).json({ error: 'Errore durante l\'eliminazione' });
  }
});

export default router;
