require('dotenv').config();
const express      = require('express');
const cors         = require('cors');
const cookieParser = require('cookie-parser');
const rateLimit    = require('express-rate-limit');

// ─── Sprint 1 Routes ─────────────────────────────────────────
const authRoutes  = require('./routes/auth');
const toolRoutes  = require('./routes/tools');

// ─── Sprint 2 Routes ─────────────────────────────────────────
const requestRoutes      = require('./routes/requests');
const rentalRoutes       = require('./routes/rentals');
const reviewRoutes       = require('./routes/reviews');
const notificationRoutes = require('./routes/notifications');

// ─── Sprint 2 Services ───────────────────────────────────────
const { registerNotificationListeners } = require('./services/notificationListener');
const { startOverdueScheduler }         = require('./workers/overdueScheduler');

const app  = express();
const PORT = process.env.PORT || 5000;

// ─── CORS ────────────────────────────────────────────────────
const allowedOrigins = [
  process.env.CLIENT_URL,
  'http://localhost:5173',
  'http://localhost:3000',
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (e.g. curl, mobile apps, Postman)
    if (!origin) return callback(null, true);

    // Allow explicitly matched origins or any Vercel deployment preview / production URL
    const isAllowed = allowedOrigins.includes(origin) ||
                      origin.endsWith('.vercel.app') ||
                      origin.includes('localhost');

    if (isAllowed) {
      callback(null, true);
    } else {
      console.warn(`[CORS] Blocked request from origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));

app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

// ─── Rate limiting ───────────────────────────────────────────
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { message: 'Too many requests. Please try again later.' },
});
app.use('/api/auth', authLimiter);
app.use('/auth',     authLimiter);

// ─── Routes (support both /api/* and /* paths) ────────────────
app.use('/api/auth',  authRoutes);
app.use('/auth',      authRoutes);

app.use('/api/tools', toolRoutes);
app.use('/tools',     toolRoutes);

// ─── Sprint 2 Routes ─────────────────────────────────────────
app.use('/api/requests',      requestRoutes);
app.use('/requests',          requestRoutes);

app.use('/api/rentals',       rentalRoutes);
app.use('/rentals',           rentalRoutes);

app.use('/api/reviews',       reviewRoutes);
app.use('/reviews',           reviewRoutes);

app.use('/api/notifications', notificationRoutes);
app.use('/notifications',     notificationRoutes);

// Health check and root ping with DB diagnostic
app.get(['/', '/health', '/api/health'], async (req, res) => {
  let dbStatus = 'unknown';
  let dbError = null;
  try {
    const { getDb } = require('./db/schema');
    const db = getDb();
    const { data, error } = await db.from('users').select('id').limit(1);
    if (error) {
      dbStatus = 'table_or_query_error';
      dbError = error.message;
    } else {
      dbStatus = 'connected';
    }
  } catch (e) {
    dbStatus = 'connection_or_env_error';
    dbError = e.message;
  }

  res.json({
    status: 'ok',
    service: 'ntee-api',
    database: { status: dbStatus, error: dbError },
    timestamp: new Date().toISOString(),
  });
});

// ─── Start ───────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🏡  NTEE Neighborhood API`);
  console.log(`   Running on http://localhost:${PORT}`);
  console.log(`   Health check: http://localhost:${PORT}/api/health\n`);

  // ── Sprint 2: Boot event-driven subsystems ──────────────
  registerNotificationListeners(); // wire up event → DB notification pipeline
  startOverdueScheduler();         // daily cron at 06:00 IST
});
