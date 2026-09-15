'use strict';

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const config = require('./config/env');
const logger = require('./utils/logger');
const { notFoundHandler } = require('./middleware/notFoundMiddleware');
const { errorHandler } = require('./middleware/errorMiddleware');

// Route imports
const healthRoutes = require('./routes/healthRoutes');
const authRoutes = require('./routes/authRoutes');
const studentRoutes = require('./routes/studentRoutes');
const systemRoutes = require('./routes/systemRoutes');
const systemInfoRoutes = require('./routes/systemInfoRoutes');
const sessionRoutes = require('./routes/sessionRoutes');
const syncRoutes = require('./routes/syncRoutes');
const timetableRoutes = require('./routes/timetableRoutes');
const attendanceRoutes = require('./routes/attendanceRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const userRoutes = require('./routes/userRoutes');
const reportRoutes = require('./routes/reportRoutes');
const exportRoutes = require('./routes/exportRoutes');
const facultyRoutes = require('./routes/facultyRoutes');
const labRoutes = require('./routes/labRoutes');
const ticketRoutes = require('./routes/ticketRoutes');

const app = express();

// ─── Security Middleware ───────────────────────────────────────────────────────

app.use(helmet());

// CORS — only allow configured origins
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl, Postman, same-origin)
      if (!origin) return callback(null, true);
      if (config.cors.origins.includes(origin)) return callback(null, true);
      return callback(new Error(`CORS: Origin ${origin} not allowed`));
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  })
);

// ─── General Rate Limit ────────────────────────────────────────────────────────

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests. Please try again later.',
    error: { code: 'RATE_LIMITED' },
  },
});

app.use(generalLimiter);

// ─── Body Parsing ──────────────────────────────────────────────────────────────

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ─── HTTP Logging ──────────────────────────────────────────────────────────────

app.use(logger.morganMiddleware);

// ─── Routes ───────────────────────────────────────────────────────────────────

app.use('/api', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/systems', systemRoutes);
app.use('/api/system', systemInfoRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/sync', syncRoutes);
app.use('/api/timetable', timetableRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/users', userRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/export', exportRoutes);
app.use('/api/faculty', facultyRoutes);
app.use('/api/labs', labRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/problems', ticketRoutes);

// ─── 404 Handler ──────────────────────────────────────────────────────────────

app.use(notFoundHandler);

// ─── Global Error Handler ─────────────────────────────────────────────────────

app.use(errorHandler);

module.exports = app;
