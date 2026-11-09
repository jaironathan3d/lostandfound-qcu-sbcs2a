import { Router } from 'express';
import { UserRole, Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { OAuth2Client } from 'google-auth-library';
import jwt, { type JwtPayload } from 'jsonwebtoken';
import { env } from '../../config/env';
import { prisma } from '../../lib/prisma';

export const authRouter = Router();

const googleClient = new OAuth2Client();
const passwordRounds = 12;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const toClientRole = (role: UserRole): string => role.toLowerCase();

const issueSession = (user: { id: string; email: string; fullName: string; role: UserRole }) => {
  const token = jwt.sign({}, env.JWT_SECRET, { subject: user.id, expiresIn: '7d' });

  return {
    token,
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: toClientRole(user.role),
    },
  };
};

const isUniqueConstraintError = (error: unknown): boolean =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';

const requireJwtSecret = (res: import('express').Response): boolean => {
  if (env.JWT_SECRET.length < 32) {
    res.status(503).json({ message: 'Authentication is not configured on the server.' });
    return false;
  }

  return true;
};

authRouter.post('/register', async (req, res) => {
  if (!requireJwtSecret(res)) return;
  if (!isRecord(req.body)) {
    res.status(400).json({ message: 'Please provide your name, email, and password.' });
    return;
  }

  const { email, password, fullName } = req.body;
  if (
    typeof email !== 'string' ||
    typeof password !== 'string' ||
    typeof fullName !== 'string' ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ||
    password.length < 8 ||
    password.length > 72 ||
    fullName.trim().length < 2 ||
    fullName.trim().length > 100
  ) {
    res.status(400).json({
      message: 'Enter a valid name and email. Your password must be between 8 and 72 characters.',
    });
    return;
  }

  const normalizedEmail = email.trim().toLowerCase();
  const existingUser = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (existingUser) {
    res.status(409).json({ message: 'An account with that email already exists. Please log in.' });
    return;
  }

  const passwordHash = await bcrypt.hash(password, passwordRounds);
  try {
    const user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        passwordHash,
        fullName: fullName.trim(),
        role: UserRole.STUDENT,
      },
    });
    res.status(201).json(issueSession(user));
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      res.status(409).json({ message: 'An account with that email already exists. Please log in.' });
      return;
    }
    throw error;
  }
});

authRouter.post('/login', async (req, res) => {
  if (!requireJwtSecret(res)) return;
  if (!isRecord(req.body)) {
    res.status(400).json({ message: 'Enter your email and password.' });
    return;
  }

  const { email, password } = req.body;
  if (typeof email !== 'string' || typeof password !== 'string') {
    res.status(400).json({ message: 'Enter your email and password.' });
    return;
  }

  const user = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
  if (!user?.passwordHash || !(await bcrypt.compare(password, user.passwordHash))) {
    res.status(401).json({ message: 'The email or password is incorrect.' });
    return;
  }

  res.json(issueSession(user));
});

authRouter.post('/google', async (req, res) => {
  if (!requireJwtSecret(res)) return;
  if (!env.GOOGLE_CLIENT_ID) {
    res.status(503).json({ message: 'Google sign-in is not configured on the server.' });
    return;
  }
  if (!isRecord(req.body) || typeof req.body.credential !== 'string') {
    res.status(400).json({ message: 'A Google sign-in credential is required.' });
    return;
  }

  let ticket;
  try {
    ticket = await googleClient.verifyIdToken({
      idToken: req.body.credential,
      audience: env.GOOGLE_CLIENT_ID,
    });
  } catch {
    res.status(401).json({ message: 'Google could not verify this sign-in. Please try again.' });
    return;
  }

  const payload = ticket.getPayload();
  if (!payload?.email || !payload.email_verified || !payload.sub || !payload.name) {
    res.status(401).json({ message: 'Use a Google account with a verified email address.' });
    return;
  }

  const email = payload.email.trim().toLowerCase();
  const existingGoogleUser = await prisma.user.findUnique({ where: { googleId: payload.sub } });
  const existingEmailUser = existingGoogleUser
    ? null
    : await prisma.user.findUnique({ where: { email } });

  try {
    const user = existingGoogleUser
      ?? (existingEmailUser
        ? await prisma.user.update({
          where: { id: existingEmailUser.id },
          data: { googleId: payload.sub },
        })
        : await prisma.user.create({
          data: {
            email,
            googleId: payload.sub,
            fullName: payload.name,
            role: UserRole.STUDENT,
          },
        }));

    res.json(issueSession(user));
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      res.status(409).json({ message: 'This Google account is already linked to another user.' });
      return;
    }
    throw error;
  }
});

authRouter.get('/me', async (req, res) => {
  if (!requireJwtSecret(res)) return;
  const authorization = req.header('authorization');
  const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : '';
  if (!token) {
    res.status(401).json({ message: 'Please log in to continue.' });
    return;
  }

  let payload: JwtPayload;
  try {
    const verified = jwt.verify(token, env.JWT_SECRET);
    if (typeof verified === 'string' || !verified.sub) {
      res.status(401).json({ message: 'Your session is invalid. Please log in again.' });
      return;
    }
    payload = verified;
  } catch {
    res.status(401).json({ message: 'Your session has expired. Please log in again.' });
    return;
  }

  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user) {
    res.status(401).json({ message: 'Your account could not be found. Please log in again.' });
    return;
  }

  res.json({
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    role: toClientRole(user.role),
  });
});
