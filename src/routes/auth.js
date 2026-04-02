import express from 'express';
import bcrypt from 'bcrypt';
import { Prisma } from '@prisma/client';
import { prisma } from '../utils/prisma.js';
import { allocateUniqueFamilyInviteCode } from '../utils/familyInvite.js';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../utils/jwt.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

function normalizeEmail(email) {
  return String(email ?? '').trim().toLowerCase();
}

/** Dati famiglia esposti al client: `inviteCode` solo per admin (per invitare altri). */
function familyForClient(family, requesterRole) {
  if (!family) return null;
  const base = {
    id: family.id,
    name: family.name,
    createdAt: family.createdAt,
    updatedAt: family.updatedAt,
  };
  if (requesterRole === 'ADMIN') {
    base.inviteCode = family.inviteCode;
  }
  return base;
}

function normalizeInviteCode(raw) {
  return String(raw ?? '')
    .replace(/[\s-]/g, '')
    .toUpperCase();
}

// Registrazione nuova famiglia + primo utente admin
router.post('/register', async (req, res) => {
  try {
    const { email: rawEmail, password, name, familyName } = req.body;
    const email = normalizeEmail(rawEmail);
    const nameTrim = String(name ?? '').trim();
    const familyTrim = String(familyName ?? '').trim();

    if (!email || !password || !nameTrim || !familyTrim) {
      return res.status(400).json({ error: 'Tutti i campi sono obbligatori' });
    }

    // Verifica se l'email esiste già (stesso case-insensitive del valore salvato)
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: 'Email già registrata' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    const inviteCode = await allocateUniqueFamilyInviteCode();

    // Crea famiglia e utente admin in una transazione
    const result = await prisma.$transaction(async (tx) => {
      const family = await tx.family.create({
        data: { name: familyTrim, inviteCode },
      });

      const user = await tx.user.create({
        data: {
          email,
          password: hashedPassword,
          name: nameTrim,
          role: 'ADMIN',
          familyId: family.id,
        },
      });

      return { user, family };
    });

    const accessToken = generateAccessToken(result.user);
    const refreshToken = generateRefreshToken(result.user);

    res.status(201).json({
      user: {
        id: result.user.id,
        email: result.user.email,
        name: result.user.name,
        role: result.user.role,
        familyId: result.user.familyId,
      },
      family: familyForClient(result.family, 'ADMIN'),
      accessToken,
      refreshToken,
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return res.status(400).json({ error: 'Email già registrata' });
    }
    console.error('Register error:', error);
    res.status(500).json({ error: 'Errore durante la registrazione' });
  }
});

// Unisciti a una famiglia esistente (stesso familyId = dati condivisi). Il nome famiglia da solo non basta.
router.post('/join', async (req, res) => {
  try {
    const { inviteCode: rawCode, email: rawEmail, password, name } = req.body;
    const inviteCode = normalizeInviteCode(rawCode);
    const email = normalizeEmail(rawEmail);
    const nameTrim = String(name ?? '').trim();

    if (!inviteCode || !email || !password || !nameTrim) {
      return res.status(400).json({ error: 'Codice invito, nome, email e password sono obbligatori' });
    }

    if (inviteCode.length < 6) {
      return res.status(400).json({ error: 'Codice invito non valido' });
    }

    const family = await prisma.family.findUnique({ where: { inviteCode } });
    if (!family) {
      return res.status(404).json({ error: 'Codice invito non trovato. Chiedi il codice all’amministratore della casa.' });
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({
        error:
          'Email già registrata. Se ti sei registrata da sola con “Registrati”, hai creato un’altra casa: usa un’altra email qui oppure chiedi all’admin di aggiungerti da Famiglia.',
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name: nameTrim,
        role: 'MEMBER',
        familyId: family.id,
      },
    });

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    res.status(201).json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        familyId: user.familyId,
      },
      family: familyForClient(family, user.role),
      accessToken,
      refreshToken,
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return res.status(400).json({ error: 'Email già registrata' });
    }
    console.error('Join family error:', error);
    res.status(500).json({ error: 'Errore durante l’iscrizione alla famiglia' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email: rawEmail, password } = req.body;
    const email = normalizeEmail(rawEmail);

    if (!email || !password) {
      return res.status(400).json({ error: 'Email e password obbligatori' });
    }

    const user = await prisma.user.findUnique({
      where: { email },
      include: { family: true },
    });

    if (!user) {
      return res.status(401).json({ error: 'Credenziali non valide' });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Credenziali non valide' });
    }

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        familyId: user.familyId,
      },
      family: familyForClient(user.family, user.role),
      accessToken,
      refreshToken,
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Errore durante il login' });
  }
});

// Membri della stessa famiglia (nessuna password; tutti gli utenti autenticati)
router.get('/members', authenticateToken, async (req, res) => {
  try {
    const members = await prisma.user.findMany({
      where: { familyId: req.user.familyId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
      },
      orderBy: [{ role: 'asc' }, { name: 'asc' }],
    });
    res.json(members);
  } catch (error) {
    console.error('Members list error:', error);
    res.status(500).json({ error: 'Errore nel recupero dei membri' });
  }
});

// Profilo utente corrente (Bearer access token)
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: { family: true },
    });

    if (!user) {
      return res.status(404).json({ error: 'Utente non trovato' });
    }

    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        familyId: user.familyId,
      },
      family: familyForClient(user.family, user.role),
    });
  } catch (error) {
    console.error('Me error:', error);
    res.status(500).json({ error: 'Errore nel recupero del profilo' });
  }
});

// Refresh token
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(401).json({ error: 'Refresh token mancante' });
    }

    const payload = verifyRefreshToken(refreshToken);
    if (!payload) {
      return res.status(403).json({ error: 'Refresh token non valido' });
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.id },
    });

    if (!user) {
      return res.status(403).json({ error: 'Utente non trovato' });
    }

    const newAccessToken = generateAccessToken(user);
    const newRefreshToken = generateRefreshToken(user);

    res.json({
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    });
  } catch (error) {
    console.error('Refresh error:', error);
    res.status(500).json({ error: 'Errore durante il refresh' });
  }
});

// Rinomina famiglia (solo admin)
router.patch('/family', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const nameTrim = String(req.body?.name ?? '').trim();
    if (!nameTrim) {
      return res.status(400).json({ error: 'Nome famiglia obbligatorio' });
    }

    const family = await prisma.family.update({
      where: { id: req.user.familyId },
      data: { name: nameTrim },
    });

    res.json({ family: familyForClient(family, 'ADMIN') });
  } catch (error) {
    console.error('Update family error:', error);
    res.status(500).json({ error: 'Errore durante l\'aggiornamento della famiglia' });
  }
});

// Aggiungi membro alla famiglia (solo admin della propria famiglia)
router.post('/add-member', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { email: rawEmail, password, name, role = 'MEMBER' } = req.body;
    const email = normalizeEmail(rawEmail);
    const nameTrim = String(name ?? '').trim();
    const familyId = req.user.familyId;

    if (!email || !password || !nameTrim) {
      return res.status(400).json({ error: 'Email, password e nome sono obbligatori' });
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: 'Email già registrata' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name: nameTrim,
        role,
        familyId,
      },
    });

    res.status(201).json({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      familyId: user.familyId,
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return res.status(400).json({ error: 'Email già registrata' });
    }
    console.error('Add member error:', error);
    res.status(500).json({ error: 'Errore durante l\'aggiunta del membro' });
  }
});

export default router;
