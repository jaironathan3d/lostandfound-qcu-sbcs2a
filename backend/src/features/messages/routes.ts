import { Router } from 'express';
import { ConversationReportReason, ItemReviewStatus, ItemStatus, Prisma, prisma } from '../../lib/prisma';
import { createNotification } from '../../lib/createNotification';
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
      status: { in: [ItemStatus.REPORTED, ItemStatus.IN_VAULT] },
    },
    select: { id: true, reporterId: true, title: true },
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
    await createNotification(
      transaction,
      item.reporterId,
      `New message about "${item.title}".`,
      `/messages?conversation=${existing.id}`,
    );
    return existing;
  });
  res.status(201).json({ id: conversation.id });
});

messagesRouter.post('/:conversationId/reports', requireAuth, async (req, res) => {
  if (!req.authUserId) {
    res.status(401).json({ message: 'Please log in to continue.' });
    return;
  }
  const conversationId = req.params.conversationId;
  if (
    typeof conversationId !== 'string'
    || !isRecord(req.body)
    || typeof req.body.reason !== 'string'
    || !Object.values(ConversationReportReason).includes(req.body.reason as ConversationReportReason)
    || (req.body.details !== undefined && (
      typeof req.body.details !== 'string'
      || req.body.details.trim().length > 1000
    ))
  ) {
    res.status(400).json({ message: 'Choose a report reason and enter no more than 1000 characters of optional detail.' });
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

  try {
    const report = await prisma.$transaction(async (transaction) => {
      const created = await transaction.conversationReport.create({
        data: {
          conversationId,
          reporterId: req.authUserId!,
          reason: req.body.reason as ConversationReportReason,
          details: typeof req.body.details === 'string' ? req.body.details.trim() : '',
        },
        select: { id: true, status: true, createdAt: true },
      });
      await createNotification(
        transaction,
        req.authUserId!,
        'Your conversation report was sent to administrators.',
        `/messages?conversation=${conversationId}`,
      );
      return created;
    });
    res.status(201).json({
      id: report.id,
      status: report.status,
      createdAt: report.createdAt.toISOString(),
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      res.status(409).json({ message: 'You have already reported this conversation.' });
      return;
    }
    throw error;
  }
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
    select: {
      id: true,
      posterId: true,
      participantId: true,
      item: { select: { title: true } },
    },
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
    const recipientId = conversation.posterId === req.authUserId
      ? conversation.participantId
      : conversation.posterId;
    await createNotification(
      transaction,
      recipientId,
      `New message about "${conversation.item.title}".`,
      `/messages?conversation=${conversationId}`,
    );
    return created;
  });
  res.status(201).json({ id: message.id, createdAt: message.createdAt.toISOString() });
});
