require('dotenv').config();
const express     = require('express');
const cors        = require('cors');
const cookieParser = require('cookie-parser');
const rateLimit   = require('express-rate-limit');

const authRoutes = require('./routes/auth');
const toolRoutes = require('./routes/tools');

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
});
