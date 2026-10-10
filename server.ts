import dotenv from 'dotenv';
import express, { NextFunction, Request, Response } from 'express';
import path from 'path';
import cookieParser from 'cookie-parser';
import { verifyAuthToken } from './server/auth.js';
import authRoutes from './server/routes/authRoutes.js';
import userRoutes from './server/routes/userRoutes.js';
import makeAdminRoutes from './server/routes/makeAdminRoutes.js';
import transferRoutes from './server/routes/transferRoutes.js';
import adminRoutes from './server/routes/adminRoutes.js';
import verifyRoutes from './server/routes/verifyRoutes.js';
import accountRoutes from './server/routes/accountRoutes.js';
import grantRoutes from './server/routes/grantRoutes.js';
import notificationRoutes from './server/routes/notificationRoutes.js';

dotenv.config({ path: '.env.local' });
dotenv.config();

export const app = express();

app.use(express.json({ limit: '7mb' }));
app.use(cookieParser());

app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'American Credit Union Financing ', time: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
app.use('/api', authRoutes);
app.use('/api/verify', verifyRoutes);
app.use('/api', makeAdminRoutes);
app.use('/api/user', userRoutes);
app.use('/api/transfers', transferRoutes);
app.use('/api/accounts', accountRoutes);
app.use('/api/grants', grantRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/admin', adminRoutes);

app.get('/admin', (req: Request, res: Response, next: NextFunction) => {
  const cookieToken = req.cookies?.boa_token;
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : cookieToken;

  if (!token) {
    res.status(403);
    if (req.xhr || req.headers.accept?.includes('application/json')) {
      res.json({ error: 'Forbidden: Admin access required.' });
      return;
    }
    res.redirect('/dashboard?auth_error=403_forbidden');
    return;
  }

  const decoded = verifyAuthToken(token);
  if (!decoded || decoded.role !== 'admin') {
    res.status(403);
    if (req.xhr || req.headers.accept?.includes('application/json')) {
      res.json({ error: 'Forbidden: Admin access required.' });
      return;
    }
    res.redirect('/dashboard?auth_error=403_forbidden');
    return;
  }

  next();
});

if (process.env.NODE_ENV === 'production' && process.env.VERCEL !== '1') {
  const distPath = path.join(process.cwd(), 'dist');
  app.use(express.static(distPath));
  app.get('*', (_req: Request, res: Response) => res.sendFile(path.join(distPath, 'index.html')));
}

app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled Express error:', err?.stack || err);
  res.status(500).json({
    error: typeof err?.message === 'string' ? err.message : 'A server error has occurred.',
  });
});

async function startServer(): Promise<void> {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer } = await import('vite');
    const vite = await createServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  }

  const port = Number(process.env.PORT) || 3000;
  const host = process.env.NODE_ENV === 'production' ? '0.0.0.0' : '127.0.0.1';
  app.listen(port, host, () => {
    console.log(`American Credit Union Financing running on http://${host}:${port}`);
  });
}

if (process.env.VERCEL !== '1') {
  startServer().catch((err) => {
    console.error('Fatal error starting server:', err);
    process.exit(1);
  });
}
