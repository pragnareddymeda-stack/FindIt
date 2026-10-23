import { Router } from 'express';
import { getMe, updateMe } from '../controllers/users.controller.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { updateProfileSchema } from '../validators/auth.js';

const router = Router();
router.use(authenticate);
router.get('/me', getMe);
router.patch('/me', validate(updateProfileSchema), updateMe);

export default router;
