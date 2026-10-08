import dns from 'node:dns';
import 'dotenv/config';
import http from 'node:http';
import cors, { type CorsOptions } from 'cors';
import express from 'express';
import jwt from 'jsonwebtoken';
import { Server as SocketServer } from 'socket.io';
import { connectDatabase } from './db.js';
import authRouter from './routes/auth.js';
import adminRouter from './routes/admin.js';
import likenessRouter from './routes/likeness.js';
import { jwtSecret, MOCK_ADMIN_USER } from './middleware/auth.js';
import { User } from './models/User.js';

// Use public DNS resolvers for MongoDB Atlas SRV records when local DNS is blocked.
dns.setServers(['8.8.8.8', '8.8.4.4']);

const app = express();
const isProduction = process.env.NODE_ENV === 'production';
const defaultOrigins = isProduction ? [] : [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
];
const allowedOrigins = (process.env.CLIENT_ORIGINS ?? '')
  .split(',').map((origin) => origin.trim().replace(/\/$/, '')).filter(Boolean);
const exactOrigins = [...new Set([...defaultOrigins, ...allowedOrigins])];
const corsOptions: CorsOptions = {
  origin(origin, callback) {
    const normalizedOrigin = origin?.replace(/\/$/, '');
    const localDevelopmentOrigin = !isProduction && Boolean(normalizedOrigin && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(normalizedOrigin));
    if (!origin || (normalizedOrigin && exactOrigins.includes(normalizedOrigin)) || localDevelopmentOrigin) return callback(null, true);
    return callback(new Error(`Origin ${origin} is not allowed by CLIENT_ORIGINS.`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Authorization', 'Content-Type'],
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '1mb' }));
app.get('/health', (_req, res) => res.json({ status: 'ok' }));
app.use('/api/auth', authRouter);
app.use('/api/admin', adminRouter);
app.use('/api/likeness', likenessRouter);

const httpServer = http.createServer(app);
const io = new SocketServer(httpServer, {
  cors: corsOptions,
  transports: ['websocket', 'polling'],
  maxHttpBufferSize: 1e6,
});

function isLoopbackSocket(socketAddress: string | undefined): boolean {
  if (!socketAddress) return false;
  const address = socketAddress.toLowerCase().replace(/^::ffff:/, '');
  return address === '::1' || address === '127.0.0.1' || address.startsWith('127.');
}

io.use(async (socket, next) => {
  try {
    const authToken = socket.handshake.auth?.token;
    const authorizationHeader = socket.handshake.headers.authorization;
    const headerValue = Array.isArray(authorizationHeader) ? authorizationHeader[0] : authorizationHeader;
    const bearerToken = typeof headerValue === 'string'
      ? /^Bearer\s+(.+)$/i.exec(headerValue.trim())?.[1]
      : undefined;
    const token = typeof authToken === 'string' && authToken.trim()
      ? authToken.trim()
      : bearerToken?.trim();
    const localDevelopment = process.env.NODE_ENV !== 'production' && isLoopbackSocket(socket.handshake.address);
    const localBypass = localDevelopment && (
      process.env.BYPASS_AUTH?.toLowerCase() === 'true' || !token
    );
    if (localBypass) {
      socket.data.userId = MOCK_ADMIN_USER.id;
      socket.data.role = MOCK_ADMIN_USER.role;
      return next();
    }
    if (!token) return next(new Error('unauthorized'));
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
    void Promise.resolve(socket.join(roomId)).then(() => socket.to(roomId).emit('signal:peer-joined', { from: socket.id }));
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
httpServer.listen(port, '0.0.0.0', () => console.info(`Apuyor Engine API and Socket.IO listening on port ${port}`));
}

start().catch((error: unknown) => {
  console.error('Unable to start Apuyor Engine:', error);
  process.exitCode = 1;
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => httpServer.close(() => process.exit(0)));
}
