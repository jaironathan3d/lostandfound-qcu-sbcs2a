import { Router } from 'express';
import { UserRole, Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt, { type JwtPayload } from 'jsonwebtoken';
import { createHash, randomBytes } from 'node:crypto';
import { env } from '../../config/env';
import { prisma } from '../../lib/prisma';

export const authRouter = Router();

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

  const { email, password, confirmPassword, fullName, studentNumber, course, yearLevel, acceptedTerms, acceptedPrivacy } = req.body;
  const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
  const normalizedStudentNumber = typeof studentNumber === 'string' ? studentNumber.trim() : '';
  if (
    typeof password !== 'string'
    || typeof confirmPassword !== 'string'
    || password !== confirmPassword
    || typeof fullName !== 'string'
    || typeof course !== 'string'
    || typeof yearLevel !== 'string'
    || acceptedTerms !== true
    || acceptedPrivacy !== true
    || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)
    || !/^\d{2}-\d{4}$/.test(normalizedStudentNumber)
    || password.length < 8
    || password.length > 72
    || fullName.trim().length < 2
    || fullName.trim().length > 100
  ) {
    res.status(400).json({
      message: 'Enter valid details, use a Student ID in ##-#### format, confirm the password, and accept Terms and Privacy.',
    });
    return;
  }

  const [existingUser, existingRecord] = await Promise.all([
    prisma.user.findUnique({ where: { email: normalizedEmail } }),
    prisma.studentRecord.findUnique({ where: { studentNumber: normalizedStudentNumber } }),
  ]);
  if (existingUser) {
    res.status(409).json({ message: 'An account with that email already exists. Please log in.' });
    return;
  }
  if (existingRecord) {
    res.status(409).json({ message: 'A student account already uses that Student ID.' });
    return;
  }

  const passwordHash = await bcrypt.hash(password, passwordRounds);
  const acceptedAt = new Date();
  try {
    const user = await prisma.$transaction(async (transaction) => {
      const created = await transaction.user.create({
        data: {
          email: normalizedEmail,
          passwordHash,
          fullName: fullName.trim(),
          role: UserRole.STUDENT,
          termsAcceptedAt: acceptedAt,
          termsVersion: 'pilot-v1',
          privacyAcceptedAt: acceptedAt,
          privacyVersion: 'pilot-v1',
        },
      });
      await transaction.studentRecord.create({
        data: {
          studentNumber: normalizedStudentNumber,
          fullName: fullName.trim(),
          course: course.trim(),
          yearLevel: yearLevel.trim(),
          universityEmail: normalizedEmail,
          isActive: true,
          userId: created.id,
        },
      });
      return created;
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

authRouter.post('/forgot-password', async (req, res) => {
  if (!isRecord(req.body) || typeof req.body.email !== 'string') {
    res.status(200).json({ message: 'If that email is registered, password recovery instructions will be prepared.' });
    return;
  }
  const email = req.body.email.trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { email } });
  if (user) {
    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    await prisma.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    });
    await prisma.passwordResetToken.create({
      data: {
        tokenHash,
        userId: user.id,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      },
    });
  }
  res.status(200).json({ message: 'If that email is registered, password recovery instructions will be prepared.' });
});

authRouter.post('/reset-password', async (req, res) => {
  if (
    !isRecord(req.body)
    || typeof req.body.token !== 'string'
    || typeof req.body.password !== 'string'
    || typeof req.body.confirmPassword !== 'string'
  ) {
    res.status(400).json({ message: 'Enter the reset token and both password fields.' });
    return;
  }
  if (req.body.password !== req.body.confirmPassword) {
    res.status(400).json({ message: 'Password and confirm password must match.' });
    return;
  }
  if (req.body.password.length < 8 || req.body.password.length > 72) {
    res.status(400).json({ message: 'Your password must be between 8 and 72 characters.' });
    return;
  }
  const tokenHash = createHash('sha256').update(req.body.token).digest('hex');
  const resetToken = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
  });
  if (!resetToken || resetToken.usedAt || resetToken.expiresAt <= new Date()) {
    res.status(400).json({ message: 'This password reset link is invalid or has expired.' });
    return;
  }
  const passwordHash = await bcrypt.hash(req.body.password, passwordRounds);
  await prisma.$transaction([
    prisma.user.update({
      where: { id: resetToken.userId },
      data: { passwordHash },
    }),
    prisma.passwordResetToken.update({
      where: { id: resetToken.id },
      data: { usedAt: new Date() },
    }),
    prisma.passwordResetToken.updateMany({
      where: { userId: resetToken.userId, usedAt: null },
      data: { usedAt: new Date() },
    }),
  ]);
  res.json({ message: 'Password updated successfully. You can now log in.' });
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
