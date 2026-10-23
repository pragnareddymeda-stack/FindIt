import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth.js';
import { validate, validateQuery } from '../middleware/validate.js';
import * as v from '../validators/admin.js';
import * as c from '../controllers/admin.controller.js';

const router = Router();

// Every admin route requires a signed-in ADMIN. The check lives on the router so a new route cannot forget it.
router.use(authenticate, requireRole('ADMIN'));

router.get('/dashboard', c.dashboard);
router.get('/users', validateQuery(v.adminUsersQuery), c.listUsers);
router.patch('/users/:id/status', validate(v.userStatusSchema), c.setUserStatus);
router.get('/reports', validateQuery(v.adminReportsQuery), c.listReports);
router.patch('/reports/:id/moderation', validate(v.moderationSchema), c.moderateReport);
router.get('/abuse-reports', validateQuery(v.abuseListQuery), c.listAbuseReports);
router.patch('/abuse-reports/:id', validate(v.abuseDecisionSchema), c.decideAbuseReport);
router.get('/disputes', validateQuery(v.disputesQuery), c.listDisputes);
router.patch('/disputes/:id/resolution', validate(v.disputeResolutionSchema), c.resolveDispute);
router.get('/audit-logs', validateQuery(v.auditQuery), c.listAuditLogs);

export default router;
