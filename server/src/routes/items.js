import { Router } from 'express';
import { authenticate, optionalAuth } from '../middleware/auth.js';
import { validate, validateQuery } from '../middleware/validate.js';
import { createItemSchema, updateItemSchema, listQuerySchema, mineQuerySchema } from '../validators/items.js';
import { imageUpload } from '../middleware/upload.js';
import { uploadItemImage, removeItemImage } from '../controllers/images.controller.js';
import { createClaim, listItemClaims } from '../controllers/claims.controller.js';
import { createAbuseReport } from '../controllers/abuse.controller.js';
import { createAbuseReportSchema } from '../validators/admin.js';
import { getMatches } from '../controllers/matches.controller.js';
import { createClaimSchema, claimListQuerySchema } from '../validators/claims.js';
import { listItems, listMyItems, getItem, createItem, updateItem, withdrawItem } from '../controllers/items.controller.js';

const router = Router();

router.get('/', optionalAuth, validateQuery(listQuerySchema), listItems);
router.get('/mine', authenticate, validateQuery(mineQuerySchema), listMyItems); // must stay above /:id
router.get('/:id', optionalAuth, getItem);
router.get('/:id/matches', authenticate, getMatches);
router.post('/:id/abuse', authenticate, validate(createAbuseReportSchema), createAbuseReport);
router.post('/:id/claims', authenticate, validate(createClaimSchema), createClaim);
router.get('/:id/claims', authenticate, validateQuery(claimListQuerySchema), listItemClaims);
router.post('/:id/image', authenticate, imageUpload, uploadItemImage); // authenticate first: no parsing of anonymous uploads
router.delete('/:id/image', authenticate, removeItemImage);
router.post('/', authenticate, validate(createItemSchema), createItem);
router.patch('/:id', authenticate, validate(updateItemSchema), updateItem);
router.delete('/:id', authenticate, withdrawItem);

export default router;
