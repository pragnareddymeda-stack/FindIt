import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { validate, validateQuery } from '../middleware/validate.js';
import { decisionSchema, claimListQuerySchema } from '../validators/claims.js';
import { getClaimConversation } from '../controllers/conversations.controller.js';
import { createHandover } from '../controllers/handovers.controller.js';
import { listMyClaims, listIncomingClaims, getClaim, decideClaim, withdrawClaim } from '../controllers/claims.controller.js';

const router = Router();
router.use(authenticate);

router.get('/me', validateQuery(claimListQuerySchema), listMyClaims); // keep /me and /incoming above /:id
router.get('/incoming', validateQuery(claimListQuerySchema), listIncomingClaims);
router.get('/:id', getClaim);
router.patch('/:id/decision', validate(decisionSchema), decideClaim);
router.patch('/:id/withdraw', withdrawClaim);
router.post('/:id/handover', createHandover);
router.get('/:id/conversation', getClaimConversation);

export default router;
