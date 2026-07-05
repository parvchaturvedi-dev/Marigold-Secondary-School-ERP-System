import cors from 'cors';
import compression from 'compression';
import express from 'express';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import './utils/loadEnv.js';
import academicCalendarRoutes from './routes/academicCalendar.js';
import adminResetRoutes from './routes/adminReset.js';
import aiRoutes from './routes/ai.js';
import assistantRoutes from './routes/assistant.js';
import classInfoRoutes from './routes/classInfo.js';
import applicationRoutes from './routes/applications.js';
import assignmentRoutes from './routes/assignments.js';
import attendanceRoutes from './routes/attendance.js';
import authRoutes from './routes/auth.js';
import dashboardRoutes from './routes/dashboard.js';
import examinationRoutes from './routes/examinations.js';
import eventRoutes from './routes/events.js';
import feesRoutes from './routes/fees.js';
import gmailRoutes from './routes/gmail.js';
import leaveRequestRoutes from './routes/leaveRequests.js';
import meetingRoutes from './routes/meetings.js';
import moduleStateRoutes from './routes/moduleState.js';
import notificationRoutes from './routes/notifications.js';
import payrollRoutes from './routes/payroll.js';
import searchRoutes from './routes/search.js';
import timetableRoutes from './routes/timetable.js';
import vaultRoutes from './routes/vault.js';
import { connectMongo, getDbStatus } from './db.js';
import { requireAuth } from './middleware/auth.js';
import { verifyAuthToken } from './utils/authToken.js';
import { setRealtimeServer, trackRealtimeSocket } from './realtime.js';
import { createSessionMiddleware } from './utils/session.js';

const app = express();
const server = createServer(app);
const port = process.env.PORT || 5000;

const normalizeOrigin = (origin = '') => String(origin).trim().replace(/\/+$/, '');

const parseOriginList = (value = '') =>
  String(value)
    .split(',')
    .map(normalizeOrigin)
    .filter(Boolean);
const localDevOriginPattern = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
const vercelOrigin = process.env.VERCEL_URL ? `https://${normalizeOrigin(process.env.VERCEL_URL)}` : '';
const frontendUrl = process.env.FRONTEND_URL || process.env.FRONTEND_ORIGIN || '';
const defaultAllowedOrigins = [
  'https://www.mghub.marigoldschoolbehror.com',
  'https://mghub.marigoldschoolbehror.com',
  'http://localhost:5173',
  'https://marigold-secondary-school-erp-system-frontend-dhuizf172.vercel.app',
];
const schoolVercelPreviewPattern =
  /^https:\/\/marigold-secondary-school-erp-system-frontend-[a-z0-9-]+\.vercel\.app$/;
const configuredOrigins = new Set(
  [
    ...defaultAllowedOrigins,
    ...parseOriginList(process.env.CORS_ORIGINS),
    ...parseOriginList(process.env.CLIENT_ORIGIN),
    ...parseOriginList(frontendUrl),
    vercelOrigin,
  ].filter(Boolean)
);

const isAllowedOrigin = (origin) =>
  !origin ||
  configuredOrigins.has(normalizeOrigin(origin)) ||
  localDevOriginPattern.test(origin) ||
  schoolVercelPreviewPattern.test(origin);

const corsOrigin = (origin, callback) => {
  if (isAllowedOrigin(origin)) {
    callback(null, true);
    return;
  }

  const error = new Error(`CORS blocked for origin: ${origin}`);
  error.statusCode = 403;
  callback(error);
};

const sessionMiddleware = createSessionMiddleware();
const corsMiddleware = cors({
  origin: corsOrigin,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Device-Id', 'x-device-id'],
  optionsSuccessStatus: 204,
});

app.set('trust proxy', 1);
// gzip every response — the ModuleState blobs (with base64 photos/docs) compress
// ~5-10x, which is the single biggest win for slow mobile loads.
app.use(compression());
app.use(corsMiddleware);
app.options(/.*/, corsMiddleware);
app.use(sessionMiddleware);
app.use(express.json({ limit: '8mb' }));

const io = new Server(server, {
  cors: {
    origin: corsOrigin,
    credentials: true,
  },
});

io.engine.use(sessionMiddleware);
setRealtimeServer(io);

io.use((socket, next) => {
  // Web clients authenticate via the cookie session; mobile clients (no cookie
  // jar) pass a Bearer token in the socket handshake auth payload.
  const sessionAuth = socket.request.session?.auth;
  if (sessionAuth?.username && sessionAuth?.role) {
    socket.data.auth = sessionAuth;
    return next();
  }

  const handshake = socket.handshake || {};
  const rawToken =
    handshake.auth?.token ||
    (typeof handshake.headers?.authorization === 'string' && handshake.headers.authorization.startsWith('Bearer ')
      ? handshake.headers.authorization.slice(7)
      : '') ||
    handshake.query?.token ||
    '';

  if (rawToken) {
    const tokenAuth = verifyAuthToken(String(rawToken));
    if (tokenAuth?.username && tokenAuth?.role) {
      socket.data.auth = tokenAuth;
    }
  }

  next();
});

io.on('connection', (socket) => {
  trackRealtimeSocket(socket);
});

app.get('/api/health', (_request, response) => {
  response.json({
    ok: true,
    database: getDbStatus(),
  });
});

app.use('/api/auth', authRoutes);
app.use('/api', requireAuth);
app.use('/api/academic-calendar', academicCalendarRoutes);
app.use('/api/ai/assistant', assistantRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/class-info', classInfoRoutes);
app.use('/api/applications', applicationRoutes);
app.use('/api/assignments', assignmentRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/examinations', examinationRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/fees', feesRoutes);
app.use('/api/gmail', gmailRoutes);
app.use('/api/leave-requests', leaveRequestRoutes);
app.use('/api/meetings', meetingRoutes);
app.use('/api/module-state', moduleStateRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/payroll', payrollRoutes);
app.use('/api/admin', adminResetRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/timetable', timetableRoutes);
app.use('/api/vault', vaultRoutes);

app.use((error, request, response, next) => {
  if (response.headersSent) {
    next(error);
    return;
  }

  const statusCode = error.statusCode || error.status || 500;
  const isCorsError = /^CORS blocked/.test(error.message || '');

  console.error('[api:error]', {
    method: request.method,
    path: request.originalUrl,
    origin: request.get('origin') || '',
    statusCode,
    message: error.message,
    stack: process.env.NODE_ENV === 'production' ? undefined : error.stack,
  });

  response.status(statusCode).json({
    message: isCorsError ? 'Origin is not allowed by CORS policy.' : 'Internal server error.',
  });
});

await connectMongo();

server.listen(port, () => {
  console.log(`MGPS ERP API running on port ${port}`);
});
