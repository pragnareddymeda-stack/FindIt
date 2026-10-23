import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { validate, validateQuery } from '../middleware/validate.js';
import { handoverStatusSchema, handoverListQuerySchema } from '../validators/handovers.js';
import { listMyHandovers, getHandover, updateHandoverStatus } from '../controllers/handovers.controller.js';

const router = Router();
router.use(authenticate);

router.get('/me', validateQuery(handoverListQuerySchema), listMyHandovers); // keep above /:id
router.get('/:id', getHandover);
router.patch('/:id/status', validate(handoverStatusSchema), updateHandoverStatus);

export default router;
