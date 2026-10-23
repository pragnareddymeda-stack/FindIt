import { Router } from 'express';
import health from './health.js';
import { createAuthRouter } from './auth.js';
import users from './users.js';
import items from './items.js';
import claims from './claims.js';
import handovers from './handovers.js';
import { createConversationsRouter } from './conversations.js';
import notifications from './notifications.js';
import admin from './admin.js';
import configRoute from './config.js';

export function createRoutes(options) {
  const router = Router();
  router.use('/health', health);
  router.use('/auth', createAuthRouter(options));
  router.use('/users', users);
  router.use('/items', items);
  router.use('/claims', claims);
  router.use('/handovers', handovers);
  router.use('/conversations', createConversationsRouter(options));
  router.use('/notifications', notifications);
  router.use('/admin', admin);
  router.use('/config', configRoute);
  return router;
}
