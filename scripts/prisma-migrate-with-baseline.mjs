/**
 * Esegue `prisma migrate deploy` e, se serve, marca come applicate le migration
 * già presenti nello schema (DB creato con `db push` o senza `_prisma_migrations`).
 * Disabilita con PRISMA_SKIP_AUTO_BASELINE=1.
 */
import 'dotenv/config';
import { execSync } from 'node:child_process';
import { PrismaClient } from '@prisma/client';

const INIT = '20260101000000_init_pre_postit';
const POST_IT = '20260202140000_add_post_it';

function run(cmd) {
  execSync(cmd, { stdio: 'inherit', env: process.env, cwd: process.cwd() });
}

async function hasPublicTable(prisma, name) {
  const rows = await prisma.$queryRaw`
    SELECT EXISTS (
      SELECT 1
      FROM pg_tables
      WHERE schemaname = 'public' AND tablename = ${name}
    ) AS exists;
  `;
  return Boolean(rows?.[0]?.exists);
}

async function appliedMigrationNames(prisma) {
  const meta = await hasPublicTable(prisma, '_prisma_migrations');
  if (!meta) return new Set();
  const rows = await prisma.$queryRaw`
    SELECT migration_name FROM public._prisma_migrations
    WHERE rolled_back_at IS NULL;
  `;
  return new Set(rows.map((r) => r.migration_name));
}

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL mancante');
  process.exit(1);
}

if (process.env.PRISMA_SKIP_AUTO_BASELINE === '1') {
  run('npx prisma migrate deploy');
  process.exit(0);
}

const prisma = new PrismaClient();

try {
  const userTable = await hasPublicTable(prisma, 'User');
  if (!userTable) {
    await prisma.$disconnect();
    run('npx prisma migrate deploy');
    process.exit(0);
  }

  let applied = await appliedMigrationNames(prisma);

  if (!applied.has(INIT)) {
    console.log(`[prisma] DB esistente senza storico init → migrate resolve --applied "${INIT}"`);
    await prisma.$disconnect();
    run(`npx prisma migrate resolve --applied "${INIT}"`);
    await prisma.$connect();
    applied = await appliedMigrationNames(prisma);
  }

  const postItTable = await hasPublicTable(prisma, 'PostIt');
  if (postItTable && !applied.has(POST_IT)) {
    console.log(`[prisma] Tabella PostIt già presente → migrate resolve --applied "${POST_IT}"`);
    await prisma.$disconnect();
    run(`npx prisma migrate resolve --applied "${POST_IT}"`);
  }
} catch (e) {
  console.error(e);
  process.exit(1);
} finally {
  await prisma.$disconnect().catch(() => {});
}

run('npx prisma migrate deploy');
