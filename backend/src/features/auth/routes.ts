import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import { UserRole } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { env } from '../../config/env';
import { requireAuth, AuthRequest } from '../../middlewares/requireAuth';

export const authRouter = Router();

function makeToken(userId: string) {
  return jwt.sign({ userId }, env.JWT_SECRET, { expiresIn: '7d' });
}

// ---------- SIGNUP ----------
authRouter.post('/signup', async (req, res) => {
  const { password, fullName } = req.body;
  const email = String(req.body.email ?? '').trim().toLowerCase();

  if (!email || !fullName || !password || password.length < 8) {
    res.status(400).json({ error: 'Email, full name, and a password of 8+ characters are required' });
    return;
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    res.status(409).json({ error: 'Email already registered' });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { email, fullName, passwordHash, role: UserRole.STUDENT },
  });

  res.status(201).json({
    token: makeToken(user.id),
    user: { id: user.id, email: user.email, fullName: user.fullName, role: user.role },
  });
});

// ---------- LOGIN ----------
authRouter.post('/login', async (req, res) => {
  const { password } = req.body;
  const email = String(req.body.email ?? '').trim().toLowerCase();

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.passwordHash || !password) {
    res.status(401).json({ error: 'Invalid email or password' });
    return;
  }

  const matches = await bcrypt.compare(password, user.passwordHash);
  if (!matches) {
    res.status(401).json({ error: 'Invalid email or password' });
    return;
  }

  res.json({
    token: makeToken(user.id),
    user: { id: user.id, email: user.email, fullName: user.fullName, role: user.role },
  });
});

// ---------- WHO AM I (protected) ----------
authRouter.get('/me', requireAuth, async (req: AuthRequest, res) => {
  if (!req.userId) {
    res.status(401).json({ error: 'Not logged in' });
    return;
  }

  const user = await prisma.user.findUnique({
    where: { id: req.userId },
    select: { id: true, email: true, fullName: true, role: true },
  });

  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  res.json(user);
});

// GOOGLE SIGN-IN 
authRouter.post('/google', async (req, res) => {
  const { idToken } = req.body;

  if (!idToken) {
    res.status(400).json({ error: 'idToken is required' });
    return;
  }

  try {
    const googleClient = new OAuth2Client(env.GOOGLE_CLIENT_ID);
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();

    if (!payload || !payload.email || !payload.email_verified) {
      res.status(401).json({ error: 'Google account could not be verified' });
      return;
    }

    const email = payload.email.toLowerCase();
    let user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      user = await prisma.user.create({
        data: {
          email,
          fullName: payload.name ?? email,
          googleId: payload.sub,
          role: UserRole.STUDENT,
        },
      });
    } else if (!user.googleId) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { googleId: payload.sub },
      });
    }

    res.json({
      token: makeToken(user.id),
      user: { id: user.id, email: user.email, fullName: user.fullName, role: user.role },
    });
  } catch {
    res.status(401).json({ error: 'Invalid Google token' });
  }
});