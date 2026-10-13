const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../db/schema');
const { sendVerificationEmail } = require('../services/email');

const router = express.Router();

// ─── Helpers ─────────────────────────────────────────────
const SALT_ROUNDS = 12;
const MAX_LOGIN_ATTEMPTS = 3;
const LOCKOUT_MINUTES = 15;

function generateToken(user, rememberMe = false) {
  return jwt.sign(
    { id: user.id, email: user.email, fullName: user.full_name, blockCode: user.block_code, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: rememberMe ? '30d' : (process.env.JWT_EXPIRES_IN || '7d') }
  );
}

// ─── POST /api/auth/register ────────────────────────────
router.post('/register', async (req, res) => {
  try {
    const { fullName, email, password, blockCode } = req.body;

    // Validation
    if (!fullName || !email || !password || !blockCode) {
      return res.status(400).json({ message: 'All fields are required.' });
    }

    if (password.length < 8) {
      return res.status(400).json({ message: 'Password must be at least 8 characters.' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: 'Please enter a valid email address.' });
    }

    const db = getDb();

    // Check if email is already registered
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase());
    if (existing) {
      return res.status(409).json({ message: 'Email address is already registered.' });
    }

    // Hash password with bcrypt
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    // Generate verification token
    const verifyToken = uuidv4();

    // Insert user
    const stmt = db.prepare(`
      INSERT INTO users (full_name, email, password_hash, block_code, verify_token)
      VALUES (?, ?, ?, ?, ?)
    `);
    const result = stmt.run(fullName.trim(), email.toLowerCase().trim(), passwordHash, blockCode.trim(), verifyToken);

    // Send verification email
    try {
      const emailResult = await sendVerificationEmail(email, fullName, verifyToken);
      console.log(`✅ Verification email sent to ${email}`, emailResult.previewUrl || '');
    } catch (emailErr) {
      console.error('⚠️  Email send failed (account still created):', emailErr.message);
    }

    res.status(201).json({
      message: 'Account created! Check your inbox for a verification email.',
      userId: result.lastInsertRowid,
    });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ message: 'Something went wrong. Please try again.' });
  }
});

// ─── POST /api/auth/login ───────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { email, password, rememberMe } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }

    const db = getDb();
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase());

    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    // Check if account is temporarily locked
    if (user.locked_until) {
      const lockedUntil = new Date(user.locked_until);
      if (lockedUntil > new Date()) {
        const minutesLeft = Math.ceil((lockedUntil - new Date()) / 60000);
        return res.status(423).json({
          message: `Account temporarily locked. Try again in ${minutesLeft} minute${minutesLeft > 1 ? 's' : ''}.`,
          locked: true,
        });
      } else {
        // Lockout expired — reset
        db.prepare('UPDATE users SET login_attempts = 0, locked_until = NULL WHERE id = ?').run(user.id);
        user.login_attempts = 0;
        user.locked_until = null;
      }
    }

    // Verify password
    const validPassword = await bcrypt.compare(password, user.password_hash);

    if (!validPassword) {
      const attempts = user.login_attempts + 1;

      if (attempts >= MAX_LOGIN_ATTEMPTS) {
        const lockUntil = new Date(Date.now() + LOCKOUT_MINUTES * 60000).toISOString();
        db.prepare('UPDATE users SET login_attempts = ?, locked_until = ? WHERE id = ?')
          .run(attempts, lockUntil, user.id);
        return res.status(401).json({
          message: 'Invalid email or password.',
          locked: true,
          attemptsExhausted: true,
        });
      }

      db.prepare('UPDATE users SET login_attempts = ? WHERE id = ?').run(attempts, user.id);
      return res.status(401).json({
        message: 'Invalid email or password.',
        remainingAttempts: MAX_LOGIN_ATTEMPTS - attempts,
      });
    }

    // Successful login — reset attempts
    db.prepare('UPDATE users SET login_attempts = 0, locked_until = NULL WHERE id = ?').run(user.id);

    const token = generateToken(user, rememberMe);

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: rememberMe ? 30 * 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000,
    });

    res.json({
      message: `Welcome back, ${user.full_name}!`,
      user: {
        id: user.id,
        fullName: user.full_name,
        email: user.email,
        blockCode: user.block_code,
        role: user.role,
        isVerified: !!user.is_verified,
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Something went wrong. Please try again.' });
  }
});

// ─── GET /api/auth/me ───────────────────────────────────
router.get('/me', (req, res) => {
  // This route should be called with the auth middleware
  const { authenticateToken } = require('../middleware/auth');
  authenticateToken(req, res, () => {
    const db = getDb();
    const user = db.prepare('SELECT id, full_name, email, block_code, role, is_verified, created_at FROM users WHERE id = ?')
      .get(req.user.id);

    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    res.json({
      user: {
        id: user.id,
        fullName: user.full_name,
        email: user.email,
        blockCode: user.block_code,
        role: user.role,
        isVerified: !!user.is_verified,
        createdAt: user.created_at,
      },
    });
  });
});

// ─── GET /api/auth/verify ───────────────────────────────
router.get('/verify', (req, res) => {
  const { token } = req.query;

  if (!token) {
    return res.status(400).json({ message: 'Verification token is required.' });
  }

  const db = getDb();
  const user = db.prepare('SELECT id FROM users WHERE verify_token = ?').get(token);

  if (!user) {
    return res.status(400).json({ message: 'Invalid or expired verification link.' });
  }

  db.prepare('UPDATE users SET is_verified = 1, verify_token = NULL WHERE id = ?').run(user.id);

  res.json({ message: 'Email verified! You can now log in.' });
});

// ─── POST /api/auth/logout ──────────────────────────────
router.post('/logout', (req, res) => {
  res.clearCookie('token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
  });
  res.json({ message: 'Logged out successfully.' });
});

module.exports = router;
