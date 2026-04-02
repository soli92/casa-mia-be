import { PrismaClient } from '@prisma/client';

const globalForPrisma = global;

/** Log sicuro (no password): aiuta a capire Tenant or user not found su pooler Supabase. */
function logDatabaseUrlTarget() {
  const dsn = process.env.DATABASE_URL;
  if (!dsn || process.env.LOG_DATABASE_TARGET === '0') return;
  try {
    const url = new URL(dsn);
    const user = decodeURIComponent(url.username || '');
    const port = url.port || 'default';
    const hints = [];
    if (url.hostname.includes('pooler.supabase.com')) {
      if (user === 'postgres' || !user.includes('.')) {
        hints.push(
          'su host *.pooler.supabase.com l’utente deve essere postgres.<project_ref> (Session pool, dalla scheda Connect).'
        );
      }
    }
    if (url.hostname.startsWith('db.') && url.hostname.endsWith('.supabase.co') && port === '6543') {
      if (user.includes('.')) {
        hints.push('su db.*:6543 (transaction pool) l’utente deve essere solo postgres.');
      }
    }
    const warn = hints.length ? `\n   ⚠️ ${hints.join(' ')}` : '';
    console.log(`🗄️ DB target: ${url.hostname}:${port} (user: ${user})${warn}`);
  } catch {
    console.warn('🗄️ DATABASE_URL non è un URL valido (password con caratteri speciali? usa percent-encoding).');
  }
}

logDatabaseUrlTarget();

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
