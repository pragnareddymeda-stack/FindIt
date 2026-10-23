import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { validateQuery } from '../middleware/validate.js';
import { notificationListQuerySchema } from '../validators/messaging.js';
import { listNotifications, markRead, markAllRead } from '../controllers/notifications.controller.js';

const router = Router();
router.use(authenticate);

router.get('/', validateQuery(notificationListQuerySchema), listNotifications);
router.patch('/read-all', markAllRead); // keep above /:id/read
router.patch('/:id/read', markRead);

export default router;
