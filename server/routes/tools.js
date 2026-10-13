const express = require('express');
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../db/schema');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// ─── Configure Multer for File Uploads ────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '..', 'uploads'));
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    // Strictly validate MIME types (JPEG/PNG only)
    if (file.mimetype === 'image/jpeg' || file.mimetype === 'image/png') {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG and PNG images are allowed.'));
    }
  },
});

const VALID_CATEGORIES = [
  'Power Tools',
  'Hand Tools',
  'Gardening',
  'Ladders & Scaffolding',
  'Other',
];

// ─── POST /api/tools — Add a new tool ──────────
router.post('/', authenticateToken, (req, res, next) => {
  upload.single('image')(req, res, function (err) {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ message: 'File upload error.', errors: { image: err.message } });
    } else if (err) {
      return res.status(400).json({ message: 'Invalid file.', errors: { image: err.message } });
    }
    next();
  });
}, (req, res) => {
  try {
    const { title, category, description, condition, depositAmount } = req.body;
    const errors = {};

    if (!title || !title.trim()) {
      errors.title = 'Tool name is required.';
    } else if (title.trim().length < 3) {
      errors.title = 'Tool name should be at least 3 characters.';
    }

    if (!category || !category.trim()) {
      errors.category = 'Select a category.';
    } else if (!VALID_CATEGORIES.includes(category)) {
      errors.category = 'Please select a valid category.';
    }

    if (!description || !description.trim()) {
      errors.description = 'Provide a description.';
    } else if (description.trim().length < 10) {
      errors.description = 'Description should be at least 10 characters.';
    }

    if (!condition || !condition.trim()) {
      errors.condition = 'Specify condition.';
    }

    if (depositAmount === undefined || depositAmount === null || depositAmount === '') {
      errors.depositAmount = 'Specify deposit amount.';
    } else if (isNaN(Number(depositAmount)) || Number(depositAmount) < 0) {
      errors.depositAmount = 'Must be a valid positive number.';
    }

    const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;

    if (Object.keys(errors).length > 0) {
      return res.status(400).json({ message: 'Validation failed.', errors });
    }

    const db = getDb();
    const stmt = db.prepare(`
      INSERT INTO tools (user_id, title, category, description, condition, deposit_amount, status, image_url)
      VALUES (?, ?, ?, ?, ?, ?, 'Available', ?)
    `);
    const result = stmt.run(
      req.user.id,
      title.trim(),
      category.trim(),
      description.trim(),
      condition.trim(),
      Number(depositAmount),
      imageUrl
    );

    const toolRecord = db.prepare('SELECT * FROM tools WHERE id = ?').get(result.lastInsertRowid);

    res.status(201).json({
      message: 'Tool added successfully.',
      tool: {
        id: toolRecord.id,
        title: toolRecord.title,
        category: toolRecord.category,
        description: toolRecord.description,
        condition: toolRecord.condition,
        depositAmount: toolRecord.deposit_amount,
        status: toolRecord.status,
        imageUrl: toolRecord.image_url,
        createdAt: toolRecord.created_at,
      },
    });
  } catch (err) {
    console.error('Create tool error:', err);
    res.status(500).json({ message: 'Something went wrong. Please try again.' });
  }
});

// ─── GET /api/tools — Public feed of tools ─
router.get('/', (req, res) => {
  try {
    const { search, category, status } = req.query;
    const db = getDb();

    let query = `
      SELECT
        t.id, t.title, t.category, t.description, t.condition, t.deposit_amount, t.status, t.image_url, t.created_at,
        u.full_name AS owner_name, u.block_code AS owner_block
      FROM tools t
      JOIN users u ON t.user_id = u.id
      WHERE 1=1
    `;
    const params = [];

    if (status) {
      query += ` AND t.status = ?`;
      params.push(status);
    } else {
      query += ` AND t.status IN ('Available', 'Online')`;
    }

    if (category) {
      query += ` AND t.category = ?`;
      params.push(category);
    }

    if (search) {
      query += ` AND (t.title LIKE ? OR t.description LIKE ?)`;
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern);
    }

    query += ` ORDER BY t.created_at DESC`;

    const tools = db.prepare(query).all(...params);

    res.json({
      tools: tools.map(t => ({
        id: t.id,
        title: t.title,
        category: t.category,
        description: t.description,
        condition: t.condition,
        depositAmount: t.deposit_amount,
        status: t.status,
        imageUrl: t.image_url,
        ownerId: t.user_id,
        ownerName: t.owner_name,
        ownerBlock: t.owner_block,
        createdAt: t.created_at,
      })),
    });
  } catch (err) {
    console.error('Fetch tools error:', err);
    res.status(500).json({ message: 'Could not load tools.' });
  }
});

// ─── GET /api/tools/my — User's own tools ─────────
router.get('/my', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const tools = db.prepare('SELECT * FROM tools WHERE user_id = ? ORDER BY created_at DESC')
      .all(req.user.id);

    res.json({
      tools: tools.map(t => ({
        id: t.id,
        title: t.title,
        category: t.category,
        description: t.description,
        condition: t.condition,
        depositAmount: t.deposit_amount,
        status: t.status,
        imageUrl: t.image_url,
        createdAt: t.created_at,
      })),
    });
  } catch (err) {
    console.error('Fetch my tools error:', err);
    res.status(500).json({ message: 'Could not load your tools.' });
  }
});

// ─── GET /api/tools/:id — Get a single tool ─────────
router.get('/:id', (req, res) => {
  try {
    const db = getDb();
    const tool = db.prepare(`
      SELECT t.*, u.full_name AS owner_name, u.block_code AS owner_block
      FROM tools t
      JOIN users u ON t.user_id = u.id
      WHERE t.id = ?
    `).get(req.params.id);

    if (!tool) return res.status(404).json({ message: 'Tool not found.' });

    res.json({
      tool: {
        id: tool.id,
        title: tool.title,
        category: tool.category,
        description: tool.description,
        condition: tool.condition,
        depositAmount: tool.deposit_amount,
        status: tool.status,
        imageUrl: tool.image_url,
        ownerId: tool.user_id,
        ownerName: tool.owner_name,
        ownerBlock: tool.owner_block,
        createdAt: tool.created_at,
      }
    });
  } catch (err) {
    console.error('Fetch tool error:', err);
    res.status(500).json({ message: 'Could not load tool details.' });
  }
});

// ─── PUT /api/tools/:id — Update a tool ─────────
router.put('/:id', authenticateToken, (req, res, next) => {
  upload.single('image')(req, res, function (err) {
    if (err) {
      return res.status(400).json({ message: 'File upload error.', errors: { image: err.message } });
    }
    next();
  });
}, (req, res) => {
  try {
    const { title, category, description, condition, depositAmount, status } = req.body;
    const db = getDb();

    // Check ownership
    const existing = db.prepare('SELECT * FROM tools WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ message: 'Tool not found.' });
    if (existing.user_id !== req.user.id) return res.status(403).json({ message: 'Not authorized to edit this tool.' });

    const imageUrl = req.file ? `/uploads/${req.file.filename}` : existing.image_url;

    db.prepare(`
      UPDATE tools 
      SET title = ?, category = ?, description = ?, condition = ?, deposit_amount = ?, status = ?, image_url = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(
      title?.trim() || existing.title,
      category?.trim() || existing.category,
      description?.trim() || existing.description,
      condition?.trim() || existing.condition,
      depositAmount !== undefined ? Number(depositAmount) : existing.deposit_amount,
      status || existing.status,
      imageUrl,
      req.params.id
    );

    res.json({ message: 'Tool updated successfully.' });
  } catch (err) {
    console.error('Update tool error:', err);
    res.status(500).json({ message: 'Could not update tool.' });
  }
});

// Export categories for the frontend
router.get('/categories', (req, res) => {
  res.json({ categories: VALID_CATEGORIES });
});

module.exports = router;
