import webpush from 'web-push';
import { prisma } from '../utils/prisma.js';

function todayUTC() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Invia al massimo una notifica giornaliera per sottoscrizione: scadenze non pagate
 * scadute o nei prossimi 7 giorni. Richiede VAPID_* in env.
 * @returns {Promise<{ skipped?: boolean, sent?: number, error?: string }>}
 */
export async function runDeadlinePushDigest() {
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) {
    console.log('🔔 Push: VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY assenti, digest non eseguito');
    return { skipped: true };
  }

  const subject = process.env.VAPID_SUBJECT || 'mailto:admin@localhost';
  webpush.setVapidDetails(subject, pub, priv);

  const todayStr = todayUTC();
  const subs = await prisma.pushSubscription.findMany({
    include: { user: true },
  });

  let sent = 0;
  const now = new Date();
  const weekAhead = new Date(now);
  weekAhead.setDate(weekAhead.getDate() + 7);

  for (const sub of subs) {
    if (sub.lastDigestDate === todayStr) continue;

    const { familyId } = sub.user;

    const overdue = await prisma.deadline.findMany({
      where: { familyId, isPaid: false, dueDate: { lt: now } },
      orderBy: { dueDate: 'asc' },
      take: 25,
    });

    const upcoming = await prisma.deadline.findMany({
      where: {
        familyId,
        isPaid: false,
        dueDate: { gte: now, lte: weekAhead },
      },
      orderBy: { dueDate: 'asc' },
      take: 25,
    });

    const seen = new Set();
    const list = [];
    for (const d of [...overdue, ...upcoming]) {
      if (seen.has(d.id)) continue;
      seen.add(d.id);
      list.push(d);
    }
    list.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));

    if (list.length === 0) continue;

    const title = 'Casa Mia — scadenze';
    const lines = list.slice(0, 5).map((d) => {
      const date = new Date(d.dueDate).toLocaleDateString('it-IT');
      const prefix = new Date(d.dueDate) < now ? '⚠ ' : '';
      return `${prefix}${d.title} (${date})`;
    });
    let body = lines.join('\n');
    if (list.length > 5) {
      body += `\n… e altre ${list.length - 5}`;
    }

    const payload = JSON.stringify({
      title,
      body,
      url: '/deadlines',
    });

    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        payload,
        { TTL: 86400 }
      );
      await prisma.pushSubscription.update({
        where: { id: sub.id },
        data: { lastDigestDate: todayStr },
      });
      sent += 1;
    } catch (e) {
      const code = e.statusCode;
      if (code === 410 || code === 404) {
        await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
      }
      console.error('Push send error:', e.message || e);
    }
  }

  if (sent > 0) {
    console.log(`🔔 Push digest: inviate ${sent} notifiche`);
  }
  return { sent };
}
