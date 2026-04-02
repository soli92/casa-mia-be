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
  getPresignedGetUrl,
  headObjectMeta,
  deleteObject,
} from '../utils/documentStorage.js';

const router = express.Router();
const PRESIGN_GET_TTL_SEC = 900;

async function assertFolderInFamily(folderId, familyId) {
  if (!folderId) return null;
  const f = await prisma.documentFolder.findFirst({
    where: { id: folderId, familyId },
  });
  return f;
}

router.get('/', async (req, res) => {
  try {
    if (!isDocumentStorageConfigured()) {
      return res.json({
        folders: [],
        items: [],
        storageConfigured: false,
        maxBytes: getMaxDocumentBytes(),
      });
    }

    const [folders, items] = await Promise.all([
      prisma.documentFolder.findMany({
        where: { familyId: req.user.familyId },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      }),
      prisma.familyDocument.findMany({
        where: { familyId: req.user.familyId },
        orderBy: { createdAt: 'desc' },
        include: {
          uploadedBy: { select: { id: true, name: true } },
          folder: { select: { id: true, name: true } },
        },
      }),
    ]);

    const safeItems = items.map(({ publicUrl: _omit, ...doc }) => doc);

    res.json({
      folders,
      items: safeItems,
      storageConfigured: true,
      maxBytes: getMaxDocumentBytes(),
    });
  } catch (error) {
    console.error('List documents error:', error);
    res.status(500).json({ error: 'Errore nel recupero dei documenti' });
  }
});

router.post('/folders', async (req, res) => {
  try {
    const raw = String(req.body?.name || '')
      .trim()
      .replace(/[/\\?%*:|"<>]/g, '_')
      .slice(0, 120);
    if (!raw) {
      return res.status(400).json({ error: 'Nome cartella obbligatorio' });
    }

    const maxSort = await prisma.documentFolder.aggregate({
      where: { familyId: req.user.familyId },
      _max: { sortOrder: true },
    });
    const sortOrder = (maxSort._max.sortOrder ?? 0) + 1;

    const folder = await prisma.documentFolder.create({
      data: {
        familyId: req.user.familyId,
        name: raw,
        sortOrder,
      },
    });

    res.status(201).json(folder);
  } catch (error) {
    console.error('Create folder error:', error);
    res.status(500).json({ error: 'Impossibile creare la cartella' });
  }
});

router.patch('/folders/:folderId', async (req, res) => {
  try {
    const { folderId } = req.params;
    const folder = await prisma.documentFolder.findFirst({
      where: { id: folderId, familyId: req.user.familyId },
    });
    if (!folder) {
      return res.status(404).json({ error: 'Cartella non trovata' });
    }

    const rawName = req.body?.name;
    const name =
      rawName !== undefined
        ? String(rawName)
            .trim()
            .replace(/[/\\?%*:|"<>]/g, '_')
            .slice(0, 120)
        : folder.name;
    if (!name) {
      return res.status(400).json({ error: 'Nome non valido' });
    }

    const updated = await prisma.documentFolder.update({
      where: { id: folderId },
      data: { name },
    });

    res.json(updated);
  } catch (error) {
    console.error('Update folder error:', error);
    res.status(500).json({ error: 'Impossibile aggiornare la cartella' });
  }
});

router.delete('/folders/:folderId', async (req, res) => {
  try {
    const { folderId } = req.params;
    const folder = await prisma.documentFolder.findFirst({
      where: { id: folderId, familyId: req.user.familyId },
    });
    if (!folder) {
      return res.status(404).json({ error: 'Cartella non trovata' });
    }

    await prisma.documentFolder.delete({ where: { id: folderId } });
    res.json({ message: 'Cartella eliminata' });
  } catch (error) {
    console.error('Delete folder error:', error);
    res.status(500).json({ error: 'Impossibile eliminare la cartella' });
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

    const { originalName, contentType, sizeBytes, folderId } = req.body ?? {};
    if (folderId) {
      const f = await assertFolderInFamily(String(folderId), req.user.familyId);
      if (!f) {
        return res.status(400).json({ error: 'Cartella non trovata' });
      }
    }

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

    const { storageKey, originalName, contentType, sizeBytes, folderId } =
      req.body ?? {};
    const key = String(storageKey || '').trim();
    const prefix = `families/${req.user.familyId}/`;

    if (!key.startsWith(prefix) || key.includes('..')) {
      return res.status(400).json({ error: 'Percorso file non valido' });
    }

    let resolvedFolderId = null;
    if (folderId) {
      const f = await assertFolderInFamily(String(folderId), req.user.familyId);
      if (!f) {
        return res.status(400).json({ error: 'Cartella non trovata' });
      }
      resolvedFolderId = f.id;
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

    const legacyPublic = buildPublicUrl(key) || null;

    const doc = await prisma.familyDocument.create({
      data: {
        familyId: req.user.familyId,
        folderId: resolvedFolderId,
        uploadedById: req.user.id,
        originalName: nameSan,
        mimeType: mime,
        sizeBytes: Math.round(Number(head.contentLength)),
        storageKey: key,
        publicUrl: legacyPublic,
      },
      include: {
        uploadedBy: { select: { id: true, name: true } },
        folder: { select: { id: true, name: true } },
      },
    });

    const { publicUrl: _o, ...safe } = doc;
    res.status(201).json(safe);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return res.status(409).json({ error: 'Questo file è già stato registrato' });
    }
    console.error('Commit document error:', error);
    res.status(500).json({ error: 'Errore durante la registrazione del documento' });
  }
});

router.get('/:id/access-url', async (req, res) => {
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

    const url = await getPresignedGetUrl(doc.storageKey);
    res.json({
      url,
      expiresIn: PRESIGN_GET_TTL_SEC,
      mimeType: doc.mimeType,
      originalName: doc.originalName,
    });
  } catch (error) {
    console.error('Document access-url error:', error);
    res.status(500).json({ error: 'Impossibile generare il link di accesso' });
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
