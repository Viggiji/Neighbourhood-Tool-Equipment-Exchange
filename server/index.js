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
// In production the frontend is on a different origin (Vercel),
// so we need sameSite:'none' + credentials.
const allowedOrigins = [
  process.env.CLIENT_URL || 'http://localhost:5173',
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (e.g. curl, Postman)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
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

// ─── Routes ──────────────────────────────────────────────────
app.use('/api/auth',  authRoutes);
app.use('/api/tools', toolRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── Start ───────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🏡  NTEE Neighborhood API`);
  console.log(`   Running on http://localhost:${PORT}`);
  console.log(`   Health check: http://localhost:${PORT}/api/health\n`);
});
