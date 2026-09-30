import 'dotenv/config';
import http from 'node:http';
import cors from 'cors';
import express from 'express';
import jwt from 'jsonwebtoken';
import { Server as SocketServer } from 'socket.io';
import { connectDatabase } from './db.js';
import authRouter from './routes/auth.js';
import adminRouter from './routes/admin.js';
import { jwtSecret } from './middleware/auth.js';
import { User } from './models/User.js';

const app = express();
const allowedOrigins = (process.env.CLIENT_ORIGINS ?? 'http://localhost:5173')
  .split(',').map((origin) => origin.trim()).filter(Boolean);

app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.get('/health', (_req, res) => res.json({ status: 'ok' }));
app.use('/api/auth', authRouter);
app.use('/api/admin', adminRouter);

const httpServer = http.createServer(app);
const io = new SocketServer(httpServer, {
  cors: { origin: allowedOrigins, credentials: true, methods: ['GET', 'POST'] },
  maxHttpBufferSize: 1e6,
});

io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    if (typeof token !== 'string') return next(new Error('unauthorized'));
    const decoded = jwt.verify(token, jwtSecret(), { issuer: 'apuyor-engine', audience: 'apuyor-engine-api' });
    if (typeof decoded === 'string' || typeof decoded.sub !== 'string') return next(new Error('unauthorized'));
    const user = await User.findById(decoded.sub).select('role isApproved isBlocked').lean();
    if (!user || !user.isApproved || user.isBlocked) return next(new Error('unauthorized'));
    socket.data.userId = user._id.toString();
    next();
  } catch {
    next(new Error('unauthorized'));
  }
});

// WebRTC uses Socket.IO only to exchange offers, answers, and ICE candidates.
io.on('connection', (socket) => {
  socket.on('signal:join', (roomId: unknown) => {
    if (typeof roomId !== 'string' || !/^[\w-]{1,128}$/.test(roomId)) return;
    void socket.join(roomId).then(() => socket.to(roomId).emit('signal:peer-joined', { from: socket.id }));
  });
  for (const event of ['signal:offer', 'signal:answer', 'signal:ice'] as const) {
    socket.on(event, (message: { roomId?: unknown; payload?: unknown } = {}) => {
      if (typeof message.roomId !== 'string' || !/^[\w-]{1,128}$/.test(message.roomId)) return;
      if (!socket.rooms.has(message.roomId)) return;
      socket.to(message.roomId).emit(event, { from: socket.id, payload: message.payload });
    });
  }
});

const port = Number(process.env.PORT) || 4000;
async function start(): Promise<void> {
  await connectDatabase();
  httpServer.listen(port, () => console.info(`Apuyor Engine API listening on port ${port}`));
}

start().catch((error: unknown) => {
  console.error('Unable to start Apuyor Engine:', error);
  process.exitCode = 1;
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => httpServer.close(() => process.exit(0)));
}
