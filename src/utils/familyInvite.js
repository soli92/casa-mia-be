import { randomBytes } from 'crypto';
import { prisma } from './prisma.js';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function randomInviteCode() {
  const buf = randomBytes(12);
  let s = '';
  for (let i = 0; i < 8; i += 1) {
    s += ALPHABET[buf[i] % ALPHABET.length];
  }
  return s;
}

/** @returns {Promise<string>} */
export async function allocateUniqueFamilyInviteCode() {
  for (let i = 0; i < 20; i += 1) {
    const code = randomInviteCode();
    const clash = await prisma.family.findUnique({
      where: { inviteCode: code },
      select: { id: true },
    });
    if (!clash) return code;
  }
  throw new Error('Impossibile generare codice invito univoco');
}
