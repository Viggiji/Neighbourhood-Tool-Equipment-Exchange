const express = require('express');
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../db/schema');
const { sendVerificationEmail } = require('../services/email');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// ─── Helpers ──────────────────────────────────────────────────
const SALT_ROUNDS       = 12;
const MAX_LOGIN_ATTEMPTS = 3;
const LOCKOUT_MINUTES   = 15;

function generateToken(user, rememberMe = false) {
  return jwt.sign(
    { id: user.id, email: user.email, fullName: user.full_name, blockCode: user.block_code, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: rememberMe ? '30d' : (process.env.JWT_EXPIRES_IN || '7d') }
  );
}

// ─── POST /api/auth/register ────────────────────────────────
router.post('/register', async (req, res) => {
  try {
    const { fullName, email, password, blockCode } = req.body;

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

    // Check duplicate
    const { data: existing } = await db
      .from('users')
      .select('id')
      .eq('email', email.toLowerCase())
      .maybeSingle();

    if (existing) {
      return res.status(409).json({ message: 'Email address is already registered.' });
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const verifyToken  = uuidv4();

    const { data: newUser, error } = await db
      .from('users')
      .insert({
        full_name:     fullName.trim(),
        email:         email.toLowerCase().trim(),
        password_hash: passwordHash,
        block_code:    blockCode.trim(),
        verify_token:  verifyToken,
        role:          'neighbor',
        is_verified:   false,
        login_attempts: 0,
      })
      .select('id')
      .single();

    if (error) throw error;

    try {
      await sendVerificationEmail(email, fullName, verifyToken);
    } catch (emailErr) {
      console.error('⚠️  Email send failed (account still created):', emailErr.message);
    }

    res.status(201).json({
      message: 'Account created! Check your inbox for a verification email.',
      userId: newUser.id,
    });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({
      message: err.message || 'Something went wrong. Please try again.',
      details: err.details || err.hint || null,
    });
  }
});

// ─── POST /api/auth/login ────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { email, password, rememberMe } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }

    const db = getDb();
    const { data: user } = await db
      .from('users')
      .select('*')
      .eq('email', email.toLowerCase())
      .maybeSingle();

    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    // Check lockout
    if (user.locked_until) {
      const lockedUntil = new Date(user.locked_until);
      if (lockedUntil > new Date()) {
        const minutesLeft = Math.ceil((lockedUntil - new Date()) / 60000);
        return res.status(423).json({
          message: `Account temporarily locked. Try again in ${minutesLeft} minute${minutesLeft > 1 ? 's' : ''}.`,
          locked: true,
        });
      } else {
        await db.from('users').update({ login_attempts: 0, locked_until: null }).eq('id', user.id);
        user.login_attempts = 0;
        user.locked_until   = null;
      }
    }

    const validPassword = await bcrypt.compare(password, user.password_hash);

    if (!validPassword) {
      const attempts = user.login_attempts + 1;
      if (attempts >= MAX_LOGIN_ATTEMPTS) {
        const lockUntil = new Date(Date.now() + LOCKOUT_MINUTES * 60000).toISOString();
        await db.from('users').update({ login_attempts: attempts, locked_until: lockUntil }).eq('id', user.id);
        return res.status(401).json({ message: 'Invalid email or password.', locked: true, attemptsExhausted: true });
      }
      await db.from('users').update({ login_attempts: attempts }).eq('id', user.id);
      return res.status(401).json({ message: 'Invalid email or password.', remainingAttempts: MAX_LOGIN_ATTEMPTS - attempts });
    }

    // Successful login
    await db.from('users').update({ login_attempts: 0, locked_until: null }).eq('id', user.id);

    const token = generateToken(user, rememberMe);
    const isProduction = process.env.NODE_ENV === 'production';

    res.cookie('token', token, {
      httpOnly: true,
      secure:   isProduction,
      sameSite: isProduction ? 'none' : 'strict',
      maxAge:   rememberMe ? 30 * 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000,
    });

    res.json({
      message: `Welcome back, ${user.full_name}!`,
      user: {
        id:         user.id,
        fullName:   user.full_name,
        email:      user.email,
        blockCode:  user.block_code,
        role:       user.role,
        isVerified: !!user.is_verified,
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Something went wrong. Please try again.' });
  }
});

// ─── GET /api/auth/me ────────────────────────────────────────
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const db = getDb();
    const { data: user } = await db
      .from('users')
      .select('id, full_name, email, block_code, role, is_verified, created_at')
      .eq('id', req.user.id)
      .maybeSingle();

    if (!user) return res.status(404).json({ message: 'User not found.' });

    res.json({
      user: {
        id:         user.id,
        fullName:   user.full_name,
        email:      user.email,
        blockCode:  user.block_code,
        role:       user.role,
        isVerified: !!user.is_verified,
        createdAt:  user.created_at,
      },
    });
  } catch (err) {
    console.error('Me error:', err);
    res.status(500).json({ message: 'Something went wrong.' });
  }
});

// ─── GET /api/auth/verify ────────────────────────────────────
router.get('/verify', async (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(400).json({ message: 'Verification token is required.' });

  try {
    const db = getDb();
    const { data: user } = await db
      .from('users')
      .select('id')
      .eq('verify_token', token)
      .maybeSingle();

    if (!user) return res.status(400).json({ message: 'Invalid or expired verification link.' });

    await db.from('users').update({ is_verified: true, verify_token: null }).eq('id', user.id);
    res.json({ message: 'Email verified! You can now log in.' });
  } catch (err) {
    console.error('Verify error:', err);
    res.status(500).json({ message: 'Something went wrong.' });
  }
});

// ─── POST /api/auth/logout ───────────────────────────────────
router.post('/logout', (req, res) => {
  const isProduction = process.env.NODE_ENV === 'production';
  res.clearCookie('token', {
    httpOnly: true,
    secure:   isProduction,
    sameSite: isProduction ? 'none' : 'strict',
  });
  res.json({ message: 'Logged out successfully.' });
});

module.exports = router;
