import { Router } from 'express';
import { prisma } from '../../lib/prisma';
import { requireAuth } from '../../middlewares/requireAuth';

export const threadsRouter = Router();

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isText = (value: unknown, minLength: number, maxLength: number): value is string =>
  typeof value === 'string' && value.trim().length >= minLength && value.trim().length <= maxLength;

const publicName = (fullName: string): string => {
  const parts = fullName.trim().split(/\s+/);
  return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1][0]}.` : parts[0];
};

threadsRouter.get('/following', requireAuth, async (req, res) => {
  if (!req.authUserId) {
    res.status(401).json({ message: 'Please log in to continue.' });
    return;
  }
  const follows = await prisma.threadFollow.findMany({
    where: { userId: req.authUserId },
    select: { threadId: true },
  });
  res.json(follows.map((follow) => follow.threadId));
});

threadsRouter.get('/', async (_req, res) => {
  const threads = await prisma.communityThread.findMany({
    include: {
      author: { select: { id: true, fullName: true } },
      replies: {
        include: { author: { select: { fullName: true } } },
        orderBy: { createdAt: 'asc' },
      },
      _count: { select: { replies: true, followers: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json(threads.map((thread) => ({
    id: thread.id,
    title: thread.title,
    excerpt: thread.body,
    authorId: thread.author.id,
    author: publicName(thread.author.fullName),
    createdAt: thread.createdAt.toISOString(),
    replies: thread.replies.map((reply) => ({
      id: reply.id,
      author: publicName(reply.author.fullName),
      content: reply.content,
      createdAt: reply.createdAt.toISOString(),
    })),
    replyCount: thread._count.replies,
    followerCount: thread._count.followers,
  })));
});

threadsRouter.post('/', requireAuth, async (req, res) => {
  if (!req.authUserId) {
    res.status(401).json({ message: 'Please log in to continue.' });
    return;
  }
  if (!isRecord(req.body) || !isText(req.body.title, 1, 100) || !isText(req.body.body, 4, 1000)) {
    res.status(400).json({ message: 'Add a title and message to start a thread.' });
    return;
  }

  const thread = await prisma.communityThread.create({
    data: {
      title: req.body.title.trim(),
      body: req.body.body.trim(),
      authorId: req.authUserId,
    },
    select: { id: true, createdAt: true },
  });
  res.status(201).json({ id: thread.id, createdAt: thread.createdAt.toISOString() });
});

threadsRouter.post('/:threadId/replies', requireAuth, async (req, res) => {
  if (!req.authUserId) {
    res.status(401).json({ message: 'Please log in to continue.' });
    return;
  }
  if (!isRecord(req.body) || !isText(req.body.content, 1, 500)) {
    res.status(400).json({ message: 'Enter a reply before posting.' });
    return;
  }
  const threadId = req.params.threadId;
  if (typeof threadId !== 'string') {
    res.status(400).json({ message: 'A valid thread ID is required.' });
    return;
  }
  const thread = await prisma.communityThread.findUnique({ where: { id: threadId }, select: { id: true } });
  if (!thread) {
    res.status(404).json({ message: 'That thread could not be found.' });
    return;
  }

  const reply = await prisma.communityThreadReply.create({
    data: { threadId, authorId: req.authUserId, content: req.body.content.trim() },
    select: { id: true, createdAt: true },
  });
  res.status(201).json({ id: reply.id, createdAt: reply.createdAt.toISOString() });
});

threadsRouter.post('/:threadId/follow', requireAuth, async (req, res) => {
  if (!req.authUserId) {
    res.status(401).json({ message: 'Please log in to continue.' });
    return;
  }
  const threadId = req.params.threadId;
  if (typeof threadId !== 'string') {
    res.status(400).json({ message: 'A valid thread ID is required.' });
    return;
  }
  const thread = await prisma.communityThread.findUnique({ where: { id: threadId }, select: { id: true } });
  if (!thread) {
    res.status(404).json({ message: 'That thread could not be found.' });
    return;
  }
  await prisma.threadFollow.upsert({
    where: { threadId_userId: { threadId, userId: req.authUserId } },
    create: { threadId, userId: req.authUserId },
    update: {},
  });
  res.status(204).end();
});

threadsRouter.delete('/:threadId/follow', requireAuth, async (req, res) => {
  if (!req.authUserId) {
    res.status(401).json({ message: 'Please log in to continue.' });
    return;
  }
  const threadId = req.params.threadId;
  if (typeof threadId !== 'string') {
    res.status(400).json({ message: 'A valid thread ID is required.' });
    return;
  }
  await prisma.threadFollow.deleteMany({
    where: { threadId, userId: req.authUserId },
  });
  res.status(204).end();
});
