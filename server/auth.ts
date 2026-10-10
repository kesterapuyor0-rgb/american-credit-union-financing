import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { User } from './models.js';

function getJwtSecret(): string {
  const configuredSecret = process.env.JWT_SECRET?.trim();
  if (configuredSecret) return configuredSecret;
  if (process.env.NODE_ENV === 'production' || process.env.VERCEL === '1') {
    throw new Error('JWT_SECRET must be configured in production.');
  }
  return 'local-development-only-secret';
}

export interface TokenPayload {
  id: string;
  email: string;
  role: 'user' | 'admin';
  full_name: string;
  phone: string;
}

export interface Temp2FAPayload {
  id: string;
  email: string;
  purpose: 'login' | 'transfer';
  role: 'user' | 'admin';
  transferData?: any;
}

export function signAuthToken(payload: TokenPayload): string {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: '8h' });
}

export function signTemp2FAToken(payload: Temp2FAPayload): string {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: '10m' });
}

export function verifyAuthToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, getJwtSecret()) as TokenPayload;
  } catch (err) {
    return null;
  }
}

export function getAuthTokenFromRequest(req: Request): string | undefined {
  const authHeader = req.headers.authorization;
  const cookieToken = (req as Request & { cookies?: Record<string, string> }).cookies?.boa_token;
  if (authHeader) {
    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    if (match) return match[1].trim();
    if (authHeader.trim()) return authHeader.trim();
  }
  return cookieToken;
}

export function verifyTemp2FAToken(token: string): Temp2FAPayload | null {
  try {
    return jwt.verify(token, getJwtSecret()) as Temp2FAPayload;
  } catch (err) {
    return null;
  }
}

export function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export interface AuthenticatedRequest extends Request {
  user?: TokenPayload;
}

export function isAdminRole(role: unknown, isAdmin?: unknown): boolean {
  return isAdmin === true || String(role || '').toUpperCase() === 'ADMIN';
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  const cookieToken = req.cookies?.boa_token;
  let token: string | undefined = cookieToken;

  if (authHeader) {
    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    if (match) {
      token = match[1].trim();
    } else if (authHeader.trim()) {
      token = authHeader.trim();
    }
  }

  // Fallback to body or query token for restrictive proxy or iframe environments
  if (!token && req.body && typeof req.body.token === 'string') {
    token = req.body.token.trim();
  }
  if (!token && typeof req.query?.token === 'string') {
    token = (req.query.token as string).trim();
  }

  if (!token) {
    res.status(401).json({ error: 'Authentication required. Please sign in.' });
    return;
  }

  const decoded = verifyAuthToken(token);
  if (!decoded) {
    res.status(401).json({ error: 'Session expired or invalid. Please sign in again.' });
    return;
  }

  req.user = decoded;
  next();
}

export function requireApprovedUser(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  requireAuth(req, res, () => {
    void User.findOne({ id: req.user!.id })
      .select('role isAdmin verification_status verification_rejection_reason')
      .lean<any>()
      .then((user) => {
        if (!user) {
          res.status(401).json({ error: 'User profile not found. Please sign in again.' });
          return;
        }
        if (isAdminRole(user.role, user.isAdmin)) {
          next();
          return;
        }
        if (user.verification_status === 'under_review') {
          res.status(403).json({
            error: 'Your enrollment is under review by Member Services.',
            verificationStatus: 'under_review',
          });
          return;
        }
        if (user.verification_status === 'rejected') {
          res.status(403).json({
            error: 'Your enrollment was not approved.',
            verificationStatus: 'rejected',
            rejectionReason: user.verification_rejection_reason || '',
          });
          return;
        }
        next();
      })
      .catch((error: unknown) => {
        console.error('Unable to verify enrollment status:', error);
        res.status(503).json({ error: 'Unable to verify enrollment status right now.' });
      });
  });
}

export function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  requireAuth(req, res, () => {
    if (!req.user || !isAdminRole(req.user.role)) {
      res.status(403).json({ error: 'Forbidden: Member Services authorization required.' });
      return;
    }
    const userId = req.user.id;
    void User.findOne({ id: userId }).select('role isAdmin').lean<{ role?: string; isAdmin?: boolean }>()
      .then((user) => {
        if (!user || !isAdminRole(user.role, user.isAdmin)) {
          res.status(403).json({ error: 'Forbidden: Member Services authorization required.' });
          return;
        }
        next();
      })
      .catch((error: unknown) => {
        console.error('Unable to verify administrator role:', error);
        res.status(503).json({ error: 'Database service is temporarily unavailable.' });
      });
  });
}
