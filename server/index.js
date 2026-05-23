import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import academicCalendarRoutes from './routes/academicCalendar.js';
import applicationRoutes from './routes/applications.js';
import assignmentRoutes from './routes/assignments.js';
import authRoutes from './routes/auth.js';
import examinationRoutes from './routes/examinations.js';
import eventRoutes from './routes/events.js';
import gmailRoutes from './routes/gmail.js';
import leaveRequestRoutes from './routes/leaveRequests.js';
import moduleStateRoutes from './routes/moduleState.js';
import { connectMongo, getDbStatus } from './db.js';
import { requireAuth } from './middleware/auth.js';
import { setRealtimeServer } from './realtime.js';
import { createSessionMiddleware } from './utils/session.js';

dotenv.config();

const app = express();
const server = createServer(app);
const port = process.env.PORT || 5000;

const parseOriginList = (value = '') =>
  String(value)
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
const localDevOriginPattern = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
const vercelOrigin = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '';
const configuredOrigins = new Set(
  [
    ...parseOriginList(process.env.CORS_ORIGINS),
    ...parseOriginList(process.env.CLIENT_ORIGIN),
    ...parseOriginList(process.env.FRONTEND_ORIGIN),
    vercelOrigin,
  ].filter(Boolean)
);

const isAllowedOrigin = (origin) =>
  !origin || configuredOrigins.has(origin) || localDevOriginPattern.test(origin);

const corsOrigin = (origin, callback) => {
  if (isAllowedOrigin(origin)) {
    callback(null, true);
    return;
  }

  callback(new Error(`CORS blocked for origin: ${origin}`));
};

const sessionMiddleware = createSessionMiddleware();

app.set('trust proxy', 1);
app.use(cors({
  origin: corsOrigin,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(sessionMiddleware);
app.use(express.json({ limit: '1mb' }));

const io = new Server(server, {
  cors: {
    origin: corsOrigin,
    credentials: true,
  },
});

io.engine.use(sessionMiddleware);
setRealtimeServer(io);

io.use((socket, next) => {
  const sessionAuth = socket.request.session?.auth;
  if (sessionAuth?.username && sessionAuth?.role) {
    socket.data.auth = sessionAuth;
  }
  next();
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
app.use('/api/applications', applicationRoutes);
app.use('/api/assignments', assignmentRoutes);
app.use('/api/examinations', examinationRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/gmail', gmailRoutes);
app.use('/api/leave-requests', leaveRequestRoutes);
app.use('/api/module-state', moduleStateRoutes);

await connectMongo();

server.listen(port, () => {
  console.log(`MGPS ERP API running on port ${port}`);
});
