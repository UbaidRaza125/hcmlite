import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { loadStore, saveStore } from './storage.js';

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (secret && secret.length >= 32) return secret;
  if (process.env.NODE_ENV === 'test') return 'test-only-secret-do-not-use-in-production-32chars';
  if (process.env.NODE_ENV !== 'production') return 'hcm-lite-development-secret-key-at-least-32-chars';
  throw new Error('JWT_SECRET must be configured with at least 32 characters.');
}

export async function hashPassword(plainText) {
  return await bcrypt.hash(plainText, 10);
}

export async function comparePassword(plainText, hash) {
  return await bcrypt.compare(plainText, hash);
}

export function signToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      companyId: user.companyId,
      employeeId: user.employeeId || null,
      temporaryPassword: !!user.temporaryPassword,
    },
    getJwtSecret(),
    { expiresIn: '24h' }
  );
}

export function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization || req.headers['x-access-token'];
  if (!authHeader) {
    return res.status(401).json({ error: 'Unauthorized: missing authentication token' });
  }

  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
  try {
    const decoded = jwt.verify(token, getJwtSecret());
    // A temporary password is a server-enforced restricted session, not just a UI flag.
    const changePasswordPath = req.path === '/auth/change-password';
    const logoutPath = req.path === '/auth/logout';
    if (decoded.temporaryPassword && !changePasswordPath && !logoutPath) {
      return res.status(403).json({ error: 'You must change your temporary password before using this service.', code: 'PASSWORD_CHANGE_REQUIRED' });
    }
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Unauthorized: invalid or expired session token' });
  }
}

export function requireRole(roles = []) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    if (roles.length > 0 && !roles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Forbidden: role '${req.user.role}' does not have permission to access this resource`,
      });
    }
    next();
  };
}

export function logAudit({ actor, action, entity, entityId, details, beforeJson = null, afterJson = null }) {
  const store = loadStore();
  const entry = {
    id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    companyId: actor?.companyId || 'company_1',
    actorId: actor?.id || 'system',
    actorName: actor?.name || 'System',
    actorRole: actor?.role || 'system',
    action,
    entity,
    entityId: entityId || null,
    details: details || '',
    beforeJson: beforeJson ? JSON.parse(JSON.stringify(beforeJson)) : null,
    afterJson: afterJson ? JSON.parse(JSON.stringify(afterJson)) : null,
    timestamp: new Date().toISOString(),
  };

  // Audit history is append-only at the application layer; never trim older events.
  store.auditLogs.push(entry);
  saveStore(store);
  return entry;
}
