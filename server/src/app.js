const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const healthRoutes = require("./routes/health.route");
const authRoutes = require("./routes/auth.route");
const { notFound, errorHandler } = require("./middleware/errorHandler");

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

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

app.get("/", (req, res) => {
  res.send("AI MCQ Examination System API Running 🚀");
});

// 404 + global error handler
app.use(notFound);
app.use(errorHandler);

module.exports = app;