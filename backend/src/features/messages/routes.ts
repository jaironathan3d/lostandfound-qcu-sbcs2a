import { Router } from 'express';
import { ItemReviewStatus, ItemStatus } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { requireAuth } from '../../middlewares/requireAuth';

export const messagesRouter = Router();

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isText = (value: unknown, minLength: number, maxLength: number): value is string =>
  typeof value === 'string' && value.trim().length >= minLength && value.trim().length <= maxLength;

messagesRouter.get('/', requireAuth, async (req, res) => {
  if (!req.authUserId) {
    res.status(401).json({ message: 'Please log in to continue.' });
    return;
  }
  const conversations = await prisma.conversation.findMany({
    where: {
      OR: [{ posterId: req.authUserId }, { participantId: req.authUserId }],
    },
    include: {
      item: { select: { id: true, title: true } },
      poster: { select: { id: true, fullName: true } },
      participant: { select: { id: true, fullName: true } },
      messages: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { content: true, senderId: true, createdAt: true },
      },
    },
    orderBy: { updatedAt: 'desc' },
  });
  res.json(conversations.map((conversation) => {
    const other = conversation.posterId === req.authUserId
      ? conversation.participant
      : conversation.poster;
    const lastMessage = conversation.messages[0];
    return {
      id: conversation.id,
      itemId: conversation.item.id,
      itemTitle: conversation.item.title,
      otherParticipantName: other.fullName,
      lastMessage: lastMessage
        ? {
          content: lastMessage.content,
          senderId: lastMessage.senderId,
          createdAt: lastMessage.createdAt.toISOString(),
        }
        : null,
      updatedAt: conversation.updatedAt.toISOString(),
    };
  }));
});

messagesRouter.post('/', requireAuth, async (req, res) => {
  if (!req.authUserId) {
    res.status(401).json({ message: 'Please log in to continue.' });
    return;
  }
  if (!isRecord(req.body) || !isText(req.body.itemId, 1, 100) || !isText(req.body.content, 1, 2000)) {
    res.status(400).json({ message: 'Choose an item and enter a message.' });
    return;
  }

  const item = await prisma.item.findFirst({
    where: {
      id: req.body.itemId.trim(),
      reviewStatus: ItemReviewStatus.APPROVED,
      status: ItemStatus.REPORTED,
    },
    select: { id: true, reporterId: true },
  });
  if (!item) {
    res.status(404).json({ message: 'That item is not available for messaging.' });
    return;
  }
  if (item.reporterId === req.authUserId) {
    res.status(400).json({ message: 'You cannot message yourself. Reply to incoming messages from your inbox.' });
    return;
  }

  const conversation = await prisma.$transaction(async (transaction) => {
    const existing = await transaction.conversation.upsert({
      where: { itemId_participantId: { itemId: item.id, participantId: req.authUserId! } },
      create: {
        itemId: item.id,
        posterId: item.reporterId,
        participantId: req.authUserId!,
      },
      update: { updatedAt: new Date() },
      select: { id: true },
    });
    await transaction.privateMessage.create({
      data: {
        conversationId: existing.id,
        senderId: req.authUserId!,
        content: req.body.content.trim(),
      },
    });
    await transaction.conversation.update({
      where: { id: existing.id },
      data: { updatedAt: new Date() },
    });
    return existing;
  });
  res.status(201).json({ id: conversation.id });
});

messagesRouter.get('/:conversationId', requireAuth, async (req, res) => {
  if (!req.authUserId) {
    res.status(401).json({ message: 'Please log in to continue.' });
    return;
  }
  const conversationId = req.params.conversationId;
  if (typeof conversationId !== 'string') {
    res.status(400).json({ message: 'A valid conversation ID is required.' });
    return;
  }
  const conversation = await prisma.conversation.findFirst({
    where: {
      id: conversationId,
      OR: [{ posterId: req.authUserId }, { participantId: req.authUserId }],
    },
    include: {
      item: { select: { title: true } },
    },
  });
  if (!conversation) {
    res.status(404).json({ message: 'That conversation could not be found.' });
    return;
  }

  await prisma.privateMessage.updateMany({
    where: {
      conversationId,
      senderId: { not: req.authUserId },
      readAt: null,
    },
    data: { readAt: new Date() },
  });
  const messages = await prisma.privateMessage.findMany({
    where: { conversationId },
    include: { sender: { select: { id: true, fullName: true } } },
    orderBy: { createdAt: 'asc' },
  });
  res.json({
    id: conversation.id,
    itemTitle: conversation.item.title,
    messages: messages.map((message) => ({
      id: message.id,
      senderId: message.sender.id,
      senderName: message.sender.fullName,
      content: message.content,
      createdAt: message.createdAt.toISOString(),
      readAt: message.readAt?.toISOString() ?? null,
    })),
  });
});

messagesRouter.post('/:conversationId/messages', requireAuth, async (req, res) => {
  if (!req.authUserId) {
    res.status(401).json({ message: 'Please log in to continue.' });
    return;
  }
  const conversationId = req.params.conversationId;
  if (typeof conversationId !== 'string') {
    res.status(400).json({ message: 'A valid conversation ID is required.' });
    return;
  }
  if (!isRecord(req.body) || !isText(req.body.content, 1, 2000)) {
    res.status(400).json({ message: 'Enter a message before sending.' });
    return;
  }

  const conversation = await prisma.conversation.findFirst({
    where: {
      id: conversationId,
      OR: [{ posterId: req.authUserId }, { participantId: req.authUserId }],
    },
    select: { id: true },
  });
  if (!conversation) {
    res.status(404).json({ message: 'That conversation could not be found.' });
    return;
  }

  const message = await prisma.$transaction(async (transaction) => {
    const created = await transaction.privateMessage.create({
      data: {
        conversationId,
        senderId: req.authUserId!,
        content: req.body.content.trim(),
      },
      select: { id: true, createdAt: true },
    });
    await transaction.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });
    return created;
  });
  res.status(201).json({ id: message.id, createdAt: message.createdAt.toISOString() });
});
