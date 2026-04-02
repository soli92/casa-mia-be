import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  isDocumentStorageConfigured,
  getMaxDocumentBytes,
  sanitizeOriginalFilename,
  isAllowedDocumentMime,
  buildStorageKey,
  buildPublicUrl,
} from '../src/utils/documentStorage.js';

describe('documentStorage', () => {
  const envKeys = ['S3_BUCKET', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY', 'S3_PUBLIC_URL'];
  const snapshot = {};

  beforeEach(() => {
    for (const k of envKeys) {
      snapshot[k] = process.env[k];
      delete process.env[k];
    }
  });

  afterEach(() => {
    for (const k of envKeys) {
      if (snapshot[k] === undefined) delete process.env[k];
      else process.env[k] = snapshot[k];
    }
  });

  it('isDocumentStorageConfigured è true con bucket e chiavi, senza S3_PUBLIC_URL', () => {
    process.env.S3_BUCKET = 'b';
    process.env.S3_ACCESS_KEY_ID = 'k';
    process.env.S3_SECRET_ACCESS_KEY = 's';
    expect(isDocumentStorageConfigured()).toBe(true);
  });

  it('isDocumentStorageConfigured è false se manca una chiave', () => {
    process.env.S3_BUCKET = 'b';
    process.env.S3_ACCESS_KEY_ID = 'k';
    expect(isDocumentStorageConfigured()).toBe(false);
  });

  it('buildPublicUrl restituisce stringa vuota senza S3_PUBLIC_URL', () => {
    process.env.S3_PUBLIC_URL = '';
    expect(buildPublicUrl('families/x/y.pdf')).toBe('');
  });

  it('buildPublicUrl costruisce URL con base senza slash finale', () => {
    process.env.S3_PUBLIC_URL = 'https://cdn.example.com/';
    const u = buildPublicUrl('families/fam/doc.pdf');
    expect(u).toBe('https://cdn.example.com/families/fam/doc.pdf');
  });

  it('getMaxDocumentBytes è 25 MB', () => {
    expect(getMaxDocumentBytes()).toBe(25 * 1024 * 1024);
  });

  it('sanitizeOriginalFilename rimuove caratteri rischiosi', () => {
    expect(sanitizeOriginalFilename('a/b|c.pdf')).toBe('a_b_c.pdf');
  });

  it('isAllowedDocumentMime accetta pdf, immagini e tipi office', () => {
    expect(isAllowedDocumentMime('application/pdf')).toBe(true);
    expect(isAllowedDocumentMime('image/jpeg')).toBe(true);
    expect(isAllowedDocumentMime('text/plain')).toBe(true);
    expect(isAllowedDocumentMime('application/zip')).toBe(false);
  });

  it('buildStorageKey usa prefisso famiglia e uuid', () => {
    const key = buildStorageKey('fam_1', 'Doc 1.pdf');
    expect(key.startsWith('families/fam_1/')).toBe(true);
    expect(key.endsWith('-Doc_1.pdf')).toBe(true);
    expect(key.split('/').length).toBe(3);
  });
});
