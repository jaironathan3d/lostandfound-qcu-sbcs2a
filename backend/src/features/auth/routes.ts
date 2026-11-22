import bcrypt from 'bcryptjs';
import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { env } from '../../config/env';
import { prisma } from '../../lib/prisma';
import { requireAuth } from '../../middlewares/requireAuth';

export const authRouter = Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  fullName: z.string().min(1),
  role: z.enum(['STUDENT', 'PROFESSOR', 'STAFF']),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const signToken = (id: string, role: string): string => {
  if (!env.JWT_SECRET) {
    throw new Error('JWT_SECRET is not set in backend/.env');
  }
  return jwt.sign({ sub: id, role }, env.JWT_SECRET, { expiresIn: '7d' });
};

authRouter.post('/register', async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: 'Invalid data', issues: parsed.error.issues });
    return;
  }

  const { email, password, fullName, role } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    res.status(409).json({ message: 'Email is already registered' });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { email, passwordHash, fullName, role },
    select: { id: true, email: true, fullName: true, role: true },
  });

  res.status(201).json({ token: signToken(user.id, user.role), user });
});

authRouter.post('/login', async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: 'Invalid data', issues: parsed.error.issues });
    return;
  }

  const { email, password } = parsed.data;

  const user = await prisma.user.findUnique({ where: { email } });
  const passwordOk = user ? await bcrypt.compare(password, user.passwordHash) : false;

  if (!user || !passwordOk) {
    res.status(401).json({ message: 'Wrong email or password' });
    return;
  }

  res.json({
    token: signToken(user.id, user.role),
    user: { id: user.id, email: user.email, fullName: user.fullName, role: user.role },
  });
});

authRouter.get('/me', requireAuth, async (_req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: res.locals.user.id },
    select: { id: true, email: true, fullName: true, role: true },
  });

  if (!user) {
    res.status(404).json({ message: 'User not found' });
    return;
  }

  res.json({ user });
});