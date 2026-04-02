import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';

const prismaMock = vi.hoisted(() => ({
  documentFolder: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    aggregate: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  familyDocument: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
  },
}));

const storageSpies = vi.hoisted(() => ({
  isDocumentStorageConfigured: vi.fn(() => true),
  getPresignedPutUrl: vi.fn(async () => 'https://storage.example/presigned-put'),
  getPresignedGetUrl: vi.fn(async () => 'https://storage.example/presigned-get'),
  headObjectMeta: vi.fn(async () => ({
    contentLength: 2048,
    contentType: 'application/pdf',
  })),
  deleteObject: vi.fn(async () => {}),
}));

vi.mock('../src/utils/prisma.js', () => ({
  prisma: prismaMock,
}));

vi.mock('../src/utils/documentStorage.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    isDocumentStorageConfigured: storageSpies.isDocumentStorageConfigured,
    getPresignedPutUrl: storageSpies.getPresignedPutUrl,
    getPresignedGetUrl: storageSpies.getPresignedGetUrl,
    headObjectMeta: storageSpies.headObjectMeta,
    deleteObject: storageSpies.deleteObject,
  };
});

const documentsRouter = (await import('../src/routes/documents.js')).default;

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    req.user = { id: 'user1', familyId: 'family1' };
    next();
  });
  app.use('/', documentsRouter);
  return app;
}

describe('documents routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storageSpies.isDocumentStorageConfigured.mockReturnValue(true);
  });

  it('GET / con storage disattivo restituisce elenchi vuoti', async () => {
    storageSpies.isDocumentStorageConfigured.mockReturnValue(false);
    const app = makeApp();
    const res = await request(app).get('/').expect(200);
    expect(res.body).toMatchObject({
      folders: [],
      items: [],
      storageConfigured: false,
    });
    expect(prismaMock.documentFolder.findMany).not.toHaveBeenCalled();
  });

  it('GET / con storage attivo elenca cartelle e documenti senza publicUrl', async () => {
    prismaMock.documentFolder.findMany.mockResolvedValue([{ id: 'f1', name: 'Fiscali' }]);
    prismaMock.familyDocument.findMany.mockResolvedValue([
      {
        id: 'd1',
        publicUrl: 'https://legacy',
        originalName: 'a.pdf',
        mimeType: 'application/pdf',
        storageKey: 'families/family1/x',
        folderId: null,
        uploadedBy: { id: 'user1', name: 'A' },
        folder: null,
      },
    ]);
    const app = makeApp();
    const res = await request(app).get('/').expect(200);
    expect(res.body.folders).toHaveLength(1);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].publicUrl).toBeUndefined();
    expect(res.body.items[0].originalName).toBe('a.pdf');
  });

  it('POST /folders senza nome risponde 400', async () => {
    const app = makeApp();
    await request(app).post('/folders').send({ name: '   ' }).expect(400);
    expect(prismaMock.documentFolder.create).not.toHaveBeenCalled();
  });

  it('POST /folders crea cartella con sortOrder', async () => {
    prismaMock.documentFolder.aggregate.mockResolvedValue({ _max: { sortOrder: 3 } });
    prismaMock.documentFolder.create.mockResolvedValue({
      id: 'nf',
      familyId: 'family1',
      name: 'Salute',
      sortOrder: 4,
    });
    const app = makeApp();
    const res = await request(app).post('/folders').send({ name: 'Salute' }).expect(201);
    expect(res.body.name).toBe('Salute');
    expect(res.body.sortOrder).toBe(4);
  });

  it('POST /presign con body incompleto risponde 400', async () => {
    const app = makeApp();
    await request(app)
      .post('/presign')
      .send({ originalName: 'x.pdf' })
      .expect(400);
    expect(storageSpies.getPresignedPutUrl).not.toHaveBeenCalled();
  });

  it('POST /presign con MIME non consentito risponde 400', async () => {
    const app = makeApp();
    await request(app)
      .post('/presign')
      .send({
        originalName: 'x.zip',
        contentType: 'application/zip',
        sizeBytes: 100,
      })
      .expect(400);
  });

  it('POST /presign valido restituisce uploadUrl e storageKey', async () => {
    const app = makeApp();
    const res = await request(app)
      .post('/presign')
      .send({
        originalName: 'doc.pdf',
        contentType: 'application/pdf',
        sizeBytes: 5000,
      })
      .expect(200);
    expect(res.body.uploadUrl).toBe('https://storage.example/presigned-put');
    expect(res.body.storageKey).toMatch(/^families\/family1\//);
    expect(storageSpies.getPresignedPutUrl).toHaveBeenCalledOnce();
  });

  it('POST /presign con folderId errato risponde 400', async () => {
    prismaMock.documentFolder.findFirst.mockResolvedValue(null);
    const app = makeApp();
    await request(app)
      .post('/presign')
      .send({
        originalName: 'a.pdf',
        contentType: 'application/pdf',
        sizeBytes: 100,
        folderId: 'missing',
      })
      .expect(400);
  });

  it('PATCH /folders/:id senza cartella risponde 404', async () => {
    prismaMock.documentFolder.findFirst.mockResolvedValue(null);
    const app = makeApp();
    await request(app).patch('/folders/x').send({ name: 'Y' }).expect(404);
  });

  it('GET /:id/access-url documento assente risponde 404', async () => {
    prismaMock.familyDocument.findUnique.mockResolvedValue(null);
    const app = makeApp();
    await request(app).get('/nope/access-url').expect(404);
  });

  it('GET /:id/access-url altra famiglia risponde 404', async () => {
    prismaMock.familyDocument.findUnique.mockResolvedValue({
      id: 'd1',
      familyId: 'other',
      storageKey: 'k',
      mimeType: 'application/pdf',
      originalName: 'x.pdf',
    });
    const app = makeApp();
    await request(app).get('/d1/access-url').expect(404);
  });

  it('GET /:id/access-url ok restituisce url firmato', async () => {
    prismaMock.familyDocument.findUnique.mockResolvedValue({
      id: 'd1',
      familyId: 'family1',
      storageKey: 'families/family1/key',
      mimeType: 'application/pdf',
      originalName: 'x.pdf',
    });
    const app = makeApp();
    const res = await request(app).get('/d1/access-url').expect(200);
    expect(res.body.url).toBe('https://storage.example/presigned-get');
    expect(res.body.mimeType).toBe('application/pdf');
    expect(res.body.expiresIn).toBe(900);
    expect(storageSpies.getPresignedGetUrl).toHaveBeenCalledWith('families/family1/key');
  });

  it('DELETE /:id documento altra famiglia risponde 404', async () => {
    prismaMock.familyDocument.findUnique.mockResolvedValue({
      id: 'd1',
      familyId: 'other',
      storageKey: 'k',
    });
    const app = makeApp();
    await request(app).delete('/d1').expect(404);
    expect(prismaMock.familyDocument.delete).not.toHaveBeenCalled();
  });

  it('DELETE /:id ok elimina su storage e DB', async () => {
    prismaMock.familyDocument.findUnique.mockResolvedValue({
      id: 'd1',
      familyId: 'family1',
      storageKey: 'families/family1/obj',
    });
    prismaMock.familyDocument.delete.mockResolvedValue({});
    const app = makeApp();
    await request(app).delete('/d1').expect(200);
    expect(storageSpies.deleteObject).toHaveBeenCalledWith('families/family1/obj');
    expect(prismaMock.familyDocument.delete).toHaveBeenCalledWith({ where: { id: 'd1' } });
  });

  it('POST /commit con storageKey fuori prefisso famiglia risponde 400', async () => {
    const app = makeApp();
    await request(app)
      .post('/commit')
      .send({
        storageKey: 'other/zone/file.pdf',
        originalName: 'file.pdf',
        contentType: 'application/pdf',
        sizeBytes: 2048,
      })
      .expect(400);
  });
});
