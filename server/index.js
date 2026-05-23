import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
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

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;
const configuredOrigins = (process.env.CLIENT_ORIGIN || 'http://127.0.0.1:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const localDevOriginPattern = /^http:\/\/(localhost|127\.0\.0\.1):\d+$/;

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || configuredOrigins.includes(origin) || localDevOriginPattern.test(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error(`CORS blocked for origin: ${origin}`));
    },
  })
);
app.use(express.json({ limit: '1mb' }));

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

app.listen(port, () => {
  console.log(`MGPS ERP API running on http://127.0.0.1:${port}`);
});
