import AuditLog from '../models/AuditLog.js';
import { config } from '../config/env.js';

/**
 * Records an administrative action. Awaited by the caller: if the log cannot be written the request fails loudly
 * rather than letting an administrator act without a trace. (MongoDB transactions are not assumed, so the action
 * itself may already have been applied.)
 */
export function audit(actor, action, { targetType, targetId, summary, ip = '' }) {
  return AuditLog.create({ actor: actor._id, action, targetType, targetId, summary: String(summary).slice(0, 300), ip });
}

/** For lower-stakes records (read access) where a logging failure should not block the person's request. */
export async function auditSafe(...args) {
  try {
    return await audit(...args);
  } catch (err) {
    if (config.nodeEnv !== 'test') console.error('Could not write audit log:', err.message);
    return null;
  }
}
