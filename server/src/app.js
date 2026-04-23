const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const express = require("express");
const cors = require("cors");
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const morgan = require("morgan");
const healthRoutes = require("./routes/health.route");
const authRoutes = require("./routes/auth.route");
const { isOriginAllowed, validateServerEnv } = require('./config/env');
const { notFound, errorHandler } = require("./middleware/errorHandler");
const logger = require('./utils/logger');

validateServerEnv();
const app = express();

const corsOptions = {
  origin(origin, callback) {
    if (process.env.NODE_ENV === 'test' || isOriginAllowed(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error('Origin is not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

// Middleware
app.disable('x-powered-by');
app.use(cors(corsOptions));
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cookieParser());
app.use(express.json({ limit: process.env.JSON_BODY_LIMIT || '1mb' }));
app.use(express.urlencoded({ extended: false, limit: process.env.JSON_BODY_LIMIT || '1mb' }));
app.use(mongoSanitize());
app.use(morgan("dev"));
app.use((req, res, next) => {
  const originalJson = res.json.bind(res);
  res.json = (body) => {
    if (body && typeof body === 'object' && !Array.isArray(body) && !Object.prototype.hasOwnProperty.call(body, 'success')) {
      return originalJson({ success: res.statusCode < 400, ...body });
    }

    return originalJson(body);
  };
  next();
});
app.use((err, req, res, next) => {
  if (err && /CORS/i.test(err.message)) {
    logger.warn('Blocked CORS request', { origin: req.headers.origin, path: req.originalUrl });
    return res.status(403).json({ message: err.message });
  }
  return next(err);
});

// Routes
app.use('/api', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/profile', require('./routes/profile.route'));
app.use('/api/verification', require('./routes/verification.route'));
app.use('/api/users', require('./routes/user.route'));
app.use('/api/questions', require('./routes/question.route'));
app.use('/api/exams', require('./routes/exam.route'));
app.use('/api/attempts', require('./routes/examAttempt.route'));
app.use('/api/analytics', require('./routes/performanceAnalytics.route'));
app.use('/api/reports', require('./routes/report.route'));
app.use('/api/adaptive', require('./routes/adaptiveTest.route'));
app.use('/api/batch-analytics', require('./routes/batchAnalytics.route')); // New route registration
app.use('/api/classes', require('./routes/class.route'));
app.use('/api/subjects', require('./routes/subject.route'));

app.get("/", (req, res) => {
  res.send("AI MCQ Examination System API Running 🚀");
});

// 404 + global error handler
app.use(notFound);
app.use(errorHandler);

module.exports = app;