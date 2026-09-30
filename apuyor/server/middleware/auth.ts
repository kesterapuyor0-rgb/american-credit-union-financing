import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';

export type AuthenticatedUser = { id: string; role: 'user' | 'admin' };
declare global {
  namespace Express {
    interface Request { user?: AuthenticatedUser }
  }
}

function jwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) throw new Error('JWT_SECRET must be set to at least 32 characters.');
  return secret;
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authorization = req.header('authorization');
  const token = authorization?.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
  if (!token) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }
  try {
    const decoded = jwt.verify(token, jwtSecret(), {
      issuer: 'apuyor-engine', audience: 'apuyor-engine-api',
    });
    if (typeof decoded === 'string' || typeof decoded.sub !== 'string') {
      res.status(401).json({ error: 'Invalid or expired token.' });
      return;
    }
    const user = await User.findById(decoded.sub).select('role isApproved isBlocked').lean();
    if (!user || user.isBlocked) {
      res.status(401).json({ error: 'Invalid or expired token.' });
      return;
    }
    if (!user.isApproved) {
      res.status(403).json({ error: 'Your account is awaiting approval.' });
      return;
    }
    if (user.role !== 'user' && user.role !== 'admin') {
      res.status(403).json({ error: 'Forbidden.' });
      return;
    }
    req.user = { id: user._id.toString(), role: user.role };
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token.' });
  }
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (req.user?.role !== 'admin') {
    res.status(403).json({ error: 'Admin access required.' });
    return;
  }
  next();
}

export { jwtSecret };
