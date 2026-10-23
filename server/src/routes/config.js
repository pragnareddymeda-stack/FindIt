import { Router } from 'express';
import { getPublicConfig } from '../controllers/images.controller.js';

const router = Router();
router.get('/', getPublicConfig); // lets the client know whether photo upload is available

export default router;
