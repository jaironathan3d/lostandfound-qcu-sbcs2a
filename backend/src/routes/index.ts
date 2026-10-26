import { Router } from 'express';
import { authRouter } from '../features/auth/routes';
import { usersRouter } from '../features/users/routes';
import { itemsRouter } from '../features/items/routes';
import { claimsRouter } from '../features/claims/routes';
import { threadsRouter } from '../features/threads/routes';
import { notificationsRouter } from '../features/notifications/routes';
import { vaultRouter } from '../features/vault/routes';
import { adminRouter } from '../features/admin/routes';
import { studentRecordsRouter } from '../features/studentRecords/routes';
import { healthRouter } from './health';

export const apiRouter = Router();

apiRouter.use('/health', healthRouter);
apiRouter.use('/auth', authRouter);
apiRouter.use('/users', usersRouter);
apiRouter.use('/items', itemsRouter);
apiRouter.use('/claims', claimsRouter);
apiRouter.use('/threads', threadsRouter);
apiRouter.use('/notifications', notificationsRouter);
apiRouter.use('/vault', vaultRouter);
apiRouter.use('/admin', adminRouter);
apiRouter.use('/student-records', studentRecordsRouter);
